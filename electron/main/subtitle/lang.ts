import type { SubtitleLang } from "@/shared/types";
import type { Cue, FileLangHint, RawCue } from "./types";

const KANA_RE = /[぀-ゟ゠-ヿㇰ-ㇿｦ-ﾟ]/g;
const HAN_RE = /[㐀-䶿一-鿿豈-﫿]/g;
const LATIN_RE = /[A-Za-z]/g;
/**
 * Characters that are common in Chinese but (practically) never appear in
 * Japanese text. A han-only line containing one of them is Chinese.
 */
const ZH_MARKERS = new Set(
  "们这吗呢么没还让给过个对说话为从时吧啊呀哦嗯谁怎样哪们這嗎麼沒讓說對為從樣喔囉嘛咱俺"
);

export type LineClass = "ja" | "zh" | "han" | "latin" | "none";

export function classifyLine(text: string): LineClass {
  const kana = text.match(KANA_RE)?.length ?? 0;
  const han = text.match(HAN_RE)?.length ?? 0;
  if (kana >= 2 || (kana === 1 && han <= 3)) return "ja";
  if (han > 0) {
    for (const char of text) if (ZH_MARKERS.has(char)) return "zh";
    return "han";
  }
  if ((text.match(LATIN_RE)?.length ?? 0) > 0) return "latin";
  return "none";
}

interface SlotStats {
  lines: number;
  ja: number;
  zh: number;
  han: number;
}

export interface LangProfile {
  langs: SubtitleLang[];
  bilingual: boolean;
}

/**
 * Assign a language to every line of a track.
 *
 * Kana is decisive for Japanese; for han-only and latin lines we look at the
 * "slot" (ASS style or line position) the line lives in and use the majority
 * language of that slot. A track is bilingual when one slot is mostly Japanese
 * and another is mostly Chinese.
 */
export function assignLanguages(
  rawCues: RawCue[],
  hint: FileLangHint
): { cues: Cue[]; profile: LangProfile } {
  const stats = new Map<string, SlotStats>();
  const classes = rawCues.map((cue) =>
    cue.lines.map((line) => {
      const cls = classifyLine(line.text);
      const slot = stats.get(line.slot) ?? { lines: 0, ja: 0, zh: 0, han: 0 };
      slot.lines += 1;
      if (cls === "ja") slot.ja += 1;
      else if (cls === "zh") slot.zh += 1;
      else if (cls === "han") slot.han += 1;
      stats.set(line.slot, slot);
      return cls;
    })
  );

  const slotLang = new Map<string, SubtitleLang | null>();
  let totalJa = 0;
  let totalCjk = 0;
  for (const [slot, s] of stats) {
    const cjk = s.ja + s.zh + s.han;
    totalJa += s.ja;
    totalCjk += cjk;
    slotLang.set(slot, cjk === 0 ? null : s.ja / cjk >= 0.5 ? "ja" : "zh");
  }

  const minSlotLines = Math.max(3, Math.floor(rawCues.length * 0.1));
  let hasJaSlot = false;
  let hasZhSlot = false;
  for (const [slot, lang] of slotLang) {
    if ((stats.get(slot)?.lines ?? 0) < minSlotLines) continue;
    if (lang === "ja") hasJaSlot = true;
    if (lang === "zh") hasZhSlot = true;
  }

  const hintSingle = hint.langs.length === 1 ? hint.langs[0] : null;
  const bilingual = !hintSingle && hasJaSlot && hasZhSlot;

  let trackLang: SubtitleLang;
  if (hintSingle) trackLang = hintSingle;
  else if (totalCjk === 0) trackLang = "other";
  else trackLang = totalJa / totalCjk >= 0.3 ? "ja" : "zh";

  const cues: Cue[] = rawCues.map((cue, cueIndex) => ({
    start: cue.start,
    end: cue.end,
    lines: cue.lines.map((line, lineIndex) => {
      if (!bilingual) return { text: line.text, lang: trackLang };
      const cls = classes[cueIndex][lineIndex];
      if (cls === "ja") return { text: line.text, lang: "ja" as const };
      if (cls === "zh") return { text: line.text, lang: "zh" as const };
      return { text: line.text, lang: slotLang.get(line.slot) ?? "other" };
    }),
  }));

  const langs = new Set<SubtitleLang>();
  for (const cue of cues) for (const line of cue.lines) langs.add(line.lang);
  const ordered = (["zh", "ja", "other"] as const).filter((lang) => langs.has(lang));

  return {
    cues,
    profile: {
      langs: ordered,
      bilingual: langs.has("zh") && langs.has("ja"),
    },
  };
}
