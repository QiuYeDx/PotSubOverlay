import { useTranslation } from "react-i18next";
import { SettingsGroup, SettingsRow } from "@/components/app/SettingsGroup";
import { SegmentedControl } from "@/components/qiuye-ui/segmented-control";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import useLanguageName from "@/hooks/useLanguageName";
import { SUBTITLE_LANGS, type KnownLang } from "@/shared/languages";
import useAppStore from "@/store/useAppStore";
import { PlacementConfig, PlaybackConfig } from "./PlaybackPlacementConfig";

const STEPS = [100, 250, 500, 1000];

function BehaviorConfig() {
  const { t } = useTranslation();
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const nameOf = useLanguageName();

  return (
    <>
      <SettingsGroup title={t("setting:behavior.overlay_title")}>
        <SettingsRow
          label={t("setting:behavior.hide_foreground")}
          description={t("setting:behavior.hide_foreground_hint")}
        >
          <Switch
            checked={settings.hideWhenPlayerForeground}
            onCheckedChange={(hideWhenPlayerForeground) => updateSettings({ hideWhenPlayerForeground })}
          />
        </SettingsRow>
        <SettingsRow
          label={t("setting:behavior.hide_paused")}
          description={t("setting:behavior.hide_paused_hint")}
        >
          <Switch
            checked={settings.hideWhenPaused}
            onCheckedChange={(hideWhenPaused) => updateSettings({ hideWhenPaused })}
          />
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title={t("setting:behavior.subtitle_title")}>
        <SettingsRow
          label={t("setting:behavior.primary_lang")}
          description={t("setting:behavior.primary_lang_hint")}
        >
          <Select
            value={settings.primaryLang}
            onValueChange={(value) => updateSettings({ primaryLang: value as KnownLang })}
          >
            <SelectTrigger size="sm" className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {SUBTITLE_LANGS.map((lang) => (
                <SelectItem key={lang} value={lang}>
                  {nameOf(lang)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingsRow>
        <SettingsRow
          label={t("setting:behavior.filter_signs")}
          description={t("setting:behavior.filter_signs_hint")}
        >
          <Switch
            checked={settings.filterSigns}
            onCheckedChange={(filterSigns) => updateSettings({ filterSigns })}
          />
        </SettingsRow>
        <SettingsRow
          label={t("setting:behavior.variant")}
          description={t("setting:behavior.variant_hint")}
        >
          <SegmentedControl
            aria-label={t("setting:behavior.variant")}
            size="sm"
            variant="contained"
            value={settings.preferVariant}
            onValueChange={(value) => updateSettings({ preferVariant: value as "sc" | "tc" })}
            items={[
              { value: "sc", label: t("setting:behavior.variant_sc") },
              { value: "tc", label: t("setting:behavior.variant_tc") },
            ]}
          />
        </SettingsRow>
        <SettingsRow
          label={t("setting:behavior.offset_step")}
          description={t("setting:behavior.offset_step_hint")}
        >
          <SegmentedControl
            aria-label={t("setting:behavior.offset_step")}
            size="sm"
            variant="contained"
            value={String(settings.offsetStepMs)}
            onValueChange={(value) => updateSettings({ offsetStepMs: Number(value) })}
            items={STEPS.map((step) => ({ value: String(step), label: `${step / 1000}s` }))}
          />
        </SettingsRow>
      </SettingsGroup>

      <PlaybackConfig />
      <PlacementConfig />

      <SettingsGroup title={t("setting:behavior.app_title")}>
        <SettingsRow
          label={t("setting:behavior.close_to_tray")}
          description={t("setting:behavior.close_to_tray_hint")}
        >
          <Switch
            checked={settings.closeToTray}
            onCheckedChange={(closeToTray) => updateSettings({ closeToTray })}
          />
        </SettingsRow>
        <SettingsRow
          label={t("setting:behavior.launch_at_login")}
          description={t("setting:behavior.launch_at_login_hint")}
        >
          <Switch
            checked={settings.launchAtLogin}
            onCheckedChange={(launchAtLogin) => updateSettings({ launchAtLogin })}
          />
        </SettingsRow>
        <SettingsRow
          label={t("setting:behavior.compact_on_top")}
          description={t("setting:behavior.compact_on_top_hint")}
        >
          <Switch
            checked={settings.compactAlwaysOnTop}
            onCheckedChange={(compactAlwaysOnTop) => updateSettings({ compactAlwaysOnTop })}
          />
        </SettingsRow>
      </SettingsGroup>
    </>
  );
}

export default BehaviorConfig;
