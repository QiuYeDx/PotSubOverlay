import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { RotateCcw } from "lucide-react";
import { FontPicker } from "@/components/app/FontPicker";
import { SettingsGroup, SettingsRow } from "@/components/app/SettingsGroup";
import { SubtitleStage } from "@/components/app/SubtitleStage";
import { ValueSlider } from "@/components/app/ValueSlider";
import { ColorPicker } from "@/components/qiuye-ui/color-picker";
import { SegmentedControl } from "@/components/qiuye-ui/segmented-control";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import useLanguageName from "@/hooks/useLanguageName";
import { RECOMMENDED_FONTS, SAMPLE_TEXT, type SubtitleLang } from "@/shared/languages";
import type { DisplayPayload, LangOrder, LangRole } from "@/shared/types";
import useAppStore from "@/store/useAppStore";

const WEIGHTS = [400, 500, 600, 700, 900];

function Appearance() {
  const { t } = useTranslation();
  const settings = useAppStore((s) => s.settings);
  const liveDisplay = useAppStore((s) => s.snapshot.display);
  const roles = useAppStore((s) => s.snapshot.roles);
  const nameOf = useLanguageName();
  const updateStyle = useAppStore((s) => s.updateStyle);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const resetSettings = useAppStore((s) => s.resetSettings);
  const [role, setRole] = useState<LangRole>("primary");
  const [source, setSource] = useState<"sample" | "live">("sample");
  const style = settings.style;
  const text = style[role];

  // Preview with the languages of what is playing, or sensible stand-ins.
  const primaryLang: SubtitleLang = roles.primary ?? settings.primaryLang;
  const secondaryLang: SubtitleLang = roles.secondary ?? (primaryLang === "en" ? "zh" : "en");
  const roleLang = role === "primary" ? primaryLang : secondaryLang;

  const sample: DisplayPayload = useMemo(() => {
    const primary = { lang: primaryLang, role: "primary" as const, lines: [SAMPLE_TEXT[primaryLang]] };
    const secondary = { lang: secondaryLang, role: "secondary" as const, lines: [SAMPLE_TEXT[secondaryLang]] };
    return {
      key: `sample-${settings.langOrder}-${primaryLang}-${secondaryLang}`,
      blocks: settings.langOrder === "primary-first" ? [primary, secondary] : [secondary, primary],
    };
  }, [settings.langOrder, primaryLang, secondaryLang]);

  const hasLive = liveDisplay.blocks.length > 0;
  const display = source === "live" && hasLive ? liveDisplay : sample;

  return (
    <div className="mx-auto flex max-w-[940px] flex-col gap-5 px-6 pb-[92px] pt-1">
      <div className="sticky top-0 z-20 -mx-6 -mt-[52px] bg-background/85 px-6 pt-[52px] pb-3 backdrop-blur-xl">
        <SubtitleStage
          display={display}
          style={style}
          placement={settings.placement}
          minScale={0.62}
          maxScale={0.9}
          className="h-[176px]"
          placeholder={t("appearance:preview.silent")}
        >
          <div className="absolute top-3 right-3">
            <SegmentedControl
              aria-label={t("appearance:preview.source")}
              size="sm"
              variant="contained"
              value={source}
              onValueChange={(value) => setSource(value as "sample" | "live")}
              className="bg-white/10 backdrop-blur-md"
              indicatorClassName="border-white/15 bg-white/20 dark:border-white/15 dark:bg-white/20"
              itemClassName="text-white/60 data-[state=active]:text-white"
              items={[
                { value: "sample", label: t("appearance:preview.sample") },
                { value: "live", label: t("appearance:preview.live"), disabled: !hasLive },
              ]}
            />
          </div>
        </SubtitleStage>
      </div>

      <div className="grid grid-cols-2 items-start gap-5 max-[880px]:grid-cols-1">
        <div className="flex flex-col gap-5">
          <SettingsGroup
            title={t("appearance:text.title")}
            description={t("appearance:text.description", {
              primary: nameOf(primaryLang),
              secondary: nameOf(secondaryLang),
            })}
            action={
              <SegmentedControl
                aria-label={t("appearance:text.role")}
                size="sm"
                variant="contained"
                value={role}
                onValueChange={(value) => setRole(value as LangRole)}
                items={[
                  { value: "primary", label: t("appearance:text.primary") },
                  { value: "secondary", label: t("appearance:text.secondary") },
                ]}
              />
            }
          >
            <SettingsRow label={t("appearance:text.font")}>
              <FontPicker
                value={text.fontFamily}
                lang={roleLang}
                recommended={RECOMMENDED_FONTS[roleLang]}
                sample={SAMPLE_TEXT[roleLang]}
                autoLabel={t("appearance:font.auto", { lang: nameOf(roleLang) })}
                onChange={(fontFamily) => updateStyle({ [role]: { fontFamily } })}
              />
            </SettingsRow>
            <SettingsRow label={t("appearance:text.size")}>
              <ValueSlider
                value={text.fontSize}
                min={16}
                max={80}
                onChange={(fontSize) => updateStyle({ [role]: { fontSize } })}
                format={(v) => `${v}px`}
              />
            </SettingsRow>
            <SettingsRow label={t("appearance:text.weight")} stacked>
              <SegmentedControl
                aria-label={t("appearance:text.weight")}
                size="sm"
                variant="contained"
                fullWidth
                value={String(text.fontWeight)}
                onValueChange={(value) => updateStyle({ [role]: { fontWeight: Number(value) } })}
                items={WEIGHTS.map((weight) => ({
                  value: String(weight),
                  label: t(`appearance:text.weights.${weight}`),
                }))}
              />
            </SettingsRow>
            <SettingsRow label={t("appearance:text.color")}>
              <ColorPicker
                value={text.color}
                onChange={(color) => updateStyle({ [role]: { color } })}
                triggerSize="sm"
                triggerClassName="border-foreground/20"
              />
            </SettingsRow>
          </SettingsGroup>

          <SettingsGroup title={t("appearance:layout.title")}>
            <SettingsRow label={t("appearance:layout.order")}>
              <SegmentedControl
                aria-label={t("appearance:layout.order")}
                size="sm"
                variant="contained"
                value={settings.langOrder}
                onValueChange={(value) => updateSettings({ langOrder: value as LangOrder })}
                items={[
                  { value: "primary-first", label: t("appearance:layout.primary_first") },
                  { value: "secondary-first", label: t("appearance:layout.secondary_first") },
                ]}
              />
            </SettingsRow>
            <SettingsRow label={t("appearance:layout.block_gap")}>
              <ValueSlider
                value={style.blockGap}
                min={0}
                max={32}
                onChange={(blockGap) => updateStyle({ blockGap })}
                format={(v) => `${v}px`}
              />
            </SettingsRow>
            <SettingsRow label={t("appearance:layout.line_gap")}>
              <ValueSlider
                value={style.lineGap}
                min={0}
                max={20}
                onChange={(lineGap) => updateStyle({ lineGap })}
                format={(v) => `${v}px`}
              />
            </SettingsRow>
            <SettingsRow label={t("appearance:layout.letter_spacing")}>
              <ValueSlider
                value={style.letterSpacing}
                min={-1}
                max={6}
                step={0.5}
                onChange={(letterSpacing) => updateStyle({ letterSpacing })}
                format={(v) => `${v}px`}
              />
            </SettingsRow>
          </SettingsGroup>
        </div>

        <div className="flex flex-col gap-5">
          <SettingsGroup
            title={t("appearance:effects.title")}
            description={t("appearance:effects.description")}
          >
            <SettingsRow label={t("appearance:effects.outline_width")}>
              <ValueSlider
                value={style.outlineWidth}
                min={0}
                max={8}
                step={0.5}
                onChange={(outlineWidth) => updateStyle({ outlineWidth })}
                format={(v) => `${v}px`}
              />
            </SettingsRow>
            <SettingsRow label={t("appearance:effects.outline_color")}>
              <ColorPicker
                value={style.outlineColor}
                onChange={(outlineColor) => updateStyle({ outlineColor })}
                triggerSize="sm"
                triggerClassName="border-foreground/20"
              />
            </SettingsRow>
            <SettingsRow label={t("appearance:effects.shadow_blur")}>
              <ValueSlider
                value={style.shadowBlur}
                min={0}
                max={30}
                onChange={(shadowBlur) => updateStyle({ shadowBlur })}
                format={(v) => `${v}px`}
              />
            </SettingsRow>
            <SettingsRow label={t("appearance:effects.shadow_opacity")}>
              <ValueSlider
                value={Math.round(style.shadowOpacity * 100)}
                min={0}
                max={100}
                onChange={(v) => updateStyle({ shadowOpacity: v / 100 })}
                format={(v) => `${v}%`}
              />
            </SettingsRow>
          </SettingsGroup>

          <SettingsGroup title={t("appearance:background.title")}>
            <SettingsRow
              label={t("appearance:background.style")}
              description={t("appearance:background.style_hint")}
            >
              <SegmentedControl
                aria-label={t("appearance:background.style")}
                size="sm"
                variant="contained"
                value={style.background}
                onValueChange={(value) => updateStyle({ background: value as "none" | "box" })}
                items={[
                  { value: "none", label: t("appearance:background.none") },
                  { value: "box", label: t("appearance:background.box") },
                ]}
              />
            </SettingsRow>
            {style.background === "box" ? (
              <>
                <SettingsRow label={t("appearance:background.color")}>
                  <ColorPicker
                    value={style.backgroundColor}
                    onChange={(backgroundColor) => updateStyle({ backgroundColor })}
                    triggerSize="sm"
                triggerClassName="border-foreground/20"
                  />
                </SettingsRow>
                <SettingsRow label={t("appearance:background.opacity")}>
                  <ValueSlider
                    value={Math.round(style.backgroundOpacity * 100)}
                    min={0}
                    max={100}
                    onChange={(v) => updateStyle({ backgroundOpacity: v / 100 })}
                    format={(v) => `${v}%`}
                  />
                </SettingsRow>
              </>
            ) : null}
          </SettingsGroup>

          <SettingsGroup title={t("appearance:motion.title")}>
            <SettingsRow
              label={t("appearance:motion.animation")}
              description={t("appearance:motion.animation_hint")}
            >
              <Switch
                checked={style.animation}
                onCheckedChange={(animation) => updateStyle({ animation })}
              />
            </SettingsRow>
          </SettingsGroup>

          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => resetSettings(["style", "langOrder"])}
            >
              <RotateCcw className="size-3.5" />
              {t("appearance:reset")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Appearance;
