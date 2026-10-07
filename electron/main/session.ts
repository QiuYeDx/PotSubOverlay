import { EventEmitter } from "node:events";
import fs from "node:fs";
import path from "node:path";
import type {
  DisplayPayload,
  LangMode,
  LangOrder,
  SubtitleLang,
  SubtitleStatus,
  SubtitleTrackInfo,
} from "@/shared/types";
import { availableLangs, composeDisplay, EMPTY_DISPLAY } from "./subtitle/compose";
import { matchSubtitleFiles, SUBTITLE_EXTENSIONS, type SubtitleCandidate } from "./subtitle/finder";
import { buildTrack, selectDefaultTracks, type SubtitleTrack } from "./subtitle/track";
import type { SubtitleFormat } from "./subtitle/types";
import type { SettingsStore } from "./settings";

const WATCH_DEBOUNCE_MS = 600;

interface LoadedTrack {
  candidate: SubtitleCandidate;
  track: SubtitleTrack | null;
  error?: string;
}

/**
 * Owns the subtitles of the media file currently followed: discovery,
 * loading, enabling tracks, watching the folder and composing what to show.
 */
export class SubtitleSession extends EventEmitter<{ change: [] }> {
  private mediaPath: string | null = null;
  private loaded: LoadedTrack[] = [];
  private enabled = new Set<string>();
  private status: SubtitleStatus = "no-player";
  private loadToken = 0;
  private watcher: fs.FSWatcher | null = null;
  private watchTimer: NodeJS.Timeout | null = null;

  constructor(private readonly settings: SettingsStore) {
    super();
  }

  get media(): string | null {
    return this.mediaPath;
  }

  getStatus(): SubtitleStatus {
    return this.status;
  }

  setNoPlayer(hasPlayer: boolean): void {
    if (this.mediaPath) return;
    const status = hasPlayer ? "waiting-path" : "no-player";
    if (status !== this.status) {
      this.status = status;
      this.emit("change");
    }
  }

  async setMedia(mediaPath: string | null): Promise<void> {
    if (mediaPath === this.mediaPath) return;
    this.mediaPath = mediaPath;
    this.loaded = [];
    this.enabled.clear();
    this.unwatch();
    if (!mediaPath) {
      this.status = "waiting-path";
      this.emit("change");
      return;
    }
    await this.reload();
    this.watch(path.dirname(mediaPath));
  }

  async reload(): Promise<void> {
    const mediaPath = this.mediaPath;
    if (!mediaPath) return;
    const token = ++this.loadToken;
    this.status = "scanning";
    this.emit("change");

    const prefs = this.settings.getMedia(mediaPath);
    const { filterSigns, preferVariant } = this.settings.get();
    let candidates: SubtitleCandidate[] = [];
    try {
      const entries = await fs.promises.readdir(path.dirname(mediaPath));
      candidates = matchSubtitleFiles(mediaPath, entries);
    } catch (error) {
      if (token !== this.loadToken) return;
      console.error("[session] readdir failed", error);
      this.loaded = [];
      this.status = "error";
      this.emit("change");
      return;
    }

    // Files the user added by hand live outside the naming convention.
    for (const extra of prefs?.extraFiles ?? []) {
      if (candidates.some((candidate) => candidate.path === extra)) continue;
      if (fs.existsSync(extra)) candidates.push(candidateFromPath(extra));
    }

    const loaded: LoadedTrack[] = [];
    for (const candidate of candidates) {
      try {
        const bytes = await fs.promises.readFile(candidate.path);
        loaded.push({ candidate, track: buildTrack(candidate, bytes, { filterSigns }) });
      } catch (error) {
        loaded.push({ candidate, track: null, error: String(error) });
      }
    }
    if (token !== this.loadToken) return;

    this.loaded = loaded;
    const tracks = this.tracks();
    const remembered = (prefs?.tracks ?? []).filter((p) => tracks.some((t) => t.path === p));
    const chosen =
      remembered.length > 0 ? remembered : selectDefaultTracks(tracks, preferVariant).map((t) => t.path);
    this.enabled = new Set(chosen);
    this.status = tracks.length > 0 ? "ready" : "none-found";
    this.emit("change");
  }

  /** Add a subtitle file the naming convention did not find. */
  async addFile(filePath: string): Promise<void> {
    const mediaPath = this.mediaPath;
    if (!mediaPath) return;
    const extraFiles = new Set(this.settings.getMedia(mediaPath)?.extraFiles ?? []);
    extraFiles.add(filePath);
    this.settings.updateMedia(mediaPath, { extraFiles: [...extraFiles] });
    await this.reload();
    this.setTrackEnabled(filePath, true, true);
  }

  setTrackEnabled(trackPath: string, enabled: boolean, exclusive = false): void {
    if (!this.mediaPath) return;
    if (exclusive) this.enabled.clear();
    if (enabled) this.enabled.add(trackPath);
    else this.enabled.delete(trackPath);
    this.settings.updateMedia(this.mediaPath, { tracks: [...this.enabled] });
    this.emit("change");
  }

  trackInfos(): SubtitleTrackInfo[] {
    return this.loaded.map(({ candidate, track, error }) => ({
      id: candidate.path,
      path: candidate.path,
      fileName: candidate.fileName,
      format: candidate.format,
      tag: candidate.tag,
      langs: track?.langs ?? [],
      bilingual: track?.bilingual ?? false,
      cueCount: track?.cues.length ?? 0,
      encoding: track?.encoding ?? "",
      enabled: this.enabled.has(candidate.path),
      error,
    }));
  }

  availableLangs(): SubtitleLang[] {
    return availableLangs(this.enabledTracks());
  }

  compose(timeMs: number, mode: LangMode, order: LangOrder): DisplayPayload {
    const tracks = this.enabledTracks();
    if (tracks.length === 0) return EMPTY_DISPLAY;
    return composeDisplay(tracks, timeMs, mode, order);
  }

  dispose(): void {
    this.unwatch();
  }

  private tracks(): SubtitleTrack[] {
    return this.loaded.flatMap((entry) => (entry.track ? [entry.track] : []));
  }

  private enabledTracks(): SubtitleTrack[] {
    return this.tracks().filter((track) => this.enabled.has(track.path));
  }

  private watch(dir: string): void {
    try {
      this.watcher = fs.watch(dir, { persistent: false }, (_event, fileName) => {
        if (!fileName) return;
        const ext = path.extname(fileName.toString()).slice(1).toLowerCase();
        if (!SUBTITLE_EXTENSIONS.includes(ext as SubtitleFormat)) return;
        if (this.watchTimer) clearTimeout(this.watchTimer);
        this.watchTimer = setTimeout(() => void this.reload(), WATCH_DEBOUNCE_MS);
      });
      this.watcher.on("error", () => this.unwatch());
    } catch {
      // Some network drives do not support change notifications; rescan stays available.
      this.watcher = null;
    }
  }

  private unwatch(): void {
    if (this.watchTimer) clearTimeout(this.watchTimer);
    this.watchTimer = null;
    this.watcher?.close();
    this.watcher = null;
  }
}

function candidateFromPath(filePath: string): SubtitleCandidate {
  const fileName = path.basename(filePath);
  const format = path.extname(fileName).slice(1).toLowerCase() as SubtitleFormat;
  const stem = path.parse(fileName).name;
  const dot = stem.lastIndexOf(".");
  return { path: filePath, fileName, format, tag: dot >= 0 ? stem.slice(dot + 1) : "" };
}
