import { EventEmitter } from "node:events";
import path from "node:path";
import { app, globalShortcut } from "electron";
import { HOTKEY_ACTIONS } from "@/shared/defaults";
import type {
  AppSnapshot,
  DisplayPayload,
  HistoryLine,
  HotkeyAction,
  LangMode,
  LangRoles,
  OverlayPlacement,
  OverlayToast,
  PlaybackAction,
  PlayState,
  Settings,
} from "@/shared/types";
import { ForegroundTracker } from "./foreground";
import { PlayerMonitor } from "./player/monitor";
import { FakePlayerBridge } from "./player/fake";
import { POT_CMD_NEXT_KEYFRAME, PotPlayerBridge, type PlayerBridge } from "./player/potplayer";
import { SubtitleSession } from "./session";
import type { SettingsPatch, SettingsStore } from "./settings";
import { EMPTY_DISPLAY } from "./subtitle/compose";
import { lineAt, lineBefore, linesBefore, type LineSpan } from "./subtitle/lines";
import type { ControlWindow } from "./windows/control";
import type { OverlayWindow } from "./windows/overlay";

const SNAPSHOT_INTERVAL_MS = 120;
const LANG_MODE_CYCLE: LangMode[] = ["both", "primary", "secondary"];

/** Start a replayed line slightly early so its first syllable is not clipped. */
const REPLAY_PRE_ROLL_MS = 200;
/** Pressing "replay" again within this time steps one more line back. */
const REPLAY_CHAIN_MS = 1500;
/** Seek presses within this time add up from the previous target, not the lagging position. */
const SEEK_CHAIN_MS = 1200;
/** Stop waiting for a seek's landing after this long. */
const SEEK_SETTLE_TIMEOUT_MS = 3000;
/** Poll interval while playing, i.e. how late the first reading after a landing can be. */
const LANDING_SLACK_MS = 50;
/** Landing this much earlier than expected means PotPlayer snapped to a keyframe. */
const KEYFRAME_TOLERANCE_MS = 800;
const RECALL_SHOW_MS = 5000;
const HISTORY_SIZE = 5;
/** Audio seeks are always exact, so they say nothing about the keyframe setting. */
const AUDIO_EXTENSIONS = new Set([
  ".mp3", ".flac", ".wav", ".m4a", ".aac", ".ogg", ".opus", ".wma", ".ape", ".wv", ".tta", ".dsf", ".dff", ".mka",
]);

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export class Controller extends EventEmitter<{ roles: [] }> {
  readonly monitor: PlayerMonitor;
  readonly session: SubtitleSession;
  private readonly bridge: PlayerBridge;
  private readonly focus: ForegroundTracker;
  private position = { positionMs: 0, state: "stopped" as PlayState };
  private display = EMPTY_DISPLAY;
  private snapshotTimer: NodeJS.Timeout | null = null;
  private snapshotDirty = false;
  private hotkeyFailures: HotkeyAction[] = [];
  private snapshotListeners = new Set<(snapshot: AppSnapshot) => void>();
  /** Program whose position is being edited, fixed when edit mode starts. */
  private editApp: string | null = null;
  private lastReplay: { startMs: number; at: number } | null = null;
  private lastSeek: { targetMs: number; at: number } | null = null;
  private pendingSeek: {
    targetMs: number;
    fromMs: number;
    issuedAt: number;
    minForwardGainMs: number | null;
  } | null = null;
  /** Consecutive readings of 0 during playback (PotPlayer sometimes reports one by mistake). */
  private zeroReadings = 0;
  private keyframeSeek = false;
  private recall: { depth: number; at: number; timer: NodeJS.Timeout } | null = null;
  private toastId = 0;
  private historyCache: { key: string; lines: HistoryLine[] } | null = null;
  /** Bumped whenever something the subtitle history depends on changes. */
  private historyEpoch = 0;

  constructor(
    private readonly settings: SettingsStore,
    private readonly overlay: OverlayWindow,
    private readonly control: ControlWindow
  ) {
    super();
    const fake = process.env.POTSUB_FAKE_PLAYER;
    const bridge: PlayerBridge = fake
      ? FakePlayerBridge.fromEnv(fake)
      : new PotPlayerBridge(overlay.hwnd);
    this.bridge = bridge;
    this.monitor = new PlayerMonitor(bridge);
    this.session = new SubtitleSession(settings);
    this.focus = new ForegroundTracker((pid) => this.monitor.isPlayerPid(pid));
    this.focus.on("change", () => {
      this.applyPlacement();
      this.markDirty(true);
    });

    this.monitor.on("tick", (tick) => {
      if (this.checkSeekLanding(tick.positionMs, tick.state) === "pending") {
        // Keep showing the target until the player has really moved there.
        return;
      }
      if (this.isGlitch(tick.positionMs, tick.state)) return;
      this.position = { positionMs: tick.positionMs, state: tick.state };
      this.refreshDisplay();
      this.refreshVisibility();
      this.markDirty();
    });
    this.monitor.on("instances", (instances) => {
      this.session.setNoPlayer(instances.length > 0);
      this.markDirty();
    });
    this.monitor.on("active", () => {
      this.position = { positionMs: this.monitor.active()?.positionMs ?? 0, state: this.monitor.active()?.state ?? "stopped" };
      this.markDirty(true);
    });
    this.monitor.on("media", (mediaPath) => {
      this.keyframeSeek = false;
      this.pendingSeek = null;
      this.lastReplay = null;
      this.lastSeek = null;
      void this.session.setMedia(mediaPath);
    });
    this.monitor.on("foreground", () => this.refreshVisibility());
    this.session.on("change", () => {
      this.historyEpoch += 1;
      this.refreshDisplay();
      this.markDirty(true);
      this.emit("roles");
    });

    settings.on("change", (next, previous) => this.handleSettingsChange(next, previous));
  }


  /** WM_COPYDATA replies arrive on the overlay window. */
  handleCopyData(lParam: Buffer): void {
    this.bridge.handleCopyData(lParam);
  }

  start(): void {
    this.registerHotkeys();
    this.monitor.start();
    this.focus.start();
    this.applyPlacement();
    this.refreshVisibility();
    this.overlay.setStyle(this.settings.get().style);
  }

  stop(): void {
    globalShortcut.unregisterAll();
    this.monitor.stop();
    this.focus.stop();
    this.session.dispose();
    if (this.snapshotTimer) clearTimeout(this.snapshotTimer);
    if (this.recall) clearTimeout(this.recall.timer);
    this.settings.flush();
  }

  onSnapshot(listener: (snapshot: AppSnapshot) => void): () => void {
    this.snapshotListeners.add(listener);
    return () => this.snapshotListeners.delete(listener);
  }

  snapshot(): AppSnapshot {
    const settings = this.settings.get();
    const mediaPath = this.session.media;
    return {
      instances: this.monitor.list().map((instance) =>
        instance.id === this.monitor.currentId
          ? { ...instance, positionMs: this.position.positionMs, state: this.position.state }
          : instance
      ),
      activeId: this.monitor.currentId,
      selection: this.monitor.selection,
      status: this.session.getStatus(),
      tracks: this.session.trackInfos(),
      availableLangs: this.session.availableLangs(),
      roles: this.session.roles(settings.primaryLang),
      offsetMs: mediaPath ? (this.settings.getMedia(mediaPath)?.offsetMs ?? 0) : 0,
      display: this.display,
      overlayVisible: settings.overlayVisible,
      overlaySuppressed: this.isSuppressed(),
      editing: this.overlay.isEditing,
      history: this.history(),
      foregroundApp: this.focus.app,
      placementApp: this.placementApp(),
      keyframeSeek: this.keyframeSeek,
    };
  }

  get hotkeyStatus(): HotkeyAction[] {
    return this.hotkeyFailures;
  }

  /** QA only: run a hotkey's action without pressing it. */
  runHotkey(action: HotkeyAction): void {
    this.hotkeyHandlers()[action]();
  }

  /** QA only: pretend a program is in front (undefined = the real one). */
  simulateForeground(app: string | null | undefined): void {
    this.focus.simulate(app);
  }

  // ---- actions -----------------------------------------------------------

  updateSettings(patch: SettingsPatch): Settings {
    return this.settings.update(patch);
  }

  selectInstance(id: string | null): void {
    this.monitor.select(id);
    this.markDirty(true);
  }

  setTrackEnabled(trackPath: string, enabled: boolean): void {
    this.session.setTrackEnabled(trackPath, enabled);
  }

  async addSubtitleFile(filePath: string): Promise<void> {
    await this.session.addFile(filePath);
  }

  async rescan(): Promise<void> {
    this.monitor.refreshPath();
    await this.session.reload();
  }

  setOffset(offsetMs: number): void {
    const mediaPath = this.session.media;
    if (!mediaPath) return;
    const clamped = Math.max(-600_000, Math.min(600_000, Math.round(offsetMs)));
    this.settings.updateMedia(mediaPath, { offsetMs: clamped });
    this.refreshDisplay();
    this.markDirty(true);
  }

  nudgeOffset(direction: 1 | -1): void {
    const mediaPath = this.session.media;
    if (!mediaPath) return;
    const current = this.settings.getMedia(mediaPath)?.offsetMs ?? 0;
    this.setOffset(current + direction * this.settings.get().offsetStepMs);
  }

  toggleOverlay(): void {
    this.settings.update({ overlayVisible: !this.settings.get().overlayVisible });
  }

  cycleLangMode(): void {
    const current = this.settings.get().langMode;
    const next = LANG_MODE_CYCLE[(LANG_MODE_CYCLE.indexOf(current) + 1) % LANG_MODE_CYCLE.length];
    this.settings.update({ langMode: next });
  }

  async setEditing(editing: boolean): Promise<void> {
    if (editing && !this.overlay.isEditing) {
      const settings = this.settings.get();
      this.editApp = settings.autoPlacement ? this.focus.app : null;
      this.overlay.setEditTarget(
        this.editApp,
        Boolean(this.editApp && settings.placementProfiles[this.editApp])
      );
    }
    await this.overlay.setEditing(editing);
    if (!editing) this.applyPlacement();
    this.refreshVisibility();
    this.markDirty(true);
  }

  /** While the user records a new shortcut, our own shortcuts must not fire. */
  suspendHotkeys(suspended: boolean): void {
    if (suspended) globalShortcut.unregisterAll();
    else this.registerHotkeys();
  }

  /** Save an edited position: to the edited program's own position if it has one, else the default. */
  commitPlacement(placement: OverlayPlacement): void {
    const app = this.overlay.isEditing ? this.editApp : this.placementApp();
    if (app && this.settings.get().placementProfiles[app]) this.settings.setPlacementProfile(app, placement);
    else this.settings.update({ placement });
  }

  /**
   * While editing: give the program in front its own position (starting from
   * `placement`), or drop it so the program follows the default position again.
   */
  setAppProfile(enabled: boolean, placement: OverlayPlacement): void {
    const app = this.editApp;
    if (!app || !this.overlay.isEditing) return;
    const settings = this.settings.setPlacementProfile(app, enabled ? placement : null);
    this.overlay.setEditTarget(app, enabled);
    this.overlay.showPlacement(enabled ? placement : settings.placement);
  }

  removePlacementProfile(app: string): void {
    this.settings.setPlacementProfile(app, null);
  }

  // ---- playback ----------------------------------------------------------

  playback(action: PlaybackAction): void {
    if (action === "playPause") this.togglePlay();
    else if (action === "replayLine") this.replayLine();
    else this.seekBy(action === "seekForward" ? 1 : -1);
  }

  /** Play from a subtitle line, e.g. one picked from the recent-lines list. */
  playFromLine(startMs: number): void {
    if (!this.requirePlayer()) return;
    this.lastSeek = null;
    this.lastReplay = { startMs, at: Date.now() };
    this.seekTo(startMs + this.currentOffset() - REPLAY_PRE_ROLL_MS);
    this.toast({ kind: "replay" });
  }

  /** Bring back the previous line for a few seconds; pressing again goes further back. */
  recallLine(): void {
    const now = Date.now();
    const wanted = this.recall && now - this.recall.at < RECALL_SHOW_MS ? this.recall.depth + 1 : 1;
    const lines = this.earlierLines(wanted);
    if (lines.length === 0) {
      this.toast({ kind: "noLine" });
      return;
    }
    const depth = Math.min(wanted, lines.length);
    if (this.recall) clearTimeout(this.recall.timer);
    const timer = setTimeout(() => {
      this.recall = null;
      this.overlay.setRecall(null);
    }, RECALL_SHOW_MS);
    this.recall = { depth, at: now, timer };
    this.overlay.setRecall({ display: lines[depth - 1].display, depth });
  }

  private requirePlayer(): boolean {
    if (this.monitor.active()) return true;
    this.toast({ kind: "noPlayer" });
    return false;
  }

  private togglePlay(): void {
    if (!this.requirePlayer()) return;
    const playing = this.position.state === "playing";
    if (this.monitor.setPlaying(!playing)) this.toast({ kind: playing ? "pause" : "play" });
  }

  private replayLine(): void {
    if (!this.requirePlayer()) return;
    const tracks = this.session.enabledTracks();
    const now = Date.now();
    let line: LineSpan | null;
    if (this.lastReplay && now - this.lastReplay.at < REPLAY_CHAIN_MS) {
      // Repeated press: the player may not have reported the jump yet, so
      // step back from the line we jumped to rather than from the position.
      line = lineBefore(tracks, this.lastReplay.startMs) ?? { startMs: this.lastReplay.startMs, probeMs: 0 };
    } else {
      const time = this.position.positionMs - this.currentOffset();
      line = lineAt(tracks, time) ?? lineBefore(tracks, time);
    }
    if (!line) {
      this.toast({ kind: "noLine" });
      return;
    }
    this.lastSeek = null;
    this.lastReplay = { startMs: line.startMs, at: now };
    this.seekTo(line.startMs + this.currentOffset() - REPLAY_PRE_ROLL_MS);
    this.toast({ kind: "replay" });
  }

  private seekBy(direction: 1 | -1): void {
    const active = this.monitor.active();
    if (!active) {
      this.toast({ kind: "noPlayer" });
      return;
    }
    const step = this.settings.get().seekStepMs;
    const now = Date.now();
    const base =
      this.lastSeek && now - this.lastSeek.at < SEEK_CHAIN_MS ? this.lastSeek.targetMs : this.position.positionMs;
    const max = active.durationMs > 0 ? Math.max(0, active.durationMs - 1000) : Number.MAX_SAFE_INTEGER;
    const target = clamp(base + direction * step, 0, max);
    this.lastReplay = null;
    this.lastSeek = { targetMs: target, at: now };
    this.seekTo(target, direction > 0 ? step / 2 : null);
    this.toast({ kind: direction > 0 ? "forward" : "back", seconds: step / 1000 });
  }

  /**
   * Jump, then (see checkSeekLanding) check where PotPlayer landed. With
   * PotPlayer's "seek by keyframe" option on, video seeks land on the
   * previous keyframe: harmless when going back, but a forward jump can end
   * up behind where it started, or barely ahead of it, so when it gains less
   * than `minForwardGainMs` it moves on to the next keyframe.
   */
  private seekTo(targetMs: number, minForwardGainMs: number | null = null): void {
    const target = Math.max(0, Math.round(targetMs));
    const fromMs = this.position.positionMs;
    if (!this.monitor.seek(target)) return;
    const issuedAt = Date.now();
    // Show the subtitle of the new position at once instead of after the player reports it.
    this.position = { ...this.position, positionMs: target };
    this.refreshDisplay();
    this.markDirty(true);

    this.pendingSeek = { targetMs: target, fromMs, issuedAt, minForwardGainMs };
  }

  /**
   * Called on every poll after a seek, to find where PotPlayer really landed.
   * Until it has, its readings are unreliable: still the old position, the
   * requested time itself, a stray 0, or a "stopped" status. Those readings
   * are "pending" and the target keeps being shown.
   */
  private checkSeekLanding(positionMs: number, state: PlayState): "pending" | "landed" | "none" {
    const seek = this.pendingSeek;
    if (!seek) return "none";
    const age = Date.now() - seek.issuedAt;
    if (age > SEEK_SETTLE_TIMEOUT_MS) {
      // e.g. an exact seek while paused: the reading simply stays at the target.
      this.pendingSeek = null;
      return "none";
    }
    const elapsed = state === "playing" ? age : 0;
    const pending =
      state === "stopped" ||
      positionMs === seek.targetMs ||
      (positionMs === 0 && seek.targetMs > 1500) ||
      // Still the old position, frozen or running on as if nothing happened.
      (Math.abs(seek.targetMs - seek.fromMs) > 600 &&
        (Math.abs(positionMs - seek.fromMs) < 400 || Math.abs(positionMs - (seek.fromMs + elapsed)) < 400));
    if (pending) return "pending";
    this.pendingSeek = null;

    // While playing, the first new reading comes a little after the landing.
    const landed = state === "playing" ? positionMs - LANDING_SLACK_MS : positionMs;
    const media = this.monitor.active()?.mediaPath ?? "";
    // A precise-looking landing proves nothing (it may be near a keyframe by
    // chance), so a detection stays until the next file.
    const audio = AUDIO_EXTENSIONS.has(path.extname(media).toLowerCase());
    if (!audio && !this.keyframeSeek && seek.targetMs - landed > KEYFRAME_TOLERANCE_MS) {
      this.keyframeSeek = true;
      this.markDirty(true);
    }
    // Skipped when the target itself is that close (e.g. clamped at the end).
    const gainWanted = seek.minForwardGainMs;
    if (gainWanted !== null && seek.targetMs - seek.fromMs > gainWanted && landed - seek.fromMs < gainWanted) {
      this.pendingSeek = { targetMs: -1, fromMs: landed, issuedAt: Date.now(), minForwardGainMs: null };
      this.monitor.command(POT_CMD_NEXT_KEYFRAME);
    }
    return "landed";
  }

  /** A single 0 in the middle of playback is a misreading; two in a row are real. */
  private isGlitch(positionMs: number, state: PlayState): boolean {
    if (positionMs !== 0 || state !== "playing" || this.position.positionMs < 1500) {
      this.zeroReadings = 0;
      return false;
    }
    this.zeroReadings += 1;
    return this.zeroReadings < 2;
  }

  private toast(toast: Omit<OverlayToast, "id">): void {
    this.toastId += 1;
    this.overlay.toast({ ...toast, id: this.toastId });
  }

  // ---- internals ---------------------------------------------------------

  private handleSettingsChange(next: Settings, previous: Settings): void {
    if (next.style !== previous.style) this.overlay.setStyle(next.style);
    if (
      next.placement !== previous.placement ||
      next.placementProfiles !== previous.placementProfiles ||
      next.autoPlacement !== previous.autoPlacement
    ) {
      this.applyPlacement();
    }
    if (
      next.langMode !== previous.langMode ||
      next.langOrder !== previous.langOrder ||
      next.primaryLang !== previous.primaryLang
    ) {
      this.historyEpoch += 1;
    }
    if (next.hotkeys !== previous.hotkeys) this.registerHotkeys();
    if (next.compactAlwaysOnTop !== previous.compactAlwaysOnTop) this.control.refreshAlwaysOnTop();
    if (next.launchAtLogin !== previous.launchAtLogin) {
      app.setLoginItemSettings({ openAtLogin: next.launchAtLogin, args: ["--hidden"] });
    }
    if (
      next.filterSigns !== previous.filterSigns ||
      next.preferVariant !== previous.preferVariant ||
      next.primaryLang !== previous.primaryLang
    ) {
      void this.session.reload();
    }
    this.refreshDisplay();
    this.refreshVisibility();
    this.markDirty(true);
    this.control.send("settings:changed", next);
  }

  /** Languages of the current subtitle, used by the tray and the overlay sample. */
  get roles(): LangRoles {
    return this.session.roles(this.settings.get().primaryLang);
  }

  private currentOffset(): number {
    const mediaPath = this.session.media;
    return mediaPath ? (this.settings.getMedia(mediaPath)?.offsetMs ?? 0) : 0;
  }

  private composeAt(timeMs: number): DisplayPayload {
    const settings = this.settings.get();
    return this.session.compose(timeMs, settings.langMode, settings.langOrder, settings.primaryLang);
  }

  /** Lines before the one on screen (or before now, between lines), newest first. */
  private earlierLines(count: number) {
    const tracks = this.session.enabledTracks();
    if (tracks.length === 0 || !this.monitor.active()?.mediaPath) return [];
    const time = this.position.positionMs - this.currentOffset();
    const anchor = lineAt(tracks, time)?.startMs ?? time;
    return linesBefore(tracks, anchor, count, (t) => this.composeAt(t), this.display.key);
  }

  /** The current line and the ones before it, oldest first; cached per line. */
  private history(): HistoryLine[] {
    const tracks = this.session.enabledTracks();
    if (tracks.length === 0 || !this.monitor.active()?.mediaPath) return [];
    const time = this.position.positionMs - this.currentOffset();
    const current = lineAt(tracks, time);
    const anchor = current?.startMs ?? lineBefore(tracks, time)?.startMs ?? -1;
    const key = `${this.historyEpoch}|${anchor}|${this.display.key}`;
    if (this.historyCache?.key === key) return this.historyCache.lines;

    const showingCurrent = Boolean(current && this.display.blocks.length > 0);
    const lines: HistoryLine[] = linesBefore(
      tracks,
      current?.startMs ?? time,
      showingCurrent ? HISTORY_SIZE - 1 : HISTORY_SIZE,
      (t) => this.composeAt(t),
      this.display.key
    )
      .reverse()
      .map((line) => ({ key: line.display.key, startMs: line.startMs, blocks: line.display.blocks, current: false }));
    if (current && showingCurrent) {
      lines.push({ key: this.display.key, startMs: current.startMs, blocks: this.display.blocks, current: true });
    }
    this.historyCache = { key, lines };
    return lines;
  }

  /** The program whose own position applies right now, if any. */
  private placementApp(): string | null {
    const settings = this.settings.get();
    const app = this.focus.app;
    return settings.autoPlacement && app && settings.placementProfiles[app] ? app : null;
  }

  private applyPlacement(): void {
    // While editing, the edit surface owns the position.
    if (this.overlay.isEditing) return;
    const app = this.placementApp();
    const settings = this.settings.get();
    this.overlay.setPlacement(app ? settings.placementProfiles[app].placement : settings.placement);
  }

  private refreshDisplay(): void {
    const settings = this.settings.get();
    // Positive offset delays subtitles: look further back in the file.
    const time = this.position.positionMs - this.currentOffset();
    const hasMedia = Boolean(this.monitor.active()?.mediaPath);
    this.display = hasMedia
      ? this.session.compose(time, settings.langMode, settings.langOrder, settings.primaryLang)
      : EMPTY_DISPLAY;
    this.overlay.setDisplay(this.display);
  }

  private isSuppressed(): boolean {
    const settings = this.settings.get();
    if (settings.hideWhenPlayerForeground && this.monitor.isPlayerForeground) return true;
    if (settings.hideWhenPaused && this.position.state === "paused") return true;
    return false;
  }

  private refreshVisibility(): void {
    const visible =
      this.overlay.isEditing || (this.settings.get().overlayVisible && !this.isSuppressed());
    this.overlay.setVisible(visible);
  }

  private hotkeyHandlers(): Record<HotkeyAction, () => void> {
    return {
      toggleOverlay: () => this.toggleOverlay(),
      toggleEdit: () => void this.setEditing(!this.overlay.isEditing),
      cycleLangMode: () => this.cycleLangMode(),
      offsetBackward: () => this.nudgeOffset(-1),
      offsetForward: () => this.nudgeOffset(1),
      recallLine: () => this.recallLine(),
      playPause: () => this.playback("playPause"),
      replayLine: () => this.playback("replayLine"),
      seekBackward: () => this.playback("seekBackward"),
      seekForward: () => this.playback("seekForward"),
    };
  }

  private registerHotkeys(): void {
    globalShortcut.unregisterAll();
    const hotkeys = this.settings.get().hotkeys;
    const handlers = this.hotkeyHandlers();
    this.hotkeyFailures = [];
    for (const action of HOTKEY_ACTIONS) {
      const accelerator = hotkeys[action];
      if (!accelerator) continue;
      try {
        if (!globalShortcut.register(accelerator, handlers[action])) {
          this.hotkeyFailures.push(action);
        }
      } catch {
        this.hotkeyFailures.push(action);
      }
    }
    this.control.send("hotkeys:status", this.hotkeyFailures);
  }

  /** Throttle snapshots to the control panel; structural changes go out promptly. */
  private markDirty(urgent = false): void {
    this.snapshotDirty = true;
    if (urgent && this.snapshotTimer) {
      clearTimeout(this.snapshotTimer);
      this.snapshotTimer = null;
    }
    if (this.snapshotTimer) return;
    this.snapshotTimer = setTimeout(
      () => {
        this.snapshotTimer = null;
        if (!this.snapshotDirty) return;
        this.snapshotDirty = false;
        if (this.snapshotListeners.size === 0) return;
        const snapshot = this.snapshot();
        for (const listener of this.snapshotListeners) listener(snapshot);
      },
      urgent ? 0 : SNAPSHOT_INTERVAL_MS
    );
  }
}
