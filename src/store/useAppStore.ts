import { create } from "zustand";
import { DEFAULT_SETTINGS } from "@/shared/defaults";
import type {
  AppSnapshot,
  HotkeyAction,
  OverlayPlacement,
  OverlayStyle,
  Settings,
} from "@/shared/types";

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };
export type SettingsPatch = DeepPartial<Omit<Settings, "media" | "version">>;

const EMPTY_SNAPSHOT: AppSnapshot = {
  instances: [],
  activeId: null,
  selection: "auto",
  status: "no-player",
  tracks: [],
  availableLangs: [],
  offsetMs: 0,
  display: { key: "", blocks: [] },
  overlayVisible: true,
  overlaySuppressed: false,
  editing: false,
};

function mergeDeep<T>(base: T, patch: unknown): T {
  if (typeof base !== "object" || base === null || typeof patch !== "object" || patch === null) {
    return (patch === undefined ? base : patch) as T;
  }
  const result: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [key, value] of Object.entries(patch as Record<string, unknown>)) {
    const current = result[key];
    result[key] =
      typeof current === "object" && current !== null && !Array.isArray(current)
        ? mergeDeep(current, value)
        : value;
  }
  return result as T;
}

interface AppStore {
  ready: boolean;
  snapshot: AppSnapshot;
  settings: Settings;
  hotkeyFailures: HotkeyAction[];
  compact: boolean;
  /** True between the main process announcing a layout switch and applying it. */
  switchingLayout: boolean;
  fonts: string[] | null;

  init: () => () => void;
  updateSettings: (patch: SettingsPatch) => void;
  updateStyle: (patch: DeepPartial<OverlayStyle>) => void;
  resetSettings: (keys: (keyof SettingsPatch)[]) => void;
  selectInstance: (id: string | null) => void;
  toggleTrack: (path: string, enabled: boolean) => void;
  rescan: () => Promise<void>;
  pickFile: () => Promise<boolean>;
  addFile: (path: string) => Promise<void>;
  setOffset: (offsetMs: number) => void;
  nudgeOffset: (direction: 1 | -1) => void;
  setEditing: (editing: boolean) => void;
  commitPlacement: (placement: OverlayPlacement) => void;
  setCompact: (compact: boolean) => void;
  loadFonts: () => Promise<void>;
  reveal: (path: string) => void;
}

const invoke = <T = unknown>(channel: string, ...args: unknown[]) =>
  window.ipcRenderer.invoke<T>(channel, ...args);

const useAppStore = create<AppStore>((set, get) => ({
  ready: false,
  snapshot: EMPTY_SNAPSHOT,
  settings: DEFAULT_SETTINGS,
  hotkeyFailures: [],
  compact: false,
  switchingLayout: false,
  fonts: null,

  init: () => {
    const ipc = window.ipcRenderer;
    void Promise.all([
      invoke<AppSnapshot>("app:snapshot"),
      invoke<Settings>("settings:get"),
      invoke<HotkeyAction[]>("app:hotkey-status"),
      invoke<boolean>("window:is-compact"),
    ]).then(([snapshot, settings, hotkeyFailures, compact]) =>
      set({ snapshot, settings, hotkeyFailures, compact, ready: true })
    );

    const onSnapshot = (_event: unknown, snapshot: unknown) =>
      set({ snapshot: snapshot as AppSnapshot });
    const onSettings = (_event: unknown, settings: unknown) =>
      set({ settings: settings as Settings });
    const onHotkeys = (_event: unknown, failures: unknown) =>
      set({ hotkeyFailures: failures as HotkeyAction[] });
    const onPrepare = () => set({ switchingLayout: true });
    const onCompact = (_event: unknown, compact: unknown) =>
      set({ compact: Boolean(compact), switchingLayout: false });

    ipc.on("app:snapshot", onSnapshot);
    ipc.on("settings:changed", onSettings);
    ipc.on("hotkeys:status", onHotkeys);
    ipc.on("window:compact-prepare", onPrepare);
    ipc.on("window:compact", onCompact);
    return () => {
      ipc.off("app:snapshot", onSnapshot);
      ipc.off("settings:changed", onSettings);
      ipc.off("hotkeys:status", onHotkeys);
      ipc.off("window:compact-prepare", onPrepare);
      ipc.off("window:compact", onCompact);
    };
  },

  updateSettings: (patch) => {
    // Optimistic: sliders must feel instant; the main process echoes the result.
    set({ settings: mergeDeep(get().settings, patch) });
    void invoke("settings:update", patch);
  },
  updateStyle: (patch) => get().updateSettings({ style: patch }),
  resetSettings: (keys) => void invoke<Settings>("settings:reset", keys).then((settings) => set({ settings })),
  selectInstance: (id) => void invoke("player:select", id),
  toggleTrack: (path, enabled) => void invoke("subtitle:toggle", path, enabled),
  rescan: () => invoke("subtitle:rescan"),
  pickFile: () => invoke<boolean>("subtitle:pick-file"),
  addFile: (path) => invoke("subtitle:add-file", path),
  setOffset: (offsetMs) => void invoke("subtitle:offset", offsetMs),
  nudgeOffset: (direction) => void invoke("subtitle:nudge", direction),
  setEditing: (editing) => void invoke("overlay:set-editing", editing),
  commitPlacement: (placement) => void invoke("overlay:commit-placement", placement),
  setCompact: (compact) => void invoke("window:set-compact", compact),
  loadFonts: async () => {
    if (get().fonts) return;
    const fonts = await invoke<string[]>("app:fonts");
    set({ fonts });
  },
  reveal: (path) => void invoke("app:reveal", path),
}));

export default useAppStore;
