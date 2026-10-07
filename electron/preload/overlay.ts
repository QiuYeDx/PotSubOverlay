import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";

/**
 * Preload for the subtitle overlay. It only exposes the overlay:* channels
 * and, unlike the control panel preload, injects no loading screen.
 */
contextBridge.exposeInMainWorld("overlayApi", {
  on(channel: string, listener: (...args: unknown[]) => void) {
    if (!channel.startsWith("overlay:")) return () => undefined;
    const wrapped = (_event: IpcRendererEvent, ...args: unknown[]) => listener(...args);
    ipcRenderer.on(channel, wrapped);
    return () => ipcRenderer.off(channel, wrapped);
  },
  invoke(channel: string, ...args: unknown[]) {
    if (!channel.startsWith("overlay:")) return Promise.reject(new Error("blocked channel"));
    return ipcRenderer.invoke(channel, ...args);
  },
});
