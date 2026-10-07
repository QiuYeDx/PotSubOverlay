import type {
  DisplayBlock,
  DisplayPayload,
  LangMode,
  LangOrder,
  SubtitleLang,
} from "@/shared/types";
import { activeCues, type SubtitleTrack } from "./track";

export const EMPTY_DISPLAY: DisplayPayload = { key: "", blocks: [] };

export function availableLangs(tracks: SubtitleTrack[]): SubtitleLang[] {
  const langs = new Set<SubtitleLang>();
  for (const track of tracks) for (const lang of track.langs) langs.add(lang);
  return (["zh", "ja", "other"] as const).filter((lang) => langs.has(lang));
}

/**
 * Build what the overlay shows at `timeMs`: one block per language, ordered by
 * the user's preference and filtered by the language mode. The mode only
 * applies when both Chinese and Japanese are present; otherwise everything is
 * shown so a single-language subtitle never disappears.
 */
export function composeDisplay(
  tracks: SubtitleTrack[],
  timeMs: number,
  mode: LangMode,
  order: LangOrder
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

  const langs = availableLangs(tracks);
  const isBilingual = langs.includes("zh") && langs.includes("ja");
  const sequence: SubtitleLang[] =
    order === "zh-first" ? ["zh", "ja", "other"] : ["ja", "zh", "other"];

  const blocks: DisplayBlock[] = [];
  for (const lang of sequence) {
    const lines = byLang.get(lang);
    if (!lines?.length) continue;
    if (isBilingual && mode !== "both" && lang !== mode) continue;
    blocks.push({ lang, lines });
  }

  return {
    key: blocks.map((block) => `${block.lang}:${block.lines.join("\n")}`).join("|"),
    blocks,
  };
}
