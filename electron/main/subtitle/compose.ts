import { SUBTITLE_LANGS, type SubtitleLang } from "@/shared/languages";
import type {
  DisplayBlock,
  DisplayPayload,
  LangMode,
  LangOrder,
  LangRoles,
} from "@/shared/types";
import { activeCues, type SubtitleTrack } from "./track";

export const EMPTY_DISPLAY: DisplayPayload = { key: "", blocks: [] };

/** Languages present across tracks, in the order they first appear. */
export function availableLangs(tracks: SubtitleTrack[]): SubtitleLang[] {
  const langs: SubtitleLang[] = [];
  for (const track of tracks) for (const lang of track.langs) if (!langs.includes(lang)) langs.push(lang);
  return langs;
}

/**
 * Decide which language plays which role. The preferred language is primary
 * whenever it is present; otherwise the first language that appears is.
 * "other" (unrecognised text) only becomes secondary when nothing else can.
 */
export function resolveRoles(langs: SubtitleLang[], preferred: SubtitleLang): LangRoles {
  const known: SubtitleLang[] = langs.filter((lang) => lang !== "other");
  const primary = known.includes(preferred) ? preferred : (known[0] ?? langs[0] ?? null);
  const secondary =
    known.find((lang) => lang !== primary) ??
    (primary !== "other" && langs.includes("other") ? "other" : null);
  return { primary, secondary };
}

/**
 * Build what the overlay shows at `timeMs`: one block per language, primary
 * and secondary ordered by preference and filtered by the language mode.
 * The mode only applies when both roles exist, so a single-language
 * subtitle never disappears. Further languages (rare) follow as secondary.
 */
export function composeDisplay(
  tracks: SubtitleTrack[],
  timeMs: number,
  mode: LangMode,
  order: LangOrder,
  preferred: SubtitleLang
): DisplayPayload {
  const byLang = new Map<SubtitleLang, string[]>();
  for (const track of tracks) {
    for (const cue of activeCues(track, timeMs)) {
      for (const line of cue.lines) {
        const list = byLang.get(line.lang) ?? [];
        if (!list.includes(line.text)) list.push(line.text);
        byLang.set(line.lang, list);
      }
    }
  }
  if (byLang.size === 0) return EMPTY_DISPLAY;

  const roles = resolveRoles(availableLangs(tracks), preferred);
  const hasBoth = roles.primary !== null && roles.secondary !== null;
  const pair = [roles.primary, roles.secondary].filter((lang): lang is SubtitleLang => lang !== null);
  const sequence: SubtitleLang[] = order === "primary-first" ? pair : [...pair].reverse();
  for (const lang of [...SUBTITLE_LANGS, "other" as const]) {
    if (!sequence.includes(lang)) sequence.push(lang);
  }

  const blocks: DisplayBlock[] = [];
  for (const lang of sequence) {
    const lines = byLang.get(lang);
    if (!lines?.length) continue;
    const role = lang === roles.primary ? "primary" : "secondary";
    if (hasBoth && mode !== "both" && role !== mode) continue;
    blocks.push({ lang, role, lines });
  }

  return {
    key: blocks.map((block) => `${block.lang}:${block.lines.join("\n")}`).join("|"),
    blocks,
  };
}
