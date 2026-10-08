import { useTranslation } from "react-i18next";
import { Eye, EyeOff, Maximize2, Move, Pause, Play, X } from "lucide-react";
import { MiddleTruncate } from "@/components/app/MiddleTruncate";
import { SubtitleStage } from "@/components/app/SubtitleStage";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { baseName } from "@/lib/format";
import { cn } from "@/lib/utils";
import useAppStore from "@/store/useAppStore";
import {
  LangModeControl,
  OffsetControl,
  StatusPill,
  useActiveInstance,
  useStageState,
} from "@/pages/Player/parts";

function IconButton({
  label,
  onClick,
  children,
  active,
  disabled,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          className={cn("size-7 text-muted-foreground", active && "bg-accent text-foreground")}
          disabled={disabled}
          onClick={onClick}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/** Mini player layout: everything needed while a game is running. */
function Compact() {
  const { t } = useTranslation();
  const snapshot = useAppStore((s) => s.snapshot);
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const setEditing = useAppStore((s) => s.setEditing);
  const setCompact = useAppStore((s) => s.setCompact);
  const playback = useAppStore((s) => s.playback);
  const active = useActiveInstance();
  const stage = useStageState();
  const progress = active && active.durationMs > 0 ? active.positionMs / active.durationMs : 0;

  return (
    <div className="app-region-drag flex h-screen flex-col gap-2 bg-background p-2 select-none">
      <SubtitleStage
        display={snapshot.display}
        style={settings.style}
        placement={settings.placement}
        minScale={0.34}
        maxScale={0.42}
        className="min-h-0 flex-1 rounded-xl [--stage-pad:12px]"
        placeholder={stage.placeholder}
      >
        <div className="absolute inset-x-2 top-2 flex items-center gap-2">
          <StatusPill compact />
          <div className="min-w-0 flex-1 text-[11px] font-medium text-white/75">
            {active?.mediaPath ? <MiddleTruncate text={baseName(active.mediaPath)} tail={14} /> : null}
          </div>
          <div className="app-region-no-drag flex items-center gap-0.5">
            <button
              type="button"
              aria-label={t("player:compact.expand")}
              title={t("player:compact.expand")}
              className="flex size-6 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/15 hover:text-white"
              onClick={() => setCompact(false)}
            >
              <Maximize2 className="size-3.5" />
            </button>
            <button
              type="button"
              aria-label={t("common:window.close")}
              title={t("common:window.close")}
              className="flex size-6 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/15 hover:text-white"
              onClick={() => void window.ipcRenderer.invoke("window-control", "close")}
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-[2px] bg-white/10">
          <div
            className="h-full bg-white/60 transition-[width] duration-200 ease-linear"
            style={{ width: `${Math.min(100, progress * 100)}%` }}
          />
        </div>
      </SubtitleStage>

      <div className="app-region-no-drag flex h-8 shrink-0 items-center gap-1.5">
        <IconButton
          label={settings.overlayVisible ? t("player:compact.hide") : t("player:compact.show")}
          onClick={() => updateSettings({ overlayVisible: !settings.overlayVisible })}
        >
          {settings.overlayVisible ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
        </IconButton>
        <IconButton
          label={active?.state === "playing" ? t("player:transport.pause") : t("player:transport.play")}
          disabled={!active}
          onClick={() => playback("playPause")}
        >
          {active?.state === "playing" ? (
            <Pause className="size-3.5 fill-current" />
          ) : (
            <Play className="size-3.5 fill-current" />
          )}
        </IconButton>
        <div className="min-w-0 flex-1">
          <LangModeControl />
        </div>
        <div className="w-[136px] shrink-0">
          <OffsetControl dense />
        </div>
        <IconButton
          label={snapshot.editing ? t("player:controls.finish_edit") : t("player:controls.edit_position")}
          active={snapshot.editing}
          onClick={() => setEditing(!snapshot.editing)}
        >
          <Move className="size-3.5" />
        </IconButton>
      </div>
    </div>
  );
}

export default Compact;
