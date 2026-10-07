import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { languageName, type SubtitleLang } from "@/shared/languages";

/** Display name of a subtitle language in the current UI language. */
export default function useLanguageName() {
  const { i18n } = useTranslation();
  const locale = i18n.resolvedLanguage || i18n.language;
  return useCallback((lang: SubtitleLang) => languageName(lang, locale), [locale]);
}
