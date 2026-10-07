/**
 * Subtitle languages PotSubOverlay recognises. Shared by the main process
 * (detection, tray labels) and both renderers (labels, fonts, samples).
 */

export const SUBTITLE_LANGS = [
  "zh",
  "ja",
  "ko",
  "en",
  "fr",
  "de",
  "es",
  "pt",
  "it",
  "ru",
  "th",
  "vi",
  "ar",
] as const;

export type KnownLang = (typeof SUBTITLE_LANGS)[number];
export type SubtitleLang = KnownLang | "other";

/** Languages written with Latin letters; told apart by function words. */
export const LATIN_LANGS: readonly KnownLang[] = ["en", "fr", "de", "es", "pt", "it", "vi"];

export type UiLocale = "zh" | "zh-Hant" | "en" | "ja";

const NAMES: Record<SubtitleLang, Record<UiLocale, string>> = {
  zh: { zh: "中文", "zh-Hant": "中文", en: "Chinese", ja: "中国語" },
  ja: { zh: "日语", "zh-Hant": "日語", en: "Japanese", ja: "日本語" },
  ko: { zh: "韩语", "zh-Hant": "韓語", en: "Korean", ja: "韓国語" },
  en: { zh: "英语", "zh-Hant": "英語", en: "English", ja: "英語" },
  fr: { zh: "法语", "zh-Hant": "法語", en: "French", ja: "フランス語" },
  de: { zh: "德语", "zh-Hant": "德語", en: "German", ja: "ドイツ語" },
  es: { zh: "西班牙语", "zh-Hant": "西班牙語", en: "Spanish", ja: "スペイン語" },
  pt: { zh: "葡萄牙语", "zh-Hant": "葡萄牙語", en: "Portuguese", ja: "ポルトガル語" },
  it: { zh: "意大利语", "zh-Hant": "義大利語", en: "Italian", ja: "イタリア語" },
  ru: { zh: "俄语", "zh-Hant": "俄語", en: "Russian", ja: "ロシア語" },
  th: { zh: "泰语", "zh-Hant": "泰語", en: "Thai", ja: "タイ語" },
  vi: { zh: "越南语", "zh-Hant": "越南語", en: "Vietnamese", ja: "ベトナム語" },
  ar: { zh: "阿拉伯语", "zh-Hant": "阿拉伯語", en: "Arabic", ja: "アラビア語" },
  other: { zh: "其他", "zh-Hant": "其他", en: "Other", ja: "その他" },
};

export function toUiLocale(locale: string | undefined): UiLocale {
  if (!locale) return "zh";
  if (locale === "zh-Hant" || /^zh[-_](tw|hk|mo|hant)/i.test(locale)) return "zh-Hant";
  if (locale.startsWith("zh")) return "zh";
  if (locale.startsWith("ja")) return "ja";
  if (locale.startsWith("en")) return "en";
  return "zh";
}

export function languageName(lang: SubtitleLang, locale: string | undefined): string {
  return NAMES[lang][toUiLocale(locale)];
}

export const HTML_LANG: Record<SubtitleLang, string> = {
  zh: "zh-CN",
  ja: "ja",
  ko: "ko",
  en: "en",
  fr: "fr",
  de: "de",
  es: "es",
  pt: "pt",
  it: "it",
  ru: "ru",
  th: "th",
  vi: "vi",
  ar: "ar",
  other: "und",
};

const LATIN_STACK = '"Segoe UI Variable Display", "Segoe UI", system-ui, sans-serif';

/** Font stack used when a style's font is "auto" (empty), and as fallback. */
export const FONT_STACK: Record<SubtitleLang, string> = {
  zh: '"Microsoft YaHei UI", "PingFang SC", "Noto Sans SC", sans-serif',
  ja: '"Yu Gothic UI", "Meiryo", "Noto Sans JP", sans-serif',
  ko: '"Malgun Gothic", "Noto Sans KR", sans-serif',
  en: LATIN_STACK,
  fr: LATIN_STACK,
  de: LATIN_STACK,
  es: LATIN_STACK,
  pt: LATIN_STACK,
  it: LATIN_STACK,
  ru: LATIN_STACK,
  vi: LATIN_STACK,
  th: '"Leelawadee UI", "Tahoma", sans-serif',
  ar: '"Segoe UI", "Tahoma", sans-serif',
  other: LATIN_STACK,
};

/** Fonts offered first in the font picker for each language. */
export const RECOMMENDED_FONTS: Record<SubtitleLang, string[]> = {
  zh: ["Microsoft YaHei UI", "HarmonyOS Sans SC", "Source Han Sans SC", "Noto Sans SC", "MiSans", "LXGW WenKai", "SimHei"],
  ja: ["Yu Gothic UI", "Meiryo UI", "Source Han Sans JP", "Noto Sans JP", "BIZ UDPGothic", "M PLUS 1p", "Yu Mincho"],
  ko: ["Malgun Gothic", "Noto Sans KR", "Source Han Sans KR", "Pretendard", "NanumGothic"],
  en: ["Segoe UI Variable Display", "Segoe UI", "Arial", "Verdana", "Inter", "Roboto"],
  fr: ["Segoe UI Variable Display", "Segoe UI", "Arial", "Verdana", "Inter"],
  de: ["Segoe UI Variable Display", "Segoe UI", "Arial", "Verdana", "Inter"],
  es: ["Segoe UI Variable Display", "Segoe UI", "Arial", "Verdana", "Inter"],
  pt: ["Segoe UI Variable Display", "Segoe UI", "Arial", "Verdana", "Inter"],
  it: ["Segoe UI Variable Display", "Segoe UI", "Arial", "Verdana", "Inter"],
  ru: ["Segoe UI Variable Display", "Segoe UI", "Arial", "Verdana", "Roboto"],
  vi: ["Segoe UI Variable Display", "Segoe UI", "Arial", "Roboto"],
  th: ["Leelawadee UI", "Tahoma", "Noto Sans Thai"],
  ar: ["Segoe UI", "Tahoma", "Noto Sans Arabic"],
  other: ["Segoe UI", "Arial", "Microsoft YaHei UI"],
};

/** One line per language for previews (the edit stage and the appearance page). */
export const SAMPLE_TEXT: Record<SubtitleLang, string> = {
  zh: "接下来将为您展现的是",
  ja: "これから ご覧に入れますのは",
  ko: "지금부터 보여드릴 것은",
  en: "What you are about to see is",
  fr: "Ce que vous allez voir maintenant",
  de: "Was Sie gleich sehen werden",
  es: "Lo que estás a punto de ver",
  pt: "O que você vai ver agora",
  it: "Quello che state per vedere",
  ru: "Сейчас вы увидите",
  th: "สิ่งที่คุณกำลังจะได้เห็นคือ",
  vi: "Điều bạn sắp được xem là",
  ar: "ما ستشاهده الآن هو",
  other: "Sample subtitle",
};

export function isSubtitleLang(value: unknown): value is SubtitleLang {
  return value === "other" || (SUBTITLE_LANGS as readonly unknown[]).includes(value);
}
