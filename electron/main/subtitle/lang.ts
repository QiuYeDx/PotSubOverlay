import { LATIN_LANGS, type KnownLang, type SubtitleLang } from "@/shared/languages";
import type { Cue, FileLangHint, RawCue } from "./types";

const KANA_RE = /[぀-ゟ゠-ヿㇰ-ㇿｦ-ﾟ]/g;
const HAN_RE = /[㐀-䶿一-鿿豈-﫿]/g;
const HANGUL_RE = /[가-힯ᄀ-ᇿ㄰-㆏]/g;
const CYRILLIC_RE = /[Ѐ-ӿ]/g;
const THAI_RE = /[฀-๿]/g;
const ARABIC_RE = /[؀-ۿݐ-ݿ]/g;
const LATIN_RE = /[A-Za-zÀ-ɏḀ-ỿ]/g;
/** Letters that only Vietnamese uses among Latin-script languages. */
const VIETNAMESE_RE = /[ăđơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹĂĐƠƯ]/g;
/**
 * Characters that are common in Chinese but (practically) never appear in
 * Japanese text. A han-only line containing one of them is Chinese.
 */
const ZH_MARKERS = new Set(
  "们这吗呢么没还让给过个对说话为从时吧啊呀哦嗯谁怎样哪這嗎麼沒讓說對為從樣喔囉嘛咱俺"
);

/**
 * What a single line tells us. "han" (CJK ideographs only) and "latin" are
 * ambiguous: han may be Chinese or Japanese, latin may be any Latin-script
 * language (or romaji / English lyrics inside another language's slot).
 */
export type LineClass = KnownLang | "han" | "latin" | "none";

const count = (text: string, re: RegExp) => text.match(re)?.length ?? 0;

export function classifyLine(text: string): LineClass {
  const kana = count(text, KANA_RE);
  const han = count(text, HAN_RE);
  if (kana >= 2 || (kana === 1 && han <= 3)) return "ja";
  const hangul = count(text, HANGUL_RE);
  if (hangul > 0 && hangul >= han) return "ko";
  if (han > 0) {
    for (const char of text) if (ZH_MARKERS.has(char)) return "zh";
    return "han";
  }
  const scripts: [KnownLang, number][] = [
    ["ru", count(text, CYRILLIC_RE)],
    ["th", count(text, THAI_RE)],
    ["ar", count(text, ARABIC_RE)],
  ];
  const [script, scriptCount] = scripts.sort((a, b) => b[1] - a[1])[0];
  const latin = count(text, LATIN_RE);
  if (scriptCount > 0 && scriptCount >= latin) return script;
  if (latin > 0) return count(text, VIETNAMESE_RE) > 0 ? "vi" : "latin";
  return "none";
}

/** High-frequency function words, enough to tell common Latin-script languages apart. */
const FUNCTION_WORDS: Partial<Record<KnownLang, Set<string>>> = {
  en: new Set("the and you is to of it that in what this my me your are be do not have i'm it's don't we he she they was with for".split(" ")),
  fr: new Set("le la les et est je vous tu des une un pas que qui ce c'est il elle on avec pour mais du au mon ma ne".split(" ")),
  de: new Set("der die das und ist ich du nicht ein eine zu mit sie es wir was auf den dem sich ja nein bin mein".split(" ")),
  es: new Set("el los las y es que no un una por con para lo se qué mi tu yo está pero muy esto".split(" ")),
  pt: new Set("o os as e é que não um uma por com para eu você se mas está isso meu muito também".split(" ")),
  it: new Set("il lo gli e è che di non un una per con io tu sono ma questo cosa mi ti anche".split(" ")),
};

