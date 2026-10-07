import type { HotkeyAction, OverlayPlacement, OverlayStyle, Settings } from "./types";

export const DEFAULT_STYLE: OverlayStyle = {
  zh: {
    fontFamily: "Microsoft YaHei UI",
    fontSize: 34,
    fontWeight: 600,
    color: "#FFFFFF",
  },
  ja: {
    fontFamily: "Yu Gothic UI",
    fontSize: 34,
    fontWeight: 600,
    color: "#FFFFFF",
  },
  secondaryScale: 0.74,
  outlineWidth: 3,
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
};

export const HOTKEY_ACTIONS: HotkeyAction[] = [
  "toggleOverlay",
  "toggleEdit",
  "cycleLangMode",
  "offsetBackward",
  "offsetForward",
];

export const DEFAULT_SETTINGS: Settings = {
  version: 1,
  langMode: "both",
  langOrder: "zh-first",
  overlayVisible: true,
  hideWhenPlayerForeground: true,
  hideWhenPaused: false,
  filterSigns: true,
  preferVariant: "sc",
  offsetStepMs: 500,
  style: DEFAULT_STYLE,
  placement: DEFAULT_PLACEMENT,
  hotkeys: DEFAULT_HOTKEYS,
  launchAtLogin: false,
  closeToTray: true,
  compactAlwaysOnTop: true,
  trayHintShown: false,
  media: {},
};

/** Fonts offered first in the font picker, in order of preference. */
export const RECOMMENDED_FONTS = {
  zh: [
    "Microsoft YaHei UI",
    "HarmonyOS Sans SC",
    "Source Han Sans SC",
    "Noto Sans SC",
    "MiSans",
    "PingFang SC",
    "LXGW WenKai",
    "SimHei",
  ],
  ja: [
    "Yu Gothic UI",
    "Meiryo UI",
    "Source Han Sans JP",
    "Noto Sans JP",
    "BIZ UDPGothic",
    "M PLUS 1p",
    "Yu Mincho",
    "MS Gothic",
  ],
};
