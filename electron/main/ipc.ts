import path from "node:path";
import { BrowserWindow, dialog, ipcMain, screen, shell } from "electron";
import type { OverlayPlacement, PlaybackAction } from "@/shared/types";
import type { Controller } from "./controller";
import { listFontFamilies } from "./fonts";
import { sanitizePlacement, type SettingsPatch, type SettingsStore } from "./settings";
import type { AppTray } from "./tray";
import type { ControlWindow } from "./windows/control";
import type { OverlayWindow } from "./windows/overlay";

const SUBTITLE_FILTER = { name: "Subtitles", extensions: ["srt", "ass", "ssa", "vtt", "lrc"] };
const PLAYBACK_ACTIONS: PlaybackAction[] = ["playPause", "replayLine", "seekBackward", "seekForward"];

/**
 * IPC contract between the main process and both renderers.
 * Channels are namespaced: app:, settings:, player:, subtitle:, overlay:, window:.
 */
export function registerIpc(deps: {
  controller: Controller;
  settings: SettingsStore;
  control: ControlWindow;
  tray: AppTray;
  overlay: OverlayWindow;
}): void {
  const { controller, settings, control, tray, overlay } = deps;

  ipcMain.handle("app:snapshot", () => controller.snapshot());
  ipcMain.handle("app:hotkey-status", () => controller.hotkeyStatus);
  ipcMain.handle("hotkeys:suspend", (_event, suspended: boolean) =>
    controller.suspendHotkeys(Boolean(suspended))
  );
  ipcMain.on("app:locale", (_event, locale: string) => {
    tray.setLocale(locale);
    overlay.setLocale(locale);
  });
  ipcMain.handle("app:reveal", (_event, filePath: string) => {
    if (typeof filePath === "string" && path.isAbsolute(filePath)) shell.showItemInFolder(filePath);
  });

  ipcMain.handle("app:fonts", () => listFontFamilies());

  ipcMain.handle("settings:get", () => settings.get());
  ipcMain.handle("settings:update", (_event, patch: SettingsPatch) => controller.updateSettings(patch));
  ipcMain.handle("settings:reset", (_event, keys: (keyof SettingsPatch)[]) => settings.reset(keys));

  ipcMain.handle("player:select", (_event, id: string | null) => controller.selectInstance(id));
  ipcMain.handle("player:control", (_event, action: PlaybackAction) => {
    if (PLAYBACK_ACTIONS.includes(action)) controller.playback(action);
  });
  ipcMain.handle("player:play-line", (_event, startMs: number) => {
    if (typeof startMs === "number" && Number.isFinite(startMs)) controller.playFromLine(startMs);
  });
  ipcMain.handle("placement:remove-profile", (_event, app: string) => {
    if (typeof app === "string") controller.removePlacementProfile(app);
  });

  ipcMain.handle("subtitle:toggle", (_event, trackPath: string, enabled: boolean) =>
    controller.setTrackEnabled(trackPath, enabled)
  );
  ipcMain.handle("subtitle:rescan", () => controller.rescan());
  ipcMain.handle("subtitle:add-file", (_event, filePath: string) => controller.addSubtitleFile(filePath));
  ipcMain.handle("subtitle:pick-file", async (event) => {
    const owner = BrowserWindow.fromWebContents(event.sender) ?? undefined;
    const media = controller.session.media;
    const options = {
      defaultPath: media ? path.dirname(media) : undefined,
      properties: ["openFile" as const],
      filters: [SUBTITLE_FILTER],
    };
    const result = owner
      ? await dialog.showOpenDialog(owner, options)
      : await dialog.showOpenDialog(options);
    if (result.canceled || !result.filePaths[0]) return false;
    await controller.addSubtitleFile(result.filePaths[0]);
    return true;
  });
  ipcMain.handle("subtitle:offset", (_event, offsetMs: number) => controller.setOffset(offsetMs));
  ipcMain.handle("subtitle:nudge", (_event, direction: 1 | -1) => controller.nudgeOffset(direction));

  ipcMain.handle("overlay:set-editing", (_event, editing: boolean) => controller.setEditing(editing));
  ipcMain.handle("overlay:commit-placement", (_event, placement: OverlayPlacement) => {
    const valid = sanitizePlacement(placement);
    if (valid) controller.commitPlacement(valid);
  });
  ipcMain.handle("overlay:app-profile", (_event, enabled: boolean, placement: OverlayPlacement) => {
    const valid = sanitizePlacement(placement);
    if (valid) controller.setAppProfile(Boolean(enabled), valid);
  });
  ipcMain.handle("overlay:displays", () => {
    const primaryId = screen.getPrimaryDisplay().id;
    return screen.getAllDisplays().map((display, index) => ({
      id: display.id,
      label: display.label || `Display ${index + 1}`,
      primary: display.id === primaryId,
      size: `${display.size.width}×${display.size.height}`,
    }));
  });

  ipcMain.handle("window:set-compact", (_event, compact: boolean) => control.setCompact(compact));
  ipcMain.handle("window:is-compact", () => control.isCompact);
  ipcMain.handle("window-control", (event, action: "close" | "minimize" | "toggle-maximize") => {
    const target = BrowserWindow.fromWebContents(event.sender);
    if (!target) return { success: false };
    switch (action) {
      case "minimize":
        target.minimize();
        return { success: true };
      case "toggle-maximize":
        if (target.isMaximized()) target.unmaximize();
        else target.maximize();
        return { success: true, isMaximized: target.isMaximized() };
      case "close":
        target.close();
        return { success: true };
      default:
        return { success: false };
    }
  });
  ipcMain.handle("open-external", async (_event, url: string) => {
    if (!/^https?:\/\//i.test(url) && !/^mailto:/i.test(url)) {
      return { success: false, message: "Only http(s) and mailto URLs are allowed." };
    }
    await shell.openExternal(url);
    return { success: true };
  });
}
