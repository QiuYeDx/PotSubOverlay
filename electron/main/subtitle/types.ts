import type { SubtitleLang } from "@/shared/types";

export type SubtitleFormat = "srt" | "vtt" | "ass" | "ssa" | "lrc";

/** A line as produced by a parser, before language assignment. */
export interface RawLine {
  text: string;
  /** Grouping key used for language voting: ASS style + line index, or line index. */
  slot: string;
}

export interface RawCue {
  start: number;
  end: number;
  lines: RawLine[];
  /** ASS positioned/drawing events (signs, on-screen text). */
  isSign?: boolean;
}

export interface CueLine {
  text: string;
  lang: SubtitleLang;
}

export interface Cue {
  start: number;
  end: number;
  lines: CueLine[];
}

export interface FileLangHint {
  langs: SubtitleLang[];
  variant: "sc" | "tc" | null;
}
