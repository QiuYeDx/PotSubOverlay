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

/** A recently shown subtitle line, for the "recent lines" list. */
export interface HistoryLine {
  key: string;
  /** Start of the line in subtitle-file time (before the per-file offset). */
  startMs: number;
  blocks: DisplayBlock[];
  /** True for the line on screen right now. */
  current: boolean;
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
  /** Recent lines up to the current one, oldest first. */
  history: HistoryLine[];
  /** Executable name of the program in front (games etc.), ignoring PotPlayer and this app. */
  foregroundApp: string | null;
  /** Program whose own subtitle position is in use; null = the default position. */
  placementApp: string | null;
  /** The last check found PotPlayer seeking to keyframes instead of the exact time. */
  keyframeSeek: boolean;
}

export interface TextStyle {
  /** Empty string = pick a font that suits the language automatically. */
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  color: string;
  /** Opacity of the text fill, 0–1 (the outline has its own). */
  opacity: number;
}

export interface OverlayStyle {
  primary: TextStyle;
  secondary: TextStyle;
  outlineWidth: number;
  outlineColor: string;
  /** 0–1 */
  outlineOpacity: number;
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
  | "offsetForward"
  | "recallLine"
  | "playPause"
  | "replayLine"
  | "seekBackward"
  | "seekForward";

/** Commands sent to the followed PotPlayer window. */
export type PlaybackAction = "playPause" | "replayLine" | "seekBackward" | "seekForward";

/** A subtitle position remembered for one program (by executable name). */
export interface PlacementProfile {
  placement: OverlayPlacement;
  touched: number;
}

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
  /** How far the seek hotkeys jump. */
  seekStepMs: number;
  style: OverlayStyle;
  /** Default subtitle position. */
  placement: OverlayPlacement;
  /** Switch to a program's own position while it is in front. */
  autoPlacement: boolean;
  /** Positions remembered per program, keyed by lower-case executable name. */
  placementProfiles: Record<string, PlacementProfile>;
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
  /** Program the position can be remembered for while editing; null when unknown. */
  app: string | null;
  /** Whether that program already has its own position (the one being edited). */
  appHasProfile: boolean;
}

/** A brief notice shown above the subtitles after a playback hotkey. */
export interface OverlayToast {
  id: number;
  kind: "pause" | "play" | "replay" | "back" | "forward" | "noPlayer" | "noLine";
  /** Seconds, for "back" / "forward". */
  seconds?: number;
}

/** A missed line brought back on demand, shown above the live subtitles. */
export interface OverlayRecall {
  display: DisplayPayload;
  /** 1 = the previous line, 2 = the one before… */
  depth: number;
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
