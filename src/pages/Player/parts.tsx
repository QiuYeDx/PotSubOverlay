import { useTranslation } from "react-i18next";
import { Minus, Plus } from "lucide-react";
import { AnimatedNumber } from "@/components/qiuye-ui/animated-number";
import { SegmentedControl } from "@/components/qiuye-ui/segmented-control";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { LangMode } from "@/shared/types";
import useAppStore from "@/store/useAppStore";

export function useActiveInstance() {
  return useAppStore((s) => s.snapshot.instances.find((i) => i.id === s.snapshot.activeId) ?? null);
}

/** Placeholder text for the preview stage and the notice chip. */
export function useStageState(): { placeholder: string | null; notice: string | null } {
  const { t } = useTranslation();
  const snapshot = useAppStore((s) => s.snapshot);
  const settings = useAppStore((s) => s.settings);

  let placeholder: string | null = null;
  switch (snapshot.status) {
    case "no-player":
      placeholder = t("player:stage.no_player");
      break;
    case "waiting-path":
      placeholder = t("player:stage.waiting_path");
      break;
    case "scanning":
      placeholder = t("player:stage.scanning");
      break;
    case "none-found":
      placeholder = t("player:stage.none_found");
      break;
    case "error":
      placeholder = t("player:stage.error");
      break;
    case "ready":
      placeholder = snapshot.tracks.some((track) => track.enabled)
        ? t("player:stage.silent")
        : t("player:stage.no_enabled");
      break;
  }

  let notice: string | null = null;
  if (!settings.overlayVisible) notice = t("player:notice.hidden");
  else if (snapshot.overlaySuppressed) notice = t("player:notice.suppressed");

  return { placeholder, notice };
}

export function StatusPill({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  const active = useActiveInstance();
  const state = active?.state ?? null;

  const label = !active
    ? t("player:state.no_player")
    : state === "playing"
      ? t("player:state.playing")
      : state === "paused"
        ? t("player:state.paused")
        : t("player:state.stopped");

  return (
    <div
      className={cn(
        "flex h-7 shrink-0 items-center gap-2 rounded-full bg-white/10 px-3 text-xs font-medium text-white/85 backdrop-blur-md",
        compact && "h-6 px-2.5 text-[11px]"
      )}
    >
      <span className="relative flex size-2">
        {state === "playing" ? (
          <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/60 [animation-duration:1.8s]" />
        ) : null}
        <span
          className={cn(
            "relative size-2 rounded-full",
            state === "playing" ? "bg-emerald-400" : state === "paused" ? "bg-amber-400" : "bg-white/35"
          )}
        />
      </span>
      {label}
    </div>
  );
}

export function LangModeControl({ size = "sm", fullWidth = true }: { size?: "sm" | "md"; fullWidth?: boolean }) {
  const { t } = useTranslation();
  const langMode = useAppStore((s) => s.settings.langMode);
  const available = useAppStore((s) => s.snapshot.availableLangs);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const bilingual = available.includes("zh") && available.includes("ja");

  const control = (
    <SegmentedControl
      aria-label={t("player:controls.language")}
      size={size}
      variant="contained"
      fullWidth={fullWidth}
      value={langMode}
      disabled={!bilingual}
      onValueChange={(value) => updateSettings({ langMode: value as LangMode })}
      items={[
        { value: "both", label: t("player:lang.both") },
        { value: "zh", label: t("player:lang.zh") },
        { value: "ja", label: t("player:lang.ja") },
      ]}
    />
  );

  if (bilingual) return control;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div>{control}</div>
      </TooltipTrigger>
      <TooltipContent>{t("player:lang.single_hint")}</TooltipContent>
    </Tooltip>
  );
}

export function OffsetControl({ dense = false }: { dense?: boolean }) {
  const { t } = useTranslation();
  const offsetMs = useAppStore((s) => s.snapshot.offsetMs);
  const step = useAppStore((s) => s.settings.offsetStepMs);
  const hasMedia = useAppStore((s) => s.snapshot.status === "ready");
  const nudge = useAppStore((s) => s.nudgeOffset);
  const setOffset = useAppStore((s) => s.setOffset);
  const seconds = offsetMs / 1000;
  const stepLabel = `${(step / 1000).toFixed(1)}s`;

  return (
    <div className={cn("flex items-center gap-1", dense ? "h-7" : "h-8")}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon-sm"
            className={cn(dense ? "size-7" : "size-8")}
            disabled={!hasMedia}
            aria-label={t("player:offset.earlier", { step: stepLabel })}
            onClick={() => nudge(-1)}
          >
            <Minus className="size-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t("player:offset.earlier", { step: stepLabel })}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            disabled={!hasMedia || offsetMs === 0}
            onClick={() => setOffset(0)}
            className={cn(
              "flex h-full min-w-16 flex-1 items-center justify-center rounded-md font-mono text-[13px] tabular-nums transition-colors",
              offsetMs === 0 ? "text-muted-foreground" : "text-foreground hover:bg-accent"
            )}
          >
            {offsetMs > 0 ? "+" : offsetMs < 0 ? "−" : ""}
            <AnimatedNumber
              value={Math.abs(seconds)}
              format={{ minimumFractionDigits: 1, maximumFractionDigits: 1 }}
            />
            s
          </button>
        </TooltipTrigger>
        <TooltipContent>
          {offsetMs === 0 ? t("player:offset.explain") : t("player:offset.reset")}
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon-sm"
            className={cn(dense ? "size-7" : "size-8")}
            disabled={!hasMedia}
            aria-label={t("player:offset.later", { step: stepLabel })}
            onClick={() => nudge(1)}
          >
            <Plus className="size-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t("player:offset.later", { step: stepLabel })}</TooltipContent>
      </Tooltip>
    </div>
  );
}
