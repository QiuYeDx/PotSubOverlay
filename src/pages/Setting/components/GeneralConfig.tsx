import { useTranslation } from "react-i18next";
import { SettingsGroup, SettingsRow } from "@/components/app/SettingsGroup";
import { SegmentedControl } from "@/components/qiuye-ui/segmented-control";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import useLanguage from "@/hooks/useLanguage";
import useThemeStore from "@/store/useThemeStore";
import { LangEnum } from "@/type/lang";
import type { ThemeValue } from "@/utils/common";

const LANGUAGES: [LangEnum, string][] = [
  [LangEnum.ZH, "common:lang.zh"],
  [LangEnum.ZH_HANT, "common:lang.zh-Hant"],
  [LangEnum.JA, "common:lang.ja"],
  [LangEnum.EN, "common:lang.en"],
];

function GeneralConfig() {
  const { t } = useTranslation();
  const { language, changeLanguage } = useLanguage();
  const { theme, setTheme } = useThemeStore();

  return (
    <SettingsGroup title={t("setting:subtitle.general_config")}>
      <SettingsRow label={t("setting:fields.language")}>
        <Select value={language} onValueChange={(value) => changeLanguage(value as LangEnum)}>
          <SelectTrigger size="sm" className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            {LANGUAGES.map(([value, labelKey]) => (
              <SelectItem key={value} value={value}>
                {t(labelKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingsRow>
      <SettingsRow label={t("setting:fields.theme")}>
        <SegmentedControl
          aria-label={t("setting:fields.theme")}
          size="sm"
          variant="contained"
          value={theme}
          onValueChange={(value) => setTheme(value as ThemeValue)}
          items={(["light", "dark", "system"] as const).map((value) => ({
            value,
            label: t(`setting:fields.${value}_mode`),
          }))}
        />
      </SettingsRow>
    </SettingsGroup>
  );
}

export default GeneralConfig;
