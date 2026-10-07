/**
 * Types shared by the Electron main process, the control panel and the overlay.
 * Keep this file free of Node/DOM imports.
 */

import type { KnownLang, SubtitleLang } from "./languages";

export type { KnownLang, SubtitleLang } from "./languages";

/**
 * Bilingual subtitles are handled by role: the "primary" language is the one
 * the user prefers (settings.primaryLang) when present, the "secondary" one is
 * the other language in the subtitle.
 */
export type LangRole = "primary" | "secondary";

/** Which languages the overlay shows when the subtitle is bilingual. */
export type LangMode = "both" | LangRole;

/** Vertical order of the two languages in bilingual mode. */
export type LangOrder = "primary-first" | "secondary-first";

export interface LangRoles {
  primary: SubtitleLang | null;
  secondary: SubtitleLang | null;
}

export type PlayState = "playing" | "paused" | "stopped";

export interface PlayerInstance {
  /** Stable id for the lifetime of the PotPlayer window (its HWND as a string). */
  id: string;
  pid: number;
  title: string;
  mediaPath: string | null;
  durationMs: number;
  positionMs: number;
  state: PlayState;
}

export interface SubtitleTrackInfo {
  id: string;
  path: string;
  fileName: string;
  format: string;
  /** Text after the media name, e.g. "scjp" in `name.scjp.ass`. */
  tag: string;
  langs: SubtitleLang[];
  bilingual: boolean;
  cueCount: number;
  encoding: string;
  enabled: boolean;
  error?: string;
}

export type SubtitleStatus =
  | "no-player"
  | "waiting-path"
  | "scanning"
  | "none-found"
  | "ready"
  | "error";

export interface DisplayBlock {
  lang: SubtitleLang;
  role: LangRole;
  lines: string[];
}

export interface DisplayPayload {
  /** Changes whenever the visible text changes; used as an animation key. */
  key: string;
  blocks: DisplayBlock[];
}

export interface AppSnapshot {
  instances: PlayerInstance[];
  activeId: string | null;
  selection: "auto" | "manual";
  status: SubtitleStatus;
  tracks: SubtitleTrackInfo[];
  /** Languages present across the enabled tracks. */
  availableLangs: SubtitleLang[];
  /** Which of those languages is shown as primary / secondary. */
  roles: LangRoles;
  offsetMs: number;
  display: DisplayPayload;
  overlayVisible: boolean;
  /** True while the overlay is hidden because PotPlayer is the foreground window, paused, etc. */
  overlaySuppressed: boolean;
  editing: boolean;
}

export interface TextStyle {
  /** Empty string = pick a font that suits the language automatically. */
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  color: string;
}

export interface OverlayStyle {
  primary: TextStyle;
  secondary: TextStyle;
  outlineWidth: number;
  outlineColor: string;
  shadowBlur: number;
  shadowOpacity: number;
  background: "none" | "box";
  backgroundColor: string;
  backgroundOpacity: number;
  lineGap: number;
  blockGap: number;
  letterSpacing: number;
  animation: boolean;
}

export interface OverlayPlacement {
  /** Electron display id the overlay lives on; null = primary display. */
  displayId: number | null;
  /** Horizontal centre of the subtitle block, 0–1 of the display width. */
  x: number;
  /** Bottom edge of the subtitle block, 0–1 of the display height. */
  y: number;
  /** Maximum width of the subtitle block, 0–1 of the display width. */
  width: number;
}

export type HotkeyAction =
  | "toggleOverlay"
  | "toggleEdit"
  | "cycleLangMode"
  | "offsetBackward"
  | "offsetForward";

export interface Settings {
  version: 3;
  /** Preferred first language of bilingual subtitles. */
  primaryLang: KnownLang;
  langMode: LangMode;
  langOrder: LangOrder;
  overlayVisible: boolean;
  hideWhenPlayerForeground: boolean;
  hideWhenPaused: boolean;
  filterSigns: boolean;
  preferVariant: "sc" | "tc";
  offsetStepMs: number;
  style: OverlayStyle;
  placement: OverlayPlacement;
  hotkeys: Record<HotkeyAction, string>;
  launchAtLogin: boolean;
  closeToTray: boolean;
  compactAlwaysOnTop: boolean;
  /** Whether the "still running in the tray" hint has been shown once. */
  trayHintShown: boolean;
  /** Per-media preferences, keyed by media path (most recent last). */
  media: Record<string, MediaPrefs>;
}

export interface MediaPrefs {
  offsetMs?: number;
  /** Track paths the user explicitly enabled. */
  tracks?: string[];
  /** Subtitle files added by hand that do not follow the naming convention. */
  extraFiles?: string[];
  touched: number;
}

export interface DisplayInfo {
  id: number;
  label: string;
  primary: boolean;
}

/** Sent to the overlay renderer whenever its window mode or size changes. */
export interface OverlayModeMessage {
  editing: boolean;
  /** Size of the window content in DIP. */
  viewport: { width: number; height: number };
  placement: OverlayPlacement;
  displays: DisplayInfo[];
  locale: string;
  /** Languages used for the sample text when nothing is playing. */
  sampleLangs: [SubtitleLang, SubtitleLang];
}

/** What the custom tray menu renders. Labels are localized by the main process. */
export interface TrayMenuState {
  labels: {
    open: string;
    showSubtitle: string;
    editPosition: string;
    language: string;
    quit: string;
  };
  modes: { value: LangMode; label: string }[];
  /** False when the subtitle has a single language, so modes do not apply. */
  modesEnabled: boolean;
  langMode: LangMode;
  overlayVisible: boolean;
}

export type TrayMenuAction =
  | { type: "open" }
  | { type: "toggleOverlay" }
  | { type: "edit" }
  | { type: "langMode"; value: LangMode }
  | { type: "quit" };