/** Pick the Latin-script language of a set of lines; defaults to English. */
export function detectLatinLanguage(lines: string[], hint: FileLangHint): KnownLang {
  const hinted = hint.langs.filter((lang): lang is KnownLang => LATIN_LANGS.includes(lang as KnownLang));
  if (hinted.length === 1) return hinted[0];

  const scores = new Map<KnownLang, number>();
  for (const line of lines) {
    for (const word of line.toLowerCase().split(/[^a-zà-ÿœ'’]+/)) {
      if (!word) continue;
      for (const [lang, words] of Object.entries(FUNCTION_WORDS) as [KnownLang, Set<string>][]) {
        if (words.has(word.replace("’", "'"))) scores.set(lang, (scores.get(lang) ?? 0) + 1);
      }
    }
  }
  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  const [best, second] = ranked;
  if (!best || best[1] < 3 || (second && best[1] < second[1] * 1.3)) return "en";
  return best[0];
}

interface SlotStats {
  lines: number;
  classes: Map<LineClass, number>;
  latinLines: string[];
}

export interface LangProfile {
  langs: SubtitleLang[];
  bilingual: boolean;
}

/**
 * Resolve the language of a group of lines (a slot or a whole track) from
 * the classes of its lines. CJK lines are pooled so han-only lines follow
 * the Chinese/Japanese majority.
 */
function resolveGroup(stats: SlotStats, hint: FileLangHint): SubtitleLang | null {
  const get = (cls: LineClass) => stats.classes.get(cls) ?? 0;
  const ja = get("ja");
  const cjk = ja + get("zh") + get("han");
  const latin = get("latin");

  let best: { lang: SubtitleLang; score: number } | null = null;
  const consider = (lang: SubtitleLang, score: number) => {
    if (score > 0 && (!best || score > best.score)) best = { lang, score };
  };

  if (cjk > 0) {
    const hintJa = hint.langs.includes("ja") && !hint.langs.includes("zh");
    const hintZh = hint.langs.includes("zh") && !hint.langs.includes("ja");
    // Japanese text is full of kanji-only lines, so 30% kana lines is decisive.
    const lang: KnownLang = hintJa ? "ja" : hintZh ? "zh" : ja / cjk >= 0.3 ? "ja" : "zh";
    consider(lang, cjk);
  }
  for (const lang of ["ko", "ru", "th", "ar", "vi"] as const) consider(lang, get(lang));
  if (latin > 0) consider(detectLatinLanguage(stats.latinLines, hint), latin);
  return best ? (best as { lang: SubtitleLang }).lang : null;
}

function emptyStats(): SlotStats {
  return { lines: 0, classes: new Map(), latinLines: [] };
}

function addLine(stats: SlotStats, cls: LineClass, text: string) {
  stats.lines += 1;
  stats.classes.set(cls, (stats.classes.get(cls) ?? 0) + 1);
  if (cls === "latin") stats.latinLines.push(text);
}

/**
 * Assign a language to every line of a track.
 *
 * Distinctive scripts (kana, hangul, cyrillic…) decide a line on their own.
 * Ambiguous lines (han-only, Latin, punctuation) take the majority language
 * of their "slot" — the ASS style or line position they appear in. A track
 * is bilingual when two well-populated slots resolve to different languages.
 */
export function assignLanguages(
  rawCues: RawCue[],
  hint: FileLangHint
): { cues: Cue[]; profile: LangProfile } {
  const slots = new Map<string, SlotStats>();
  const total = emptyStats();
  const classes = rawCues.map((cue) =>
    cue.lines.map((line) => {
      const cls = classifyLine(line.text);
      const slot = slots.get(line.slot) ?? emptyStats();
      addLine(slot, cls, line.text);
      addLine(total, cls, line.text);
      slots.set(line.slot, slot);
      return cls;
    })
  );

  const slotLang = new Map<string, SubtitleLang | null>();
  for (const [slot, stats] of slots) slotLang.set(slot, resolveGroup(stats, hint));

  const minSlotLines = Math.max(3, Math.floor(rawCues.length * 0.1));
  const majorLangs = new Set<SubtitleLang>();
  for (const [slot, lang] of slotLang) {
    if (lang && (slots.get(slot)?.lines ?? 0) >= minSlotLines) majorLangs.add(lang);
  }

  const hintSingle = hint.langs.length === 1 ? hint.langs[0] : null;
  const bilingual = !hintSingle && majorLangs.size >= 2;
  const trackLang: SubtitleLang = hintSingle ?? resolveGroup(total, hint) ?? "other";

  const cues: Cue[] = rawCues.map((cue, cueIndex) => ({
    start: cue.start,
    end: cue.end,
    lines: cue.lines.map((line, lineIndex) => {
      if (!bilingual) return { text: line.text, lang: trackLang };
      const cls = classes[cueIndex][lineIndex];
      const slot = slotLang.get(line.slot) ?? null;
      if (cls === "han") {
        return { text: line.text, lang: slot === "ja" || slot === "zh" ? slot : "zh" };
      }
      if (cls === "latin" || cls === "none") return { text: line.text, lang: slot ?? "other" };
      return { text: line.text, lang: cls };
    }),
  }));

  const langs = new Set<SubtitleLang>();
  for (const cue of cues) for (const line of cue.lines) langs.add(line.lang);
  const known = [...langs].filter((lang) => lang !== "other");

  return {
    cues,
    profile: {
      langs: [...known, ...(langs.has("other") ? ["other" as const] : [])],
      bilingual: known.length >= 2,
    },
  };
}
