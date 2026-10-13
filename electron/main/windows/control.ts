import { BrowserWindow, screen, shell, type Rectangle } from "electron";
import { disableWindowTransitions } from "../win32/dwmapi";
import { handleFromBuffer } from "../win32/user32";

export const FULL_SIZE = { width: 980, height: 700, minWidth: 820, minHeight: 580 };
/** The compact panel itself; its window adds `COMPACT_SHADOW_MARGIN` on every side. */
export const COMPACT_SIZE = { width: 392, height: 212 };
/** Transparent margin the compact page leaves around the panel for its shadow (`p-3` there). */
const COMPACT_SHADOW_MARGIN = 12;
const MODE_SWITCH_DELAY_MS = 140;
/** How long a first switch waits for the compact page to load before showing it anyway. */
const COMPACT_READY_TIMEOUT_MS = 3000;
const START_LOADING_PROGRESS_CHANNEL = "qiuye-template-start-loading-progress";

export interface ControlWindowOptions {
  preload: string;
  icon: string;
  load: (win: BrowserWindow) => Promise<void>;
  /** Load the page in its compact layout (`index.html?view=compact`). */
  loadCompact: (win: BrowserWindow) => Promise<void>;
  /** Return true to hide instead of closing. */
  shouldHideOnClose: () => boolean;
  compactAlwaysOnTop: () => boolean;
  onHiddenToTray?: () => void;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The control panel: a normal window for the full layout, and a separate
 * frameless, transparent window for the compact "mini player". Windows draws
 * every framed window with the same small corner radius, so the compact
 * panel paints its own larger, smooth corners. Switching hides one window
 * and shows the other; the full window keeps its bounds and maximized state.
 */
export class ControlWindow {
  /** The full window. */
  win: BrowserWindow | null = null;
  private compactWin: BrowserWindow | null = null;
  private compactReady: Promise<void> | null = null;
  private compact = false;
  private switching = false;
  private quitting = false;

  constructor(private readonly options: ControlWindowOptions) {}

  get isCompact(): boolean {
    return this.compact;
  }

  /** The window the user is working with: the compact panel while compact, else the full window. */
  get activeWin(): BrowserWindow | null {
    const win = this.compact ? this.compactWin : this.win;
    return win && !win.isDestroyed() ? win : null;
  }

  /** The compact window, if it has been created (it is kept, hidden, after the first use). */
  get compactWindow(): BrowserWindow | null {
    return this.compactWin && !this.compactWin.isDestroyed() ? this.compactWin : null;
  }

  get isVisible(): boolean {
    const win = this.activeWin;
    return Boolean(win && win.isVisible() && !win.isMinimized());
  }

  markQuitting(): void {
    this.quitting = true;
  }

  show(): void {
    if (!this.win || this.win.isDestroyed()) {
      this.create();
      return;
    }
    const win = this.activeWin ?? this.win;
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  }

  /** Send to every control page (full and compact): both keep settings and status. */
  send(channel: string, ...args: unknown[]): void {
    for (const win of [this.win, this.compactWin]) {
      if (win && !win.isDestroyed()) win.webContents.send(channel, ...args);
    }
  }

  /** Send to the page in use only; the other one refreshes when it is shown again. */
  sendActive(channel: string, ...args: unknown[]): void {
    this.activeWin?.webContents.send(channel, ...args);
  }

  async setCompact(compact: boolean): Promise<void> {
    const full = this.win;
    if (!full || full.isDestroyed() || compact === this.compact || this.switching) return;
    this.switching = true;
    try {
      // The page being left fades out while the other one gets ready.
      this.activeWin?.webContents.send("window:compact-prepare", compact);
      if (compact) this.ensureCompactWindow();
      await Promise.all([delay(MODE_SWITCH_DELAY_MS), compact ? this.compactReady : null]);
      if (full.isDestroyed()) return;

      const panel = this.compactWindow;
      if (compact) {
        if (!panel) {
          full.webContents.send("window:compact", false);
          return;
        }
        this.compact = true;
        panel.setBounds(this.compactBounds(full.getBounds()));
        panel.setAlwaysOnTop(this.options.compactAlwaysOnTop(), "floating");
        panel.show();
        panel.focus();
        full.hide();
      } else {
        this.compact = false;
        if (full.isMinimized()) full.restore();
        full.show();
        full.focus();
        panel?.hide();
      }
      this.sendActive("window:compact", compact);
    } finally {
      this.switching = false;
    }
  }

