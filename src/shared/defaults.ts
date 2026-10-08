import type { HotkeyAction, OverlayPlacement, OverlayStyle, Settings } from "./types";

export const DEFAULT_STYLE: OverlayStyle = {
  primary: {
    fontFamily: "",
    fontSize: 30,
    fontWeight: 600,
    color: "#FFFFFF",
  },
  secondary: {
    fontFamily: "",
    fontSize: 24,
    fontWeight: 600,
    color: "#FFFFFF",
  },
  outlineWidth: 1.5,
  outlineColor: "#000000",
  shadowBlur: 10,
  shadowOpacity: 0.55,
  background: "none",
  backgroundColor: "#000000",
  backgroundOpacity: 0.4,
  lineGap: 2,
  blockGap: 6,
  letterSpacing: 0.5,
  animation: true,
};

export const DEFAULT_PLACEMENT: OverlayPlacement = {
  displayId: null,
  x: 0.5,
  y: 0.92,
  width: 0.8,
};

export const DEFAULT_HOTKEYS: Record<HotkeyAction, string> = {
  toggleOverlay: "Control+Alt+S",
  toggleEdit: "Control+Alt+P",
  cycleLangMode: "Control+Alt+J",
  offsetBackward: "Control+Alt+[",
  offsetForward: "Control+Alt+]",
  recallLine: "Control+Alt+Up",
  playPause: "Control+Alt+K",
  replayLine: "Control+Alt+Down",
  seekBackward: "Control+Alt+Left",
  seekForward: "Control+Alt+Right",
};

/** Hotkeys as listed in settings. */
export const HOTKEY_GROUPS: { key: "subtitle" | "playback"; actions: HotkeyAction[] }[] = [
  {
    key: "subtitle",
    actions: ["toggleOverlay", "toggleEdit", "cycleLangMode", "recallLine", "offsetBackward", "offsetForward"],
  },
  { key: "playback", actions: ["playPause", "replayLine", "seekBackward", "seekForward"] },
];

export const HOTKEY_ACTIONS: HotkeyAction[] = HOTKEY_GROUPS.flatMap((group) => group.actions);

export const DEFAULT_SETTINGS: Settings = {
  version: 3,
  primaryLang: "zh",
  langMode: "both",
  langOrder: "primary-first",
  overlayVisible: true,
  hideWhenPlayerForeground: true,
  hideWhenPaused: false,
  filterSigns: true,
  preferVariant: "sc",
  offsetStepMs: 500,
  seekStepMs: 5000,
  style: DEFAULT_STYLE,
  placement: DEFAULT_PLACEMENT,
  autoPlacement: true,
  placementProfiles: {},
  hotkeys: DEFAULT_HOTKEYS,
  launchAtLogin: false,
  closeToTray: true,
  compactAlwaysOnTop: true,
  trayHintShown: false,
  media: {},
};

