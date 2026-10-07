import { BrowserWindow, screen, type Display, type Rectangle } from "electron";
import type {
  DisplayPayload,
  OverlayModeMessage,
  OverlayPlacement,
  OverlayStyle,
} from "@/shared/types";
import { handleFromBuffer, WM_COPYDATA } from "../win32/user32";

const TOPMOST_REASSERT_MS = 3000;
const MODE_SWITCH_DELAY_MS = 60;

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
  const primary = Math.max(style.zh.fontSize, style.ja.fontSize);
  const secondary = primary * style.secondaryScale;
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

export function normalBounds(placement: OverlayPlacement, style: OverlayStyle): Rectangle {
  const area = resolveDisplay(placement.displayId).bounds;
  const width = Math.round(area.width * placement.width);
  const height = Math.min(overlayHeight(style), Math.round(area.height * 0.6));
  const centerX = area.x + area.width * placement.x;
  const bottom = area.y + area.height * placement.y;
  const x = Math.round(Math.min(Math.max(centerX - width / 2, area.x), area.x + area.width - width));
  const y = Math.round(Math.min(Math.max(bottom - height, area.y), area.y + area.height - height));
  return { x, y, width, height };
}

/**
 * The transparent, click-through subtitle window. In edit mode it grows to
 * cover its display and becomes interactive so the subtitle can be dragged.
 */
export class OverlayWindow {
  readonly win: BrowserWindow;
  private editing = false;
  private visible = false;
  private placement: OverlayPlacement;
  private style: OverlayStyle;
  private topmostTimer: NodeJS.Timeout;
  private lastDisplay: DisplayPayload = { key: "", blocks: [] };
  private locale = "zh";

  constructor(options: OverlayWindowOptions, placement: OverlayPlacement, style: OverlayStyle) {
    this.placement = placement;
    this.style = style;
    this.win = new BrowserWindow({
      ...normalBounds(placement, style),
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
    this.win.hookWindowMessage(WM_COPYDATA, (_wParam, lParam) => options.onCopyData(lParam));
    this.win.webContents.on("did-finish-load", () => this.pushAll());
    void options.load(this.win);

    this.topmostTimer = setInterval(() => {
      if (this.visible && !this.win.isDestroyed()) this.win.setAlwaysOnTop(true, "screen-saver");
    }, TOPMOST_REASSERT_MS);

    screen.on("display-metrics-changed", this.handleDisplayChange);
    screen.on("display-removed", this.handleDisplayChange);
    screen.on("display-added", this.handleDisplayChange);
  }

  get hwnd(): bigint {
    return handleFromBuffer(this.win.getNativeWindowHandle());
  }

  get isEditing(): boolean {
    return this.editing;
  }

  setVisible(visible: boolean): void {
    if (this.win.isDestroyed() || visible === this.visible) return;
    this.visible = visible;
    if (visible) {
      this.win.showInactive();
      this.win.setAlwaysOnTop(true, "screen-saver");
    } else {
      this.win.hide();
    }
  }

  setDisplay(payload: DisplayPayload): void {
    if (payload.key === this.lastDisplay.key) return;
    this.lastDisplay = payload;
    this.send("overlay:display", payload);
  }

  setLocale(locale: string): void {
    if (locale === this.locale) return;
    this.locale = locale;
    this.send("overlay:mode", this.modeMessage());
  }

  setStyle(style: OverlayStyle): void {
    this.style = style;
    this.send("overlay:style", style);
    if (!this.editing) this.applyBounds();
  }

  setPlacement(placement: OverlayPlacement): void {
    const displayChanged = placement.displayId !== this.placement.displayId;
    this.placement = placement;
    if (!this.editing) this.applyBounds();
    else if (displayChanged) void this.switchMode(true);
  }

  async setEditing(editing: boolean): Promise<void> {
    if (editing === this.editing) return;
    await this.switchMode(editing);
  }

  destroy(): void {
    clearInterval(this.topmostTimer);
    screen.off("display-metrics-changed", this.handleDisplayChange);
    screen.off("display-removed", this.handleDisplayChange);
    screen.off("display-added", this.handleDisplayChange);
    if (!this.win.isDestroyed()) this.win.destroy();
  }

  private async switchMode(editing: boolean): Promise<void> {
    if (this.win.isDestroyed()) return;
    this.editing = editing;
    // Hide content first so the resize never shows text in the wrong place.
    this.send("overlay:prepare");
    await new Promise((resolve) => setTimeout(resolve, MODE_SWITCH_DELAY_MS));
    if (this.win.isDestroyed()) return;

    if (editing) {
      this.win.setBounds(resolveDisplay(this.placement.displayId).bounds);
      this.win.setIgnoreMouseEvents(false);
      this.win.setFocusable(true);
      this.win.showInactive();
      this.win.focus();
    } else {
      this.win.setIgnoreMouseEvents(true);
      this.win.setFocusable(false);
      this.applyBounds();
      if (!this.visible) this.win.hide();
    }
    this.win.setAlwaysOnTop(true, "screen-saver");
    this.send("overlay:mode", this.modeMessage());
  }

  private applyBounds(): void {
    if (this.win.isDestroyed()) return;
    this.win.setBounds(normalBounds(this.placement, this.style));
    this.send("overlay:mode", this.modeMessage());
  }

  private modeMessage(): OverlayModeMessage {
    const [width, height] = this.win.getContentSize();
    const primaryId = screen.getPrimaryDisplay().id;
    return {
      editing: this.editing,
      viewport: { width, height },
      placement: this.placement,
      displays: screen.getAllDisplays().map((display, index) => ({
        id: display.id,
        label: display.label || `Display ${index + 1}`,
        primary: display.id === primaryId,
      })),
      locale: this.locale,
    };
  }

  private pushAll(): void {
    this.send("overlay:style", this.style);
    this.send("overlay:mode", this.modeMessage());
    this.send("overlay:display", this.lastDisplay);
  }

  private send(channel: string, ...args: unknown[]): void {
    if (!this.win.isDestroyed()) this.win.webContents.send(channel, ...args);
  }

  private handleDisplayChange = () => {
    if (this.editing) {
      this.win.setBounds(resolveDisplay(this.placement.displayId).bounds);
      this.send("overlay:mode", this.modeMessage());
    } else {
      this.applyBounds();
    }
  };
}
