import { BrowserWindow, ipcMain, screen, type Display, type Rectangle } from "electron";
import { motionBleed } from "@/shared/motion";
import type {
  DisplayPayload,
  OverlayModeMessage,
  OverlayPlacement,
  OverlayRecall,
  OverlayStyle,
  OverlayToast,
} from "@/shared/types";
import { disableWindowTransitions } from "../win32/dwmapi";
import { handleFromBuffer, WM_COPYDATA } from "../win32/user32";

const TOPMOST_REASSERT_MS = 3000;
/** Give up waiting for the page to fade out (e.g. it has not loaded yet). */
const PREPARE_TIMEOUT_MS = 450;
/** Window heights are rounded up to this step so style tweaks rarely resize the window. */
const HEIGHT_STEP = 40;

export interface OverlayWindowOptions {
  preload: string;
  load: (win: BrowserWindow) => Promise<void>;
  onCopyData: (lParam: Buffer) => void;
}

export function resolveDisplay(displayId: number | null): Display {
  const displays = screen.getAllDisplays();
  return displays.find((display) => display.id === displayId) ?? screen.getPrimaryDisplay();
}

/** Height that fits two primary and two secondary lines plus effects. */
export function overlayHeight(style: OverlayStyle): number {
  const primary = style.primary.fontSize;
  const secondary = style.secondary.fontSize;
  const pad = style.background === "box" ? 24 : 0;
  return Math.ceil(
    primary * 1.45 * 2 +
      secondary * 1.45 * 2 +
      style.blockGap +
      style.lineGap * 4 +
      style.outlineWidth * 4 +
      style.shadowBlur * 2 +
      pad +
      32
  );
}

/**
 * Room above the live subtitles for a recalled line (shown smaller, with a
 * label) and the notice after a playback hotkey. The window is transparent
 * and click-through, so the extra height costs nothing.
 */
export function recallReserve(style: OverlayStyle): number {
  const scale = 0.82;
  return Math.ceil(
    28 + scale * (style.primary.fontSize * 1.35 * 2 + style.secondary.fontSize * 1.35 + style.blockGap)
  );
}

/**
 * Window bounds for the live subtitles. The subtitles sit `bottomInset`
 * above the window's bottom edge; that room lets a line slide in from below
 * (or blur) without being cut off, and is only taken where the display has it.
 */
export function normalLayout(
  placement: OverlayPlacement,
  style: OverlayStyle
): { bounds: Rectangle; bottomInset: number } {
  const area = resolveDisplay(placement.displayId).bounds;
  const width = Math.round(area.width * placement.width);
  const centerX = area.x + area.width * placement.x;
  const bottom = Math.round(area.y + area.height * placement.y);
  const wanted = Math.ceil((overlayHeight(style) + recallReserve(style)) / HEIGHT_STEP) * HEIGHT_STEP;
  // Near the top of the display the window gets shorter rather than pushed down.
  const above = Math.max(1, Math.min(wanted, Math.round(area.height * 0.7), bottom - area.y));
  const bottomInset = Math.max(0, Math.min(motionBleed(style.motion), area.y + area.height - bottom));
  const x = Math.round(Math.min(Math.max(centerX - width / 2, area.x), area.x + area.width - width));
  const y = Math.max(area.y, bottom - above);
  return { bounds: { x, y, width, height: bottom + bottomInset - y }, bottomInset };
}

const sameBounds = (a: Rectangle, b: Rectangle) =>
  Math.abs(a.x - b.x) <= 1 &&
  Math.abs(a.y - b.y) <= 1 &&
  Math.abs(a.width - b.width) <= 1 &&
  Math.abs(a.height - b.height) <= 1;

/**
 * The transparent, click-through subtitle window. In edit mode it grows to
 * cover its display and becomes interactive so the subtitle can be dragged.
 *
 * The window stays shown for the app's lifetime; "hiding" the subtitles is a
 * fade inside the page. Real hide/show goes through the shell's window
 * animation and Chromium's stale first frame, which made toggling stutter.
 *
 * Moving or resizing the window while text is on screen shows a frame or two
 * of the old content at the new size, so such changes run "hidden" (see
 * runHidden): the page fades out, the window changes, and the page fades back
 * in once it has laid out at the new size.
 */
export class OverlayWindow {
  readonly win: BrowserWindow;
  /** Mode asked for; `shownEditing` is the mode the window is in (they differ during a switch). */
  private editing = false;
  private shownEditing = false;
  private visible = false;
  private placement: OverlayPlacement;
  private style: OverlayStyle;
  private topmostTimer: NodeJS.Timeout;
  private lastDisplay: DisplayPayload = { key: "", blocks: [] };
  private locale = "zh";
  private sampleLangs: OverlayModeMessage["sampleLangs"] = ["zh", "en"];
  private editTarget: { app: string | null; hasProfile: boolean } = { app: null, hasProfile: false };
  private hiddenQueue: Promise<void> = Promise.resolve();
  private prepareId = 0;
  private prepared = new Map<number, () => void>();

