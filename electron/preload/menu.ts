import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";

/** Preload for the custom tray menu: only the tray-menu:* channels. */
contextBridge.exposeInMainWorld("trayMenuApi", {
  on(channel: string, listener: (...args: unknown[]) => void) {
    if (!channel.startsWith("tray-menu:")) return () => undefined;
    const wrapped = (_event: IpcRendererEvent, ...args: unknown[]) => listener(...args);
    ipcRenderer.on(channel, wrapped);
    return () => ipcRenderer.off(channel, wrapped);
  },
  send(channel: string, ...args: unknown[]) {
    if (channel.startsWith("tray-menu:")) ipcRenderer.send(channel, ...args);
  },
});
