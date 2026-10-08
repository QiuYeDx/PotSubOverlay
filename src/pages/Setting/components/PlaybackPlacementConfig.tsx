import { AnimatePresence, motion } from "motion/react";
import { AppWindow, Info, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SettingsGroup, SettingsRow } from "@/components/app/SettingsGroup";
import { SegmentedControl } from "@/components/qiuye-ui/segmented-control";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import useAppStore from "@/store/useAppStore";

const SEEK_STEPS = [2000, 5000, 10000, 30000];
const percent = (value: number) => `${Math.round(value * 100)}%`;
const shortcutText = (accelerator: string) => accelerator.replace(/Control/g, "Ctrl");

export function PlaybackConfig() {
  const { t } = useTranslation();
  const seekStepMs = useAppStore((s) => s.settings.seekStepMs);
  const keyframeSeek = useAppStore((s) => s.snapshot.keyframeSeek);
  const updateSettings = useAppStore((s) => s.updateSettings);

  return (
    <SettingsGroup
      title={t("setting:behavior.playback_title")}
      description={t("setting:behavior.playback_desc")}
    >
      <SettingsRow
        label={t("setting:behavior.seek_step")}
        description={t("setting:behavior.seek_step_hint")}
      >
        <SegmentedControl
          aria-label={t("setting:behavior.seek_step")}
          size="sm"
          variant="contained"
          value={String(seekStepMs)}
          onValueChange={(value) => updateSettings({ seekStepMs: Number(value) })}
          items={SEEK_STEPS.map((step) => ({ value: String(step), label: `${step / 1000}s` }))}
        />
      </SettingsRow>
      <AnimatePresence initial={false}>
        {keyframeSeek ? (
          <motion.div
            key="keyframe"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", duration: 0.35, bounce: 0 }}
            className="overflow-hidden"
          >
            <div className="flex gap-2.5 px-4 py-3 text-xs leading-5 text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
              <div>
                <div className="font-medium text-foreground">{t("setting:behavior.keyframe_title")}</div>
                {t("setting:behavior.keyframe_hint")}
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </SettingsGroup>
  );
}

export function PlacementConfig() {
  const { t } = useTranslation();
  const settings = useAppStore((s) => s.settings);
  const placementApp = useAppStore((s) => s.snapshot.placementApp);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const removeProfile = useAppStore((s) => s.removePlacementProfile);
  const profiles = Object.entries(settings.placementProfiles).sort(
    ([, a], [, b]) => b.touched - a.touched
  );

  return (
    <SettingsGroup title={t("setting:behavior.placement_title")}>
      <SettingsRow
        label={t("setting:behavior.auto_placement")}
        description={t("setting:behavior.auto_placement_hint")}
      >
        <Switch
          checked={settings.autoPlacement}
          onCheckedChange={(autoPlacement) => updateSettings({ autoPlacement })}
        />
      </SettingsRow>
      {profiles.length === 0 ? (
        <div className="px-4 py-3 text-xs leading-5 text-muted-foreground">
          {t("setting:behavior.profiles_empty", {
            key: settings.hotkeys.toggleEdit ? shortcutText(settings.hotkeys.toggleEdit) : t("setting:hotkeys.actions.toggleEdit"),
          })}
        </div>
      ) : (
        profiles.map(([app, profile]) => (
          <div
            key={app}
            className={settingsRowClass(!settings.autoPlacement)}
          >
            <AppWindow className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-[13px] font-medium" title={app}>
                  {app}
                </span>
                {placementApp === app ? (
                  <span className="shrink-0 rounded-[5px] bg-emerald-500/12 px-1.5 py-px text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                    {t("setting:behavior.profile_active")}
                  </span>
                ) : null}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                {t("setting:behavior.profile_summary", {
                  x: percent(profile.placement.x),
                  y: percent(profile.placement.y),
                  width: percent(profile.placement.width),
                })}
              </div>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-7 text-muted-foreground hover:text-destructive"
                  aria-label={t("setting:behavior.profile_remove")}
                  onClick={() => removeProfile(app)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("setting:behavior.profile_remove")}</TooltipContent>
            </Tooltip>
          </div>
        ))
      )}
    </SettingsGroup>
  );
}

function settingsRowClass(dimmed: boolean) {
  return `flex items-center gap-3 px-4 py-2.5 transition-opacity ${dimmed ? "opacity-50" : ""}`;
}
