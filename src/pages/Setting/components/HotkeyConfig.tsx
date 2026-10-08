import { useTranslation } from "react-i18next";
import { RotateCcw } from "lucide-react";
import { HotkeyRecorder } from "@/components/app/HotkeyRecorder";
import { SettingsGroup, SettingsRow } from "@/components/app/SettingsGroup";
import { Button } from "@/components/ui/button";
import { HOTKEY_GROUPS } from "@/shared/defaults";
import useAppStore from "@/store/useAppStore";

const seconds = (ms: number) => `${Number((ms / 1000).toFixed(1))}s`;

function HotkeyConfig() {
  const { t } = useTranslation();
  const hotkeys = useAppStore((s) => s.settings.hotkeys);
  const offsetStep = useAppStore((s) => s.settings.offsetStepMs);
  const seekStep = useAppStore((s) => s.settings.seekStepMs);
  const failures = useAppStore((s) => s.hotkeyFailures);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const resetSettings = useAppStore((s) => s.resetSettings);

  return (
    <>
      {HOTKEY_GROUPS.map((group, index) => (
        <SettingsGroup
          key={group.key}
          title={t(`setting:hotkeys.groups.${group.key}.title`)}
          description={t(`setting:hotkeys.groups.${group.key}.description`)}
          action={
            index === 0 ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-muted-foreground"
                onClick={() => resetSettings(["hotkeys"])}
              >
                <RotateCcw className="size-3.5" />
                {t("setting:hotkeys.reset")}
              </Button>
            ) : undefined
          }
        >
          {group.actions.map((action) => (
            <SettingsRow
              key={action}
              label={t(`setting:hotkeys.actions.${action}`, {
                step: action === "seekBackward" || action === "seekForward" ? seconds(seekStep) : seconds(offsetStep),
              })}
            >
              <HotkeyRecorder
                value={hotkeys[action]}
                failed={failures.includes(action)}
                onChange={(accelerator) => updateSettings({ hotkeys: { [action]: accelerator } })}
              />
            </SettingsRow>
          ))}
        </SettingsGroup>
      ))}
    </>
  );
}

export default HotkeyConfig;
