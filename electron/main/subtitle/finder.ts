import path from "node:path";
import type { SubtitleLang } from "@/shared/types";
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
 * Matches `name.ext`, `name.<tag>.ext` and `name.mp3.ext` (asmr.one style).
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

const ZH_TOKENS = new Set([
  "zh", "chs", "cht", "sc", "tc", "cn", "chi", "zho", "gb", "big5", "hans", "hant",
  "简", "繁", "简体", "繁体", "简中", "繁中", "中文", "中", "chinese", "zhcn", "zhtw",
]);
const JA_TOKENS = new Set(["ja", "jp", "jpn", "jap", "japanese", "日", "日文", "日语", "日本語"]);
const BILINGUAL_TOKENS = new Set([
  "scjp", "tcjp", "jpsc", "jptc", "chsjp", "chtjp", "jpchs", "jpcht", "chsjpn", "chtjpn",
  "简日", "繁日", "简日双语", "繁日双语", "中日", "中日双语", "日中", "双语", "雙語",
]);
const OTHER_TOKENS = new Set(["en", "eng", "english", "ko", "kor"]);
const SC_TOKENS = new Set(["sc", "chs", "hans", "gb", "简", "简体", "简中", "zhcn", "scjp", "jpsc", "chsjp", "jpchs", "chsjpn", "简日", "简日双语"]);
const TC_TOKENS = new Set(["tc", "cht", "hant", "big5", "繁", "繁体", "繁中", "zhtw", "tcjp", "jptc", "chtjp", "jpcht", "chtjpn", "繁日", "繁日双语"]);

export function parseLangHint(tag: string): FileLangHint {
  const tokens = tag
    .toLowerCase()
    .split(/[.\s_\-&+,()[\]]+/)
    .filter(Boolean);
  const langs = new Set<SubtitleLang>();
  let variant: FileLangHint["variant"] = null;

  for (const token of tokens) {
    if (BILINGUAL_TOKENS.has(token)) {
      langs.add("zh");
      langs.add("ja");
    } else if (ZH_TOKENS.has(token)) langs.add("zh");
    else if (JA_TOKENS.has(token)) langs.add("ja");
    else if (OTHER_TOKENS.has(token)) langs.add("other");

    if (SC_TOKENS.has(token)) variant = "sc";
    else if (TC_TOKENS.has(token)) variant = "tc";
  }

  return { langs: [...langs], variant };
}
