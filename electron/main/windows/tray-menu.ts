import { BrowserWindow, ipcMain, screen, type IpcMainEvent } from "electron";
import { TRAY_MENU_SHADOW_MARGIN as SHADOW_MARGIN } from "@/shared/defaults";
import type { TrayMenuAction, TrayMenuState } from "@/shared/types";
import { disableWindowTransitions } from "../win32/dwmapi";
import { handleFromBuffer } from "../win32/user32";

const READY_TIMEOUT_MS = 150;
/** Longest wait for the page to clear the menu before the window is hidden anyway. */
const HIDE_TIMEOUT_MS = 250;

export interface TrayMenuWindowOptions {
  preload: string;
  load: (win: BrowserWindow) => Promise<void>;
  onAction: (action: TrayMenuAction) => void;
}

/**
 * A styled replacement for the native tray context menu (which Windows does
 * not let us theme). It is a small transparent window, preloaded once and
 * re-positioned next to the cursor each time it opens.
 *
 * Windows shows a hidden window's last frame again the moment it reappears,
 * so the page clears the menu (and paints that) before the window is
 * hidden: otherwise every open flashed the previous menu before its
 * entrance animation, as if it opened twice.
 */
export class TrayMenuWindow {
  readonly win: BrowserWindow;
  private size = { width: 260, height: 300 };
  private anchor = { x: 0, y: 0 };
  private pending: NodeJS.Timeout | null = null;
  private closing: NodeJS.Timeout | null = null;

  constructor(private readonly options: TrayMenuWindowOptions) {
    this.win = new BrowserWindow({
      ...this.size,
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
      alwaysOnTop: true,
      type: "toolbar",
      title: "PotSubOverlay Menu",
      webPreferences: { preload: options.preload, spellcheck: false },
    });
    disableWindowTransitions(handleFromBuffer(this.win.getNativeWindowHandle()));
    this.win.on("blur", () => this.hide());
    void options.load(this.win);

    ipcMain.on("tray-menu:ready", this.handleReady);
    ipcMain.on("tray-menu:action", this.handleAction);
    ipcMain.on("tray-menu:close", this.handleClose);
    ipcMain.on("tray-menu:hidden", this.handleHidden);
  }

  /** Render `state`, then show the menu at the cursor once the renderer has measured it. */
  open(state: TrayMenuState): void {
    if (this.win.isDestroyed()) return;
    this.anchor = screen.getCursorScreenPoint();
    this.win.webContents.send("tray-menu:state", state);
    if (this.pending) clearTimeout(this.pending);
    // Fall back to the last known size if the renderer is slow to answer.
    this.pending = setTimeout(() => this.present(), READY_TIMEOUT_MS);
  }

  /** Fade the menu out, then hide the window once the empty frame is on screen. */
  hide(): void {
    if (this.pending) {
      clearTimeout(this.pending);
      this.pending = null;
    }
    if (this.win.isDestroyed() || !this.win.isVisible() || this.closing) return;
    this.win.webContents.send("tray-menu:hide");
    this.closing = setTimeout(this.finishHide, HIDE_TIMEOUT_MS);
  }

  destroy(): void {
    ipcMain.off("tray-menu:ready", this.handleReady);
    ipcMain.off("tray-menu:action", this.handleAction);
    ipcMain.off("tray-menu:close", this.handleClose);
    ipcMain.off("tray-menu:hidden", this.handleHidden);
    if (this.closing) clearTimeout(this.closing);
    if (!this.win.isDestroyed()) this.win.destroy();
  }

  private present(): void {
    this.pending = null;
    if (this.win.isDestroyed()) return;
    // Reopened while fading out: keep the window.
    if (this.closing) {
      clearTimeout(this.closing);
      this.closing = null;
    }
    const { width, height } = this.size;
    const area = screen.getDisplayNearestPoint(this.anchor).workArea;
    // Like the native menu: open up and to the left of the cursor (taskbar
    // at the bottom right), flipping when that would leave the work area.
    let x = this.anchor.x - width + SHADOW_MARGIN;
    let y = this.anchor.y - height + SHADOW_MARGIN;
    if (x < area.x) x = this.anchor.x - SHADOW_MARGIN;
    if (y < area.y) y = this.anchor.y - SHADOW_MARGIN;
    x = Math.round(Math.min(Math.max(x, area.x - SHADOW_MARGIN), area.x + area.width - width + SHADOW_MARGIN));
    y = Math.round(Math.min(Math.max(y, area.y - SHADOW_MARGIN), area.y + area.height - height + SHADOW_MARGIN));
    this.win.setBounds({ x, y, width, height });
    this.win.show();
    this.win.focus();
    this.win.webContents.send("tray-menu:open");
  }

  private finishHide = (): void => {
    if (this.closing) clearTimeout(this.closing);
    this.closing = null;
    if (!this.win.isDestroyed() && this.win.isVisible()) this.win.hide();
  };

  private fromMenu(event: IpcMainEvent): boolean {
    return !this.win.isDestroyed() && event.sender === this.win.webContents;
  }

  private handleReady = (event: IpcMainEvent, size: { width: number; height: number }) => {
    if (!this.fromMenu(event)) return;
    if (size?.width > 0 && size?.height > 0) {
      this.size = { width: Math.ceil(size.width), height: Math.ceil(size.height) };
    }
    if (this.pending) {
      clearTimeout(this.pending);
      this.present();
    }
  };

  private handleAction = (event: IpcMainEvent, action: TrayMenuAction) => {
    if (!this.fromMenu(event)) return;
    this.hide();
    this.options.onAction(action);
  };

  private handleClose = (event: IpcMainEvent) => {
    if (this.fromMenu(event)) this.hide();
  };

  private handleHidden = (event: IpcMainEvent) => {
    if (this.fromMenu(event) && this.closing) this.finishHide();
  };
}
