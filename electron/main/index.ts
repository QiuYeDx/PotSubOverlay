import { app, BrowserWindow, ipcMain, Menu, Notification } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { Controller } from "./controller";
import { registerIpc } from "./ipc";
import { runQaScript } from "./qa";
import { SettingsStore } from "./settings";
import { AppTray } from "./tray";
import { setupUpdateIPC } from "./update";
import { ControlWindow } from "./windows/control";
import { OverlayWindow } from "./windows/overlay";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

process.env.APP_ROOT = path.join(__dirname, "../..");

export const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, "public")
  : RENDERER_DIST;

const controlPreload = path.join(__dirname, "../preload/index.mjs");
const overlayPreload = path.join(__dirname, "../preload/overlay.mjs");
const startHidden = process.argv.includes("--hidden");

if (process.platform === "win32") {
  app.setAppUserModelId("com.qiuyedx.potsuboverlay");
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

/** Load a renderer page from the dev server or the built files. */
function pageLoader(page: "index" | "overlay") {
  return async (win: BrowserWindow) => {
    if (VITE_DEV_SERVER_URL) {
      await win.loadURL(page === "index" ? VITE_DEV_SERVER_URL : `${VITE_DEV_SERVER_URL}overlay.html`);
      return;
    }
    await win.loadFile(path.join(RENDERER_DIST, `${page}.html`));
  };
}

/** In production, disable reload and devtools shortcuts like the template does. */
function lockDownShortcuts(win: BrowserWindow) {
  if (VITE_DEV_SERVER_URL) return;
  win.webContents.on("before-input-event", (event, input) => {
    const isCtrlOrCmd = input.control || input.meta;
    const key = input.key.toLowerCase();
    if (input.key === "F5" || (isCtrlOrCmd && key === "r")) event.preventDefault();
    if (input.key === "F12" || (isCtrlOrCmd && input.shift && key === "i")) event.preventDefault();
  });
}

let quitting = false;

app.whenReady().then(() => {
  if (!VITE_DEV_SERVER_URL) Menu.setApplicationMenu(Menu.buildFromTemplate([]));

  const iconPath = path.join(process.env.VITE_PUBLIC, "favicon.ico");
  const settings = new SettingsStore();
  let controller: Controller | null = null;

  const overlay = new OverlayWindow(
    {
      preload: overlayPreload,
      load: pageLoader("overlay"),
      onCopyData: (lParam) => controller?.handleCopyData(lParam),
    },
    settings.get().placement,
    settings.get().style
  );
  lockDownShortcuts(overlay.win);

  const control = new ControlWindow({
    preload: controlPreload,
    icon: iconPath,
    load: async (win) => {
      lockDownShortcuts(win);
      await pageLoader("index")(win);
    },
    shouldHideOnClose: () => !quitting && settings.get().closeToTray,
    compactAlwaysOnTop: () => settings.get().compactAlwaysOnTop,
    onHiddenToTray: () => {
      if (settings.get().trayHintShown) return;
      tray.showRunningHint();
      settings.update({ trayHintShown: true });
    },
  });

  controller = new Controller(settings, overlay, control);
  controller.onSnapshot((snapshot) => {
    if (control.isVisible) control.send("app:snapshot", snapshot);
  });

  const tray = new AppTray(
    iconPath,
    {
      open: () => control.show(),
      toggleOverlay: () => controller?.toggleOverlay(),
      edit: () => void controller?.setEditing(true),
      setLangMode: (langMode) => controller?.updateSettings({ langMode }),
      quit: () => {
        quitting = true;
        control.markQuitting();
        app.quit();
      },
    },
    () => settings.get()
  );
  settings.on("change", () => tray.refresh());

  registerIpc({ controller, settings, control, tray, overlay });
  setupUpdateIPC();

  control.create(!startHidden);
  controller.start();
  void runQaScript({ controller, overlay, control });

  app.on("before-quit", () => {
    quitting = true;
    control.markQuitting();
    controller?.stop();
    overlay.destroy();
    tray.destroy();
  });

  app.on("second-instance", () => control.show());
});

// The app lives in the tray; closing windows does not quit it.
app.on("window-all-closed", () => {
  if (quitting) app.quit();
});

ipcMain.on(
  "show-notification",
  (_event, { title, body }: { title: string; body: string }) => {
    if (Notification.isSupported()) {
      new Notification({ title, body }).show();
    }
  }
);