  constructor(options: OverlayWindowOptions, placement: OverlayPlacement, style: OverlayStyle) {
    this.placement = placement;
    this.style = style;
    this.win = new BrowserWindow({
      ...normalLayout(placement, style).bounds,
      show: false,
      frame: false,
      transparent: true,
      backgroundColor: "#00000000",
      hasShadow: false,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      focusable: false,
      alwaysOnTop: true,
      // WS_EX_TOOLWINDOW: keeps the overlay out of Alt+Tab.
      type: "toolbar",
      title: "PotSubOverlay Subtitle",
      webPreferences: {
        preload: options.preload,
        backgroundThrottling: false,
        spellcheck: false,
      },
    });
    this.win.setAlwaysOnTop(true, "screen-saver");
    this.win.setIgnoreMouseEvents(true);
    disableWindowTransitions(this.hwnd);
    this.win.hookWindowMessage(WM_COPYDATA, (_wParam, lParam) => options.onCopyData(lParam));
    this.win.webContents.on("did-finish-load", () => this.pushAll());
    // The page asks for everything once its listeners exist; pushes sent
    // before React mounted (e.g. on did-finish-load) can be missed.
    ipcMain.handle("overlay:state", (event) =>
      event.sender === this.win.webContents
        ? {
            visible: this.visible,
            style: this.style,
            mode: this.modeMessage(),
            display: this.lastDisplay,
          }
        : null
    );
    ipcMain.handle("overlay:prepared", (event, id: number) => {
      if (event.sender === this.win.webContents) this.prepared.get(id)?.();
    });
    void options.load(this.win);

    this.topmostTimer = setInterval(() => {
      if (!this.win.isDestroyed()) this.win.setAlwaysOnTop(true, "screen-saver");
    }, TOPMOST_REASSERT_MS);

    screen.on("display-metrics-changed", this.handleDisplayChange);
    screen.on("display-removed", this.handleDisplayChange);
    screen.on("display-added", this.handleDisplayChange);
  }

  get hwnd(): bigint {
    return handleFromBuffer(this.win.getNativeWindowHandle());
  }

  /** The requested mode, which the window may still be switching to. */
  get isEditing(): boolean {
    return this.editing;
  }

  setVisible(visible: boolean): void {
    if (this.win.isDestroyed()) return;
    if (!this.win.isVisible()) {
      this.win.showInactive();
      this.win.setAlwaysOnTop(true, "screen-saver");
    }
    if (visible === this.visible) return;
    this.visible = visible;
    this.send("overlay:visible", visible);
  }

  setDisplay(payload: DisplayPayload): void {
    if (payload.key === this.lastDisplay.key) return;
    this.lastDisplay = payload;
    this.send("overlay:display", payload);
  }

  /** Languages for the edit-mode sample when nothing is playing. */
  setSampleLangs(langs: OverlayModeMessage["sampleLangs"]): void {
    if (langs[0] === this.sampleLangs[0] && langs[1] === this.sampleLangs[1]) return;
    this.sampleLangs = langs;
    if (this.editing) this.send("overlay:mode", this.modeMessage());
  }

  setLocale(locale: string): void {
    if (locale === this.locale) return;
    this.locale = locale;
    this.send("overlay:mode", this.modeMessage());
  }

  setStyle(style: OverlayStyle): void {
    this.style = style;
    this.send("overlay:style", style);
    // Usually the same bounds; a size change keeps the bottom edge, so no fade.
    if (!this.shownEditing) this.applyBounds(false);
  }

  /** Program the position being edited can be remembered for. */
  setEditTarget(app: string | null, hasProfile: boolean): void {
    this.editTarget = { app, hasProfile };
    if (this.editing) this.send("overlay:mode", this.modeMessage());
  }

  /** Replace the position shown in edit mode (e.g. after switching to the default position). */
  showPlacement(placement: OverlayPlacement): void {
    this.setPlacement(placement);
    if (this.editing) this.send("overlay:mode", this.modeMessage());
  }

  setRecall(recall: OverlayRecall | null): void {
    this.send("overlay:recall", recall);
  }

  toast(toast: OverlayToast): void {
    this.send("overlay:toast", toast);
  }

  setPlacement(placement: OverlayPlacement): void {
    const displayChanged = placement.displayId !== this.placement.displayId;
    this.placement = placement;
    if (!this.editing) this.applyBounds(true);
    else if (displayChanged) void this.runHidden(() => this.win.setBounds(this.editBounds()));
  }

