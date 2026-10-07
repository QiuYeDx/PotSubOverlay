import type { SubtitleLang } from "@/shared/types";
import { decodeSubtitle } from "./decode";
import type { SubtitleCandidate } from "./finder";
import { parseLangHint } from "./finder";
import { assignLanguages } from "./lang";
import { normalizeCues } from "./normalize";
import { parseAss } from "./parse-ass";
import { parseLrc } from "./parse-lrc";
import { parseSrtLike } from "./parse-srt";
import type { Cue, FileLangHint, RawCue, SubtitleFormat } from "./types";

export interface SubtitleTrack {
  id: string;
  path: string;
  fileName: string;
  format: SubtitleFormat;
  tag: string;
  hint: FileLangHint;
  encoding: string;
  cues: Cue[];
  langs: SubtitleLang[];
  bilingual: boolean;
  /** Start times, for binary search. */
  starts: number[];
  /** Longest cue duration, bounds the backwards scan in `activeCues`. */
  maxDuration: number;
}

export function parseByFormat(format: SubtitleFormat, text: string): RawCue[] {
  switch (format) {
    case "ass":
    case "ssa":
      return parseAss(text);
    case "lrc":
      return parseLrc(text);
    case "vtt":
      return parseSrtLike(text, "vtt");
    default:
      return parseSrtLike(text, "srt");
  }
}

export function buildTrack(
  candidate: SubtitleCandidate,
  bytes: Uint8Array,
  options: { filterSigns: boolean }
): SubtitleTrack {
  const { text, encoding } = decodeSubtitle(bytes);
  let raw = parseByFormat(candidate.format, text);
  if (options.filterSigns) {
    const dialogue = raw.filter((cue) => !cue.isSign);
    // A file made only of positioned events is still worth showing.
    if (dialogue.length > 0) raw = dialogue;
  }
  const hint = parseLangHint(candidate.tag);
  const { cues, profile } = assignLanguages(normalizeCues(raw), hint);

  return {
    id: candidate.path,
    path: candidate.path,
    fileName: candidate.fileName,
    format: candidate.format,
    tag: candidate.tag,
    hint,
    encoding,
    cues,
    langs: profile.langs,
    bilingual: profile.bilingual,
    starts: cues.map((cue) => cue.start),
    maxDuration: cues.reduce((max, cue) => Math.max(max, cue.end - cue.start), 0),
  };
}

export function activeCues(track: SubtitleTrack, timeMs: number): Cue[] {
  // Last cue whose start <= time.
  let lo = 0;
  let hi = track.starts.length - 1;
  let index = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (track.starts[mid] <= timeMs) {
      index = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  const result: Cue[] = [];
  for (let i = index; i >= 0; i -= 1) {
    const cue = track.cues[i];
    if (timeMs - cue.start > track.maxDuration) break;
    if (cue.end > timeMs) result.push(cue);
  }
  return result.reverse();
}

const FORMAT_SCORE: Record<SubtitleFormat, number> = { ass: 4, ssa: 4, srt: 3, vtt: 2, lrc: 1 };

function score(track: SubtitleTrack, preferVariant: "sc" | "tc"): number {
  let value = FORMAT_SCORE[track.format];
  if (track.hint.variant === preferVariant) value += 0.5;
  else if (track.hint.variant) value -= 0.5;
  // Untagged files are usually the "main" subtitle.
  if (!track.tag) value += 0.25;
  return value + Math.min(track.cues.length, 2000) / 1e6;
}

/** Choose which tracks to enable when the user has not chosen any. */
export function selectDefaultTracks(
  tracks: SubtitleTrack[],
  preferVariant: "sc" | "tc"
): SubtitleTrack[] {
  const usable = tracks.filter((track) => track.cues.length > 0);
  const best = (list: SubtitleTrack[]) =>
    [...list].sort((a, b) => score(b, preferVariant) - score(a, preferVariant))[0];

  const bilingual = usable.filter((track) => track.bilingual);
  if (bilingual.length > 0) return [best(bilingual)];

  const zh = usable.filter((track) => track.langs.includes("zh"));
  const ja = usable.filter((track) => track.langs.includes("ja"));
  if (zh.length > 0 && ja.length > 0) return [best(zh), best(ja)];

  const any = best(usable);
  return any ? [any] : [];
}
