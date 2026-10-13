import { useTranslation } from "react-i18next";
import { Play } from "lucide-react";
import { SettingsGroup, SettingsRow } from "@/components/app/SettingsGroup";
import { ValueSlider } from "@/components/app/ValueSlider";
import { SegmentedControl } from "@/components/qiuye-ui/segmented-control";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EFFECT_PARAMS, LINE_EFFECTS, MOTION_EASINGS, MOTION_LIMITS, SLIDE_DIRECTIONS } from "@/shared/motion";
import type { LineEffect, MotionEasing, SlideDirection, SubtitleMotion } from "@/shared/types";
import useAppStore from "@/store/useAppStore";

const ms = (v: number) => `${v}ms`;

/** Transition settings: the effect between lines, its parameters, and the overlay's show / hide fade. */
export function MotionGroup({ onPreview }: { onPreview: () => void }) {
  const { t } = useTranslation();
  const motion = useAppStore((s) => s.settings.style.motion);
  const updateStyle = useAppStore((s) => s.updateStyle);
  const set = (patch: Partial<SubtitleMotion>) => updateStyle({ motion: patch });
  const params = EFFECT_PARAMS[motion.effect];
  const animated = motion.effect !== "none";

  return (
    <SettingsGroup
      title={t("appearance:motion.title")}
      description={t("appearance:motion.description")}
      action={
        <Button variant="ghost" size="sm" className="h-7 text-muted-foreground" onClick={onPreview}>
          <Play className="size-3.5" />
          {t("appearance:motion.preview")}
        </Button>
      }
    >
      <SettingsRow
        label={t("appearance:motion.effect")}
        description={t(`appearance:motion.effect_hints.${motion.effect}`)}
        stacked
      >
        <SegmentedControl
          aria-label={t("appearance:motion.effect")}
          size="sm"
          variant="contained"
          fullWidth
          itemClassName="min-w-0 px-1.5"
          value={motion.effect}
          onValueChange={(value) => set({ effect: value as LineEffect })}
          items={LINE_EFFECTS.map((effect) => ({
            value: effect,
            label: t(`appearance:motion.effects.${effect}`),
          }))}
        />
      </SettingsRow>

      {animated ? (
        <>
          <SettingsRow label={t("appearance:motion.enter")}>
            <ValueSlider
              value={motion.enterMs}
              {...MOTION_LIMITS.enterMs}
              onChange={(enterMs) => set({ enterMs })}
              format={ms}
              width={240}
            />
          </SettingsRow>
          <SettingsRow label={t("appearance:motion.exit")}>
            <ValueSlider
              value={motion.exitMs}
              {...MOTION_LIMITS.exitMs}
              onChange={(exitMs) => set({ exitMs })}
              format={ms}
              width={240}
            />
          </SettingsRow>
          <SettingsRow label={t("appearance:motion.easing")}>
            <Select value={motion.easing} onValueChange={(value) => set({ easing: value as MotionEasing })}>
              <SelectTrigger size="sm" className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                {MOTION_EASINGS.map((easing) => (
                  <SelectItem key={easing} value={easing}>
                    {t(`appearance:motion.easings.${easing}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingsRow>

          {params.includes("blur") ? (
            <SettingsRow label={t("appearance:motion.blur")}>
              <ValueSlider
                value={motion.blur}
                {...MOTION_LIMITS.blur}
                onChange={(blur) => set({ blur })}
                format={(v) => `${v}px`}
                width={240}
              />
            </SettingsRow>
          ) : null}
          {params.includes("direction") ? (
            <SettingsRow label={t("appearance:motion.direction")}>
              <SegmentedControl
                aria-label={t("appearance:motion.direction")}
                size="sm"
                variant="contained"
                value={motion.direction}
                onValueChange={(value) => set({ direction: value as SlideDirection })}
                items={SLIDE_DIRECTIONS.map((direction) => ({
                  value: direction,
                  label: t(`appearance:motion.directions.${direction}`),
                }))}
              />
            </SettingsRow>
          ) : null}
          {params.includes("distance") ? (
            <SettingsRow label={t("appearance:motion.distance")}>
              <ValueSlider
                value={motion.distance}
                {...MOTION_LIMITS.distance}
                onChange={(distance) => set({ distance })}
                format={(v) => `${v}px`}
                width={240}
              />
            </SettingsRow>
          ) : null}
          {params.includes("zoom") ? (
            <SettingsRow label={t("appearance:motion.zoom")}>
              <ValueSlider
                value={Math.round(motion.zoom * 100)}
                min={MOTION_LIMITS.zoom.min * 100}
                max={MOTION_LIMITS.zoom.max * 100}
                onChange={(v) => set({ zoom: v / 100 })}
                format={(v) => `${v}%`}
                width={240}
              />
            </SettingsRow>
          ) : null}

          <SettingsRow label={t("appearance:motion.overlap")} description={t("appearance:motion.overlap_hint")}>
            <SegmentedControl
              aria-label={t("appearance:motion.overlap")}
              size="sm"
              variant="contained"
              value={motion.overlap}
              onValueChange={(value) => set({ overlap: value as SubtitleMotion["overlap"] })}
              items={(["cross", "sequential"] as const).map((overlap) => ({
                value: overlap,
                label: t(`appearance:motion.overlaps.${overlap}`),
              }))}
            />
          </SettingsRow>
        </>
      ) : null}

      <SettingsRow label={t("appearance:motion.bridge")} description={t("appearance:motion.bridge_hint")}>
        <ValueSlider
          value={motion.bridgeMs}
          {...MOTION_LIMITS.bridgeMs}
          onChange={(bridgeMs) => set({ bridgeMs })}
          format={(v) => (v === 0 ? t("appearance:motion.off") : ms(v))}
          width={240}
        />
      </SettingsRow>
      <SettingsRow label={t("appearance:motion.toggle")} description={t("appearance:motion.toggle_hint")}>
        <ValueSlider
          value={motion.toggleMs}
          {...MOTION_LIMITS.toggleMs}
          onChange={(toggleMs) => set({ toggleMs })}
          format={(v) => (v === 0 ? t("appearance:motion.off") : ms(v))}
          width={240}
        />
      </SettingsRow>
    </SettingsGroup>
  );
}
