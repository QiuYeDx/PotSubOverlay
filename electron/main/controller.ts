import { app, globalShortcut } from "electron";
import { HOTKEY_ACTIONS } from "@/shared/defaults";
import type {
  AppSnapshot,
  HotkeyAction,
  LangMode,
  OverlayPlacement,
  PlayState,
  Settings,
} from "@/shared/types";
import { PlayerMonitor } from "./player/monitor";
import { FakePlayerBridge } from "./player/fake";
import { PotPlayerBridge, type PlayerBridge } from "./player/potplayer";
import { SubtitleSession } from "./session";
import type { SettingsPatch, SettingsStore } from "./settings";
import { EMPTY_DISPLAY } from "./subtitle/compose";
import type { ControlWindow } from "./windows/control";
import type { OverlayWindow } from "./windows/overlay";

const SNAPSHOT_INTERVAL_MS = 120;
const LANG_MODE_CYCLE: LangMode[] = ["both", "zh", "ja"];

export class Controller {
  readonly monitor: PlayerMonitor;
  readonly session: SubtitleSession;
  private readonly bridge: PlayerBridge;
  private position = { positionMs: 0, state: "stopped" as PlayState };
  private display = EMPTY_DISPLAY;
  private snapshotTimer: NodeJS.Timeout | null = null;
  private snapshotDirty = false;
  private hotkeyFailures: HotkeyAction[] = [];
  private listeners = new Set<(snapshot: AppSnapshot) => void>();

  constructor(
    private readonly settings: SettingsStore,
    private readonly overlay: OverlayWindow,
    private readonly control: ControlWindow
  ) {
    const fake = process.env.POTSUB_FAKE_PLAYER;
    const bridge: PlayerBridge = fake
      ? FakePlayerBridge.fromEnv(fake)
      : new PotPlayerBridge(overlay.hwnd);
    this.bridge = bridge;
    this.monitor = new PlayerMonitor(bridge);
    this.session = new SubtitleSession(settings);

    this.monitor.on("tick", (tick) => {
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
    this.monitor.on("media", (mediaPath) => void this.session.setMedia(mediaPath));
    this.monitor.on("foreground", () => this.refreshVisibility());
    this.session.on("change", () => {
      this.refreshDisplay();
      this.markDirty(true);
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
    this.refreshVisibility();
    this.overlay.setStyle(this.settings.get().style);
  }

  stop(): void {
    globalShortcut.unregisterAll();
    this.monitor.stop();
    this.session.dispose();
    if (this.snapshotTimer) clearTimeout(this.snapshotTimer);
    this.settings.flush();
  }

  onSnapshot(listener: (snapshot: AppSnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
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
      offsetMs: mediaPath ? (this.settings.getMedia(mediaPath)?.offsetMs ?? 0) : 0,
      display: this.display,
      overlayVisible: settings.overlayVisible,
      overlaySuppressed: this.isSuppressed(),
      editing: this.overlay.isEditing,
    };
  }

  get hotkeyStatus(): HotkeyAction[] {
    return this.hotkeyFailures;
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
    await this.overlay.setEditing(editing);
    this.refreshVisibility();
    this.markDirty(true);
  }

  /** While the user records a new shortcut, our own shortcuts must not fire. */
  suspendHotkeys(suspended: boolean): void {
    if (suspended) globalShortcut.unregisterAll();
    else this.registerHotkeys();
  }

  commitPlacement(placement: OverlayPlacement): void {
    this.settings.update({ placement });
  }

  // ---- internals ---------------------------------------------------------

  private handleSettingsChange(next: Settings, previous: Settings): void {
    if (next.style !== previous.style) this.overlay.setStyle(next.style);
    if (next.placement !== previous.placement) this.overlay.setPlacement(next.placement);
    if (next.hotkeys !== previous.hotkeys) this.registerHotkeys();
    if (next.compactAlwaysOnTop !== previous.compactAlwaysOnTop) this.control.refreshAlwaysOnTop();
    if (next.launchAtLogin !== previous.launchAtLogin) {
      app.setLoginItemSettings({ openAtLogin: next.launchAtLogin, args: ["--hidden"] });
    }
    if (next.filterSigns !== previous.filterSigns || next.preferVariant !== previous.preferVariant) {
      void this.session.reload();
    }
    this.refreshDisplay();
    this.refreshVisibility();
    this.markDirty(true);
    this.control.send("settings:changed", next);
  }

  private refreshDisplay(): void {
    const settings = this.settings.get();
    const mediaPath = this.session.media;
    const offset = mediaPath ? (this.settings.getMedia(mediaPath)?.offsetMs ?? 0) : 0;
    // Positive offset delays subtitles: look further back in the file.
    const time = this.position.positionMs - offset;
    const hasMedia = Boolean(this.monitor.active()?.mediaPath);
    this.display = hasMedia
      ? this.session.compose(time, settings.langMode, settings.langOrder)
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

  private registerHotkeys(): void {
    globalShortcut.unregisterAll();
    const hotkeys = this.settings.get().hotkeys;
    const handlers: Record<HotkeyAction, () => void> = {
      toggleOverlay: () => this.toggleOverlay(),
      toggleEdit: () => void this.setEditing(!this.overlay.isEditing),
      cycleLangMode: () => this.cycleLangMode(),
      offsetBackward: () => this.nudgeOffset(-1),
      offsetForward: () => this.nudgeOffset(1),
    };
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
        if (this.listeners.size === 0) return;
        const snapshot = this.snapshot();
        for (const listener of this.listeners) listener(snapshot);
      },
      urgent ? 0 : SNAPSHOT_INTERVAL_MS
    );
  }
}