  /**
   * Switch between the live subtitles and the full-display edit surface.
   * @param placement Where the live subtitles go when editing ends (the position just edited).
   */
  async setEditing(editing: boolean, placement?: OverlayPlacement): Promise<void> {
    if (placement) this.placement = placement;
    if (editing === this.editing) return;
    this.editing = editing;
    await this.runHidden(() => {
      // A later call may have reversed the request while this one waited.
      if (this.editing !== editing) return;
      this.shownEditing = editing;
      if (editing) {
        this.win.setBounds(this.editBounds());
        this.win.setIgnoreMouseEvents(false);
        this.win.setFocusable(true);
        this.win.showInactive();
        this.win.focus();
      } else {
        this.win.setIgnoreMouseEvents(true);
        this.win.setFocusable(false);
        this.win.setBounds(normalLayout(this.placement, this.style).bounds);
      }
      this.win.setAlwaysOnTop(true, "screen-saver");
    });
  }

  destroy(): void {
    ipcMain.removeHandler("overlay:state");
    ipcMain.removeHandler("overlay:prepared");
    for (const done of [...this.prepared.values()]) done();
    clearInterval(this.topmostTimer);
    screen.off("display-metrics-changed", this.handleDisplayChange);
    screen.off("display-removed", this.handleDisplayChange);
    screen.off("display-added", this.handleDisplayChange);
    if (!this.win.isDestroyed()) this.win.destroy();
  }

  /**
   * Fade the page out, apply `change` while nothing is visible, then let the
   * page fade back in at the new size. Changes run one after another; the
   * page answers `overlay:prepare` once its fade has finished and a fully
   * transparent frame is on screen.
   */
  private runHidden(change: () => void): Promise<void> {
    const run = async () => {
      if (this.win.isDestroyed()) return;
      const id = ++this.prepareId;
      await new Promise<void>((resolve) => {
        const done = () => {
          clearTimeout(timer);
          this.prepared.delete(id);
          resolve();
        };
        const timer = setTimeout(done, PREPARE_TIMEOUT_MS);
        this.prepared.set(id, done);
        this.send("overlay:prepare", id);
      });
      if (this.win.isDestroyed()) return;
      change();
      this.send("overlay:mode", this.modeMessage(id));
    };
    this.hiddenQueue = this.hiddenQueue.then(run, run);
    return this.hiddenQueue;
  }

  private editBounds(): Rectangle {
    return resolveDisplay(this.placement.displayId).bounds;
  }

  /** @param fadeIfMoved Take visible subtitles out of sight while the window moves (see runHidden). */
  private applyBounds(fadeIfMoved: boolean): void {
    if (this.win.isDestroyed()) return;
    const next = normalLayout(this.placement, this.style).bounds;
    const current = this.win.getBounds();
    if (sameBounds(next, current)) {
      this.send("overlay:mode", this.modeMessage());
      return;
    }
    const moved =
      Math.abs(next.x - current.x) > 1 ||
      Math.abs(next.width - current.width) > 1 ||
      Math.abs(next.y + next.height - (current.y + current.height)) > 1;
    if (fadeIfMoved && moved && this.visible) {
      // Worked out again when the change runs, in case more changes came in meanwhile.
      void this.runHidden(() => {
        if (!this.shownEditing) this.win.setBounds(normalLayout(this.placement, this.style).bounds);
      });
      return;
    }
    this.win.setBounds(next);
    this.send("overlay:mode", this.modeMessage());
  }

  private modeMessage(reveal: number | null = null): OverlayModeMessage {
    const [width, height] = this.win.getContentSize();
    const primaryId = screen.getPrimaryDisplay().id;
    return {
      editing: this.shownEditing,
      viewport: { width, height },
      bottomInset: this.shownEditing ? 0 : normalLayout(this.placement, this.style).bottomInset,
      reveal,
      placement: this.placement,
      displays: screen.getAllDisplays().map((display, index) => ({
        id: display.id,
        label: display.label || `Display ${index + 1}`,
        primary: display.id === primaryId,
      })),
      locale: this.locale,
      sampleLangs: this.sampleLangs,
      app: this.editTarget.app,
      appHasProfile: this.editTarget.hasProfile,
    };
  }

  private pushAll(): void {
    this.send("overlay:visible", this.visible);
    this.send("overlay:style", this.style);
    this.send("overlay:mode", this.modeMessage());
    this.send("overlay:display", this.lastDisplay);
  }

  private send(channel: string, ...args: unknown[]): void {
    if (!this.win.isDestroyed()) this.win.webContents.send(channel, ...args);
  }

  private handleDisplayChange = () => {
    if (this.shownEditing) {
      this.win.setBounds(this.editBounds());
      this.send("overlay:mode", this.modeMessage());
    } else {
      this.applyBounds(false);
    }
  };
}
