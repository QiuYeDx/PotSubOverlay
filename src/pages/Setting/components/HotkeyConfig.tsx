import { useTranslation } from "react-i18next";
import { RotateCcw } from "lucide-react";
import { HotkeyRecorder } from "@/components/app/HotkeyRecorder";
import { SettingsGroup, SettingsRow } from "@/components/app/SettingsGroup";
import { Button } from "@/components/ui/button";
import { HOTKEY_ACTIONS } from "@/shared/defaults";
import useAppStore from "@/store/useAppStore";

function HotkeyConfig() {
  const { t } = useTranslation();
  const hotkeys = useAppStore((s) => s.settings.hotkeys);
  const step = useAppStore((s) => s.settings.offsetStepMs);
  const failures = useAppStore((s) => s.hotkeyFailures);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const resetSettings = useAppStore((s) => s.resetSettings);
  const stepLabel = `${(step / 1000).toFixed(1)}s`;

  return (
    <SettingsGroup
      title={t("setting:hotkeys.title")}
      description={t("setting:hotkeys.description")}
      action={
        <Button variant="ghost" size="sm" className="h-7 text-muted-foreground" onClick={() => resetSettings(["hotkeys"])}>
          <RotateCcw className="size-3.5" />
          {t("setting:hotkeys.reset")}
        </Button>
      }
    >
      {HOTKEY_ACTIONS.map((action) => (
        <SettingsRow
          key={action}
          label={t(`setting:hotkeys.actions.${action}`, { step: stepLabel })}
        >
          <HotkeyRecorder
            value={hotkeys[action]}
            failed={failures.includes(action)}
            onChange={(accelerator) => updateSettings({ hotkeys: { [action]: accelerator } })}
          />
        </SettingsRow>
      ))}
    </SettingsGroup>
  );
}

export default HotkeyConfig;