  refreshAlwaysOnTop(): void {
    if (this.compact) this.compactWindow?.setAlwaysOnTop(this.options.compactAlwaysOnTop(), "floating");
  }

  create(showOnReady = true): void {
    const win = new BrowserWindow({
      title: "PotSubOverlay",
      icon: this.options.icon,
      width: FULL_SIZE.width,
      height: FULL_SIZE.height,
      minWidth: FULL_SIZE.minWidth,
      minHeight: FULL_SIZE.minHeight,
      show: false,
      titleBarStyle: "hidden",
      webPreferences: {
        preload: this.options.preload,
      },
    });
    this.win = win;
    this.compact = false;

    // The preload loading screen starts its progress once the window is visible.
    const startLoadingProgress = () => {
      if (!win.isDestroyed()) win.webContents.send(START_LOADING_PROGRESS_CHANNEL);
    };
    win.once("ready-to-show", () => {
      if (showOnReady && !win.isDestroyed()) win.show();
    });
    win.on("show", startLoadingProgress);
    win.webContents.on("dom-ready", () => {
      if (win.isVisible()) startLoadingProgress();
    });

    win.on("close", (event) => {
      if (!this.quitting && this.options.shouldHideOnClose()) {
        event.preventDefault();
        win.hide();
        this.options.onHiddenToTray?.();
      }
    });
    win.on("closed", () => {
      if (this.win !== win) return;
      this.win = null;
      // Reopening starts in the full layout, as before.
      this.compact = false;
      this.compactWindow?.destroy();
    });

    this.denyWindowOpen(win);
    void this.options.load(win);
  }

  private ensureCompactWindow(): void {
    if (this.compactWindow) return;
    const win = new BrowserWindow({
      title: "PotSubOverlay",
      icon: this.options.icon,
      width: COMPACT_SIZE.width + COMPACT_SHADOW_MARGIN * 2,
      height: COMPACT_SIZE.height + COMPACT_SHADOW_MARGIN * 2,
      show: false,
      frame: false,
      transparent: true,
      backgroundColor: "#00000000",
      hasShadow: false,
      resizable: false,
      maximizable: false,
      fullscreenable: false,
      webPreferences: {
        preload: this.options.preload,
      },
    });
    // The page fades itself in; the shell's own show animation would fight it.
    disableWindowTransitions(handleFromBuffer(win.getNativeWindowHandle()));
    this.compactWin = win;
    // The page says when its listeners are in place, so the fade-in message is not lost.
    this.compactReady = new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, COMPACT_READY_TIMEOUT_MS);
      win.webContents.ipc.once("window:compact-ready", () => {
        clearTimeout(timer);
        resolve();
      });
      win.once("closed", () => {
        clearTimeout(timer);
        resolve();
      });
    });

    win.on("close", (event) => {
      if (this.quitting) return;
      event.preventDefault();
      win.hide();
      if (this.options.shouldHideOnClose()) {
        this.options.onHiddenToTray?.();
        return;
      }
      // Like closing the full window: it goes away and the next open starts full.
      this.compact = false;
      this.win?.close();
    });
    win.on("closed", () => {
      if (this.compactWin !== win) return;
      this.compactWin = null;
      this.compactReady = null;
    });

    this.denyWindowOpen(win);
    void this.options.loadCompact(win);
  }

  /** Put the panel's top-right corner where the full window's was, inside the work area. */
  private compactBounds(anchor: Rectangle): Rectangle {
    const area = screen.getDisplayMatching(anchor).workArea;
    const { width, height } = COMPACT_SIZE;
    const x = Math.max(area.x, Math.min(anchor.x + anchor.width - width, area.x + area.width - width));
    const y = Math.max(area.y, Math.min(anchor.y, area.y + area.height - height));
    return {
      x: x - COMPACT_SHADOW_MARGIN,
      y: y - COMPACT_SHADOW_MARGIN,
      width: width + COMPACT_SHADOW_MARGIN * 2,
      height: height + COMPACT_SHADOW_MARGIN * 2,
    };
  }

  private denyWindowOpen(win: BrowserWindow): void {
    win.webContents.setWindowOpenHandler(({ url }) => {
      if (/^https?:\/\//i.test(url) || /^mailto:/i.test(url)) void shell.openExternal(url);
      return { action: "deny" };
    });
  }
}
