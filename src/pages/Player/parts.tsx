import { useTranslation } from "react-i18next";
import { ChevronsLeft, ChevronsRight, Minus, Pause, Play, Plus, RotateCcw } from "lucide-react";
import { AnimatedNumber } from "@/components/qiuye-ui/animated-number";
import { SegmentedControl } from "@/components/qiuye-ui/segmented-control";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { LangMode, PlaybackAction } from "@/shared/types";
import useLanguageName from "@/hooks/useLanguageName";
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

/** @param dense For narrow rows (compact mode): items may shrink below their usual minimum. */
export function LangModeControl({
  size = "sm",
  fullWidth = true,
  dense = false,
}: {
  size?: "sm" | "md";
  fullWidth?: boolean;
  dense?: boolean;
}) {
  const { t } = useTranslation();
  const langMode = useAppStore((s) => s.settings.langMode);
  const roles = useAppStore((s) => s.snapshot.roles);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const nameOf = useLanguageName();
  const bilingual = roles.primary !== null && roles.secondary !== null;

  const control = (
    <SegmentedControl
      aria-label={t("player:controls.language")}
      size={size}
      variant="contained"
      fullWidth={fullWidth}
      itemClassName={dense ? "min-w-0 px-1.5" : undefined}
      value={langMode}
      disabled={!bilingual}
      onValueChange={(value) => updateSettings({ langMode: value as LangMode })}
      items={[
        { value: "both", label: t("player:lang.both") },
        ...(["primary", "secondary"] as const).map((role) => {
          const lang = roles[role];
          const name = lang ? nameOf(lang) : t(`player:lang.${role}`);
          // Long names ("Japanese") do not fit a narrow row; show the code instead.
          const short = dense && lang && lang !== "other" && name.length > 4 ? lang.toUpperCase() : name;
          return { value: role, label: short, ariaLabel: name };
        }),
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

const shortcutText = (accelerator: string) => accelerator.replace(/Control/g, "Ctrl");

/**
 * Play/pause, replay the current line and seek, sent to the followed
 * PotPlayer window. Each tooltip names the hotkey that does the same in game.
 */
export function TransportControls({ dense = false }: { dense?: boolean }) {
  const { t } = useTranslation();
  const active = useActiveInstance();
  const hotkeys = useAppStore((s) => s.settings.hotkeys);
  const seekStep = useAppStore((s) => s.settings.seekStepMs);
  const playback = useAppStore((s) => s.playback);
  const hasLines = useAppStore((s) => s.snapshot.status === "ready");
  const playing = active?.state === "playing";
  const step = `${seekStep / 1000}s`;
  const size = dense ? "size-7" : "size-8";

  const items: {
    action: PlaybackAction;
    label: string;
    icon: React.ReactNode;
    disabled?: boolean;
    primary?: boolean;
  }[] = [
    {
      action: "replayLine",
      label: t("player:transport.replay"),
      icon: <RotateCcw className="size-3.5" />,
      disabled: !hasLines,
    },
    {
      action: "seekBackward",
      label: t("player:transport.back", { step }),
      icon: <ChevronsLeft className="size-4" />,
    },
    {
      action: "playPause",
      label: playing ? t("player:transport.pause") : t("player:transport.play"),
      icon: playing ? <Pause className="size-3.5 fill-current" /> : <Play className="size-3.5 fill-current" />,
      primary: true,
    },
    {
      action: "seekForward",
      label: t("player:transport.forward", { step }),
      icon: <ChevronsRight className="size-4" />,
    },
  ];

  return (
    <div className="flex items-center gap-0.5">
      {items.map((item) => (
        <Tooltip key={item.action}>
          <TooltipTrigger asChild>
            <Button
              variant={item.primary ? "secondary" : "ghost"}
              size="icon-sm"
              className={cn(size, item.primary ? "rounded-full" : "text-muted-foreground")}
              disabled={!active || item.disabled}
              aria-label={item.label}
              onClick={() => playback(item.action)}
            >
              {item.icon}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {item.label}
            {hotkeys[item.action] ? (
              <span className="ml-1.5 opacity-60">{shortcutText(hotkeys[item.action])}</span>
            ) : null}
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
