import path from "node:path";
import type { KnownLang, SubtitleLang } from "@/shared/languages";
import type { FileLangHint, SubtitleFormat } from "./types";

export const SUBTITLE_EXTENSIONS: readonly SubtitleFormat[] = ["srt", "ass", "ssa", "vtt", "lrc"];

export interface SubtitleCandidate {
  path: string;
  fileName: string;
  format: SubtitleFormat;
  /** Text between the media name and the extension, e.g. "scjp" or "ja". */
  tag: string;
}

/**
 * Pick the subtitle files that belong to a media file from a directory listing.
 * Matches `name.ext`, `name.<tag>.ext` and `name.mp3.ext` (full media name + extension).
 */
export function matchSubtitleFiles(mediaPath: string, entries: string[]): SubtitleCandidate[] {
  const dir = path.dirname(mediaPath);
  const full = path.basename(mediaPath).toLowerCase();
  const base = path.parse(mediaPath).name.toLowerCase();
  const result: SubtitleCandidate[] = [];

  for (const fileName of entries) {
    const ext = path.extname(fileName).slice(1).toLowerCase() as SubtitleFormat;
    if (!SUBTITLE_EXTENSIONS.includes(ext)) continue;
    const stem = fileName.slice(0, -(ext.length + 1));
    const lower = stem.toLowerCase();

    let tag: string | null = null;
    if (lower === full || lower === base) tag = "";
    else if (lower.startsWith(`${full}.`)) tag = stem.slice(full.length + 1);
    else if (lower.startsWith(`${base}.`)) tag = stem.slice(base.length + 1);
    if (tag === null) continue;

    result.push({ path: path.join(dir, fileName), fileName, format: ext, tag });
  }
  return result;
}

/** Tag tokens per language. Combined tags ("scjp", "chseng", "简英") are split greedily. */
const LANG_TOKENS: Record<KnownLang, string[]> = {
  zh: ["zh", "chs", "cht", "sc", "tc", "cn", "chi", "zho", "gb", "big5", "hans", "hant", "chinese", "zhcn", "zhtw", "zhhans", "zhhant", "简体", "繁体", "简中", "繁中", "中文", "简", "繁", "中"],
  ja: ["ja", "jp", "jpn", "jap", "japanese", "日本語", "日文", "日语", "日"],
  ko: ["ko", "kor", "kr", "korean", "韩文", "韩语", "韩", "韓"],
  en: ["en", "eng", "english", "英文", "英语", "英"],
  fr: ["fr", "fre", "fra", "french", "法语", "法"],
  de: ["de", "ger", "deu", "german", "德语", "德"],
  es: ["es", "spa", "spanish", "西班牙语", "西语"],
  pt: ["pt", "por", "ptbr", "portuguese", "葡萄牙语", "葡语"],
  it: ["it", "ita", "italian", "意大利语", "意语"],
  ru: ["ru", "rus", "russian", "俄语", "俄"],
  th: ["th", "tha", "thai", "泰语", "泰"],
  vi: ["vi", "vie", "vietnamese", "越南语", "越"],
  ar: ["ar", "ara", "arabic", "阿拉伯语"],
};
const SC_TOKENS = new Set(["sc", "chs", "hans", "zhhans", "gb", "简", "简体", "简中", "zhcn"]);
const TC_TOKENS = new Set(["tc", "cht", "hant", "zhhant", "big5", "繁", "繁体", "繁中", "zhtw"]);
/** Words that may follow language tokens without meaning anything themselves. */
const FILLER = ["双语", "雙語", "字幕", "bilingual", "dual", "sub", "subs"];

const TOKEN_TO_LANG = new Map<string, KnownLang>();
for (const [lang, tokens] of Object.entries(LANG_TOKENS) as [KnownLang, string[]][]) {
  for (const token of tokens) TOKEN_TO_LANG.set(token, lang);
}
// Longest first so "chs" wins over "c…", "日本語" over "日".
const ALL_TOKENS = [...TOKEN_TO_LANG.keys(), ...FILLER].sort((a, b) => b.length - a.length);

/** Split "scjp" into ["sc", "jp"]; returns null when the word is not made of known tokens. */
function splitCombined(word: string): string[] | null {
  if (!word) return [];
  for (const token of ALL_TOKENS) {
    if (!word.startsWith(token)) continue;
    const rest = splitCombined(word.slice(token.length));
    if (rest) return [token, ...rest];
  }
  return null;
}

export function parseLangHint(tag: string): FileLangHint {
  const words = tag
    .toLowerCase()
    .split(/[.\s_\-&+,()[\]]+/)
    .filter(Boolean);
  const langs: SubtitleLang[] = [];
  let variant: FileLangHint["variant"] = null;

  for (const word of words) {
    for (const token of splitCombined(word) ?? []) {
      const lang = TOKEN_TO_LANG.get(token);
      if (lang && !langs.includes(lang)) langs.push(lang);
      if (SC_TOKENS.has(token)) variant = "sc";
      else if (TC_TOKENS.has(token)) variant = "tc";
    }
  }

  return { langs, variant };
}
