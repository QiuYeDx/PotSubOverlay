import { BrowserWindow, screen, shell, type Rectangle } from "electron";

export const FULL_SIZE = { width: 980, height: 700, minWidth: 820, minHeight: 580 };
export const COMPACT_SIZE = { width: 392, height: 212 };
const MODE_SWITCH_DELAY_MS = 140;
const START_LOADING_PROGRESS_CHANNEL = "qiuye-template-start-loading-progress";

export interface ControlWindowOptions {
  preload: string;
  icon: string;
  load: (win: BrowserWindow) => Promise<void>;
  /** Return true to hide instead of closing. */
  shouldHideOnClose: () => boolean;
  compactAlwaysOnTop: () => boolean;
  onHiddenToTray?: () => void;
}

/**
 * The control panel. Supports a full layout and a compact "mini player"
 * layout; the window keeps its full-size bounds while compact so it can
 * restore exactly where it was.
 */
export class ControlWindow {
  win: BrowserWindow | null = null;
  private compact = false;
  private fullBounds: Rectangle | null = null;
  private quitting = false;

  constructor(private readonly options: ControlWindowOptions) {}

  get isCompact(): boolean {
    return this.compact;
  }

  get isVisible(): boolean {
    return Boolean(this.win && !this.win.isDestroyed() && this.win.isVisible() && !this.win.isMinimized());
  }

  markQuitting(): void {
    this.quitting = true;
  }

  show(): void {
    if (!this.win || this.win.isDestroyed()) {
      this.create();
      return;
    }
    if (this.win.isMinimized()) this.win.restore();
    this.win.show();
    this.win.focus();
  }

  send(channel: string, ...args: unknown[]): void {
    if (this.win && !this.win.isDestroyed()) this.win.webContents.send(channel, ...args);
  }

  async setCompact(compact: boolean): Promise<void> {
    const win = this.win;
    if (!win || win.isDestroyed() || compact === this.compact) return;
    this.send("window:compact-prepare", compact);
    await new Promise((resolve) => setTimeout(resolve, MODE_SWITCH_DELAY_MS));
    if (win.isDestroyed()) return;

    this.compact = compact;
    if (compact) {
      if (win.isMaximized()) win.unmaximize();
      this.fullBounds = win.getBounds();
      const area = screen.getDisplayMatching(this.fullBounds).workArea;
      const x = Math.min(
        this.fullBounds.x + this.fullBounds.width - COMPACT_SIZE.width,
        area.x + area.width - COMPACT_SIZE.width
      );
      win.setMinimumSize(COMPACT_SIZE.width, COMPACT_SIZE.height);
      win.setResizable(false);
      win.setMaximizable(false);
      win.setBounds({ x: Math.max(area.x, x), y: Math.max(area.y, this.fullBounds.y), ...COMPACT_SIZE });
      win.setAlwaysOnTop(this.options.compactAlwaysOnTop(), "floating");
    } else {
      win.setAlwaysOnTop(false);
      win.setResizable(true);
      win.setMaximizable(true);
      win.setMinimumSize(FULL_SIZE.minWidth, FULL_SIZE.minHeight);
      const area = screen.getDisplayMatching(win.getBounds()).workArea;
      const target = this.fullBounds ?? {
        x: area.x + Math.round((area.width - FULL_SIZE.width) / 2),
        y: area.y + Math.round((area.height - FULL_SIZE.height) / 2),
        width: FULL_SIZE.width,
        height: FULL_SIZE.height,
      };
      win.setBounds(target);
    }
    this.send("window:compact", compact);
  }

  refreshAlwaysOnTop(): void {
    if (this.win && !this.win.isDestroyed() && this.compact) {
      this.win.setAlwaysOnTop(this.options.compactAlwaysOnTop(), "floating");
    }
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
      if (this.win === win) this.win = null;
    });

    win.webContents.setWindowOpenHandler(({ url }) => {
      if (/^https?:\/\//i.test(url) || /^mailto:/i.test(url)) void shell.openExternal(url);
      return { action: "deny" };
    });

    void this.options.load(win);
  }
}
