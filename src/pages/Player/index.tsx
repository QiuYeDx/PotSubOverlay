import { useState, type DragEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslation } from "react-i18next";
import { Eye, EyeOff, FilePlus2, FolderOpen, Move, RefreshCw, Upload } from "lucide-react";
import { MiddleTruncate } from "@/components/app/MiddleTruncate";
import { SubtitleStage } from "@/components/app/SubtitleStage";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { baseName, dirName, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import useAppStore from "@/store/useAppStore";
import { LangModeControl, OffsetControl, StatusPill, TransportControls, useStageState } from "./parts";
import PlayersGroup from "./PlayersGroup";
import RecentLines from "./RecentLines";
import TracksGroup from "./TracksGroup";

function Player() {
  const { t } = useTranslation();
  const snapshot = useAppStore((s) => s.snapshot);
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const setEditing = useAppStore((s) => s.setEditing);
  const addFile = useAppStore((s) => s.addFile);
  const [dragging, setDragging] = useState(false);
  const stage = useStageState();

  const active = snapshot.instances.find((instance) => instance.id === snapshot.activeId) ?? null;
  const mediaName = active?.mediaPath ? baseName(active.mediaPath) : null;
  const folder = active?.mediaPath ? baseName(dirName(active.mediaPath)) : null;
  const progress = active && active.durationMs > 0 ? active.positionMs / active.durationMs : 0;
  const canDrop = Boolean(active?.mediaPath);

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    if (!canDrop) return;
    for (const file of Array.from(event.dataTransfer.files)) {
      if (/\.(srt|ass|ssa|vtt|lrc)$/i.test(file.name)) {
        void addFile(window.electronUtils.getPathForFile(file));
        break;
      }
    }
  };

  return (
    <div
      className="mx-auto flex max-w-[940px] flex-col gap-5 px-6 pb-[92px] pt-1"
      onDragOver={(event) => {
        if (!canDrop) return;
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(event) => {
        if (event.currentTarget === event.target) setDragging(false);
      }}
      onDrop={onDrop}
    >
      {/* Now playing: live preview + what is playing. */}
      <section className="overflow-hidden rounded-[20px] border bg-card shadow-xs">
        <SubtitleStage
          display={snapshot.display}
          style={settings.style}
          placement={settings.placement}
          minScale={0.5}
          maxScale={0.72}
          className="h-[214px] rounded-none"
          placeholder={stage.placeholder}
        >
          <div className="absolute inset-x-4 top-4 flex items-start justify-between gap-3">
            <StatusPill />
            <AnimatePresence>
              {stage.notice ? (
                <motion.div
                  key={stage.notice}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ type: "spring", duration: 0.35, bounce: 0 }}
                  className="flex h-7 items-center gap-1.5 rounded-full bg-white/10 px-3 text-xs text-white/75 backdrop-blur-md"
                >
                  <EyeOff className="size-3.5" />
                  {stage.notice}
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
          <AnimatePresence>
            {dragging ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-3 z-10 flex items-center justify-center gap-2 rounded-xl border border-dashed border-white/40 bg-black/50 text-sm text-white/85 backdrop-blur-sm"
              >
                <Upload className="size-4" />
                {t("player:drop_hint")}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </SubtitleStage>

        <div className="flex items-center gap-4 px-5 py-3.5">
          <div className="min-w-0 flex-1">
            {mediaName ? (
              <MiddleTruncate text={mediaName} tail={22} className="text-[15px] font-semibold tracking-tight" />
            ) : (
              <span className="block text-[15px] font-semibold tracking-tight text-muted-foreground">
                {t("player:nothing_playing")}
              </span>
            )}
            <div className="mt-0.5 truncate text-xs text-muted-foreground" title={active?.mediaPath ?? undefined}>
              {folder ?? t("player:open_potplayer_hint")}
            </div>
          </div>
          <TransportControls />
          {active && active.durationMs > 0 ? (
            <div className="min-w-[96px] shrink-0 text-right font-mono text-xs tabular-nums text-muted-foreground">
              {formatTime(active.positionMs)}
              <span className="mx-1 opacity-50">/</span>
              {formatTime(active.durationMs)}
            </div>
          ) : null}
        </div>
        <div className="h-[3px] bg-muted">
          <div
            className="h-full bg-foreground/70 transition-[width] duration-200 ease-linear"
            style={{ width: `${Math.min(100, progress * 100)}%` }}
          />
        </div>
      </section>

      {/* Quick controls used while playing. */}
      <section className="grid grid-cols-[1fr_1.35fr_1.2fr_1fr] gap-3 max-[880px]:grid-cols-2">
        <ControlTile label={t("player:controls.visibility")}>
          <div className="flex items-center gap-2.5">
            <Switch
              checked={settings.overlayVisible}
              onCheckedChange={(overlayVisible) => updateSettings({ overlayVisible })}
            />
            <span className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
              {settings.overlayVisible ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
              {settings.overlayVisible
                ? snapshot.overlaySuppressed
                  ? t("player:controls.suppressed")
                  : t("player:controls.shown")
                : t("player:controls.hidden")}
            </span>
          </div>
        </ControlTile>
        <ControlTile label={t("player:controls.language")}>
          <LangModeControl />
        </ControlTile>
        <ControlTile label={t("player:controls.offset")}>
          <OffsetControl />
        </ControlTile>
        <ControlTile label={t("player:controls.position")}>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-center"
            onClick={() => setEditing(!snapshot.editing)}
          >
            <Move className="size-3.5" />
            {snapshot.editing ? t("player:controls.finish_edit") : t("player:controls.edit_position")}
          </Button>
        </ControlTile>
      </section>

      <RecentLines />

      <div className="grid grid-cols-2 items-start gap-5 max-[880px]:grid-cols-1">
        <PlayersGroup />
        <TracksGroup
          actions={
            <TrackActions disabled={!active?.mediaPath} mediaPath={active?.mediaPath ?? null} />
          }
        />
      </div>
    </div>
  );
}

function ControlTile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col justify-between gap-2.5 rounded-xl border bg-card px-3.5 pt-2.5 pb-3 shadow-xs">
      <div className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </div>
      {children}
    </div>
  );
}

function TrackActions({ disabled, mediaPath }: { disabled: boolean; mediaPath: string | null }) {
  const { t } = useTranslation();
  const rescan = useAppStore((s) => s.rescan);
  const pickFile = useAppStore((s) => s.pickFile);
  const reveal = useAppStore((s) => s.reveal);
  const [spinning, setSpinning] = useState(false);

  const actions = [
    {
      key: "rescan",
      label: t("player:tracks.rescan"),
      icon: <RefreshCw className={cn("size-3.5", spinning && "animate-spin")} />,
      onClick: async () => {
        setSpinning(true);
        await Promise.all([rescan(), new Promise((resolve) => setTimeout(resolve, 500))]);
        setSpinning(false);
      },
    },
    {
      key: "pick",
      label: t("player:tracks.pick"),
      icon: <FilePlus2 className="size-3.5" />,
      onClick: () => void pickFile(),
    },
    {
      key: "reveal",
      label: t("player:tracks.reveal"),
      icon: <FolderOpen className="size-3.5" />,
      onClick: () => mediaPath && reveal(mediaPath),
    },
  ];

  return (
    <div className="flex items-center gap-0.5">
      {actions.map((action) => (
        <Tooltip key={action.key}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="size-7 text-muted-foreground"
              disabled={disabled}
              aria-label={action.label}
              onClick={action.onClick}
            >
              {action.icon}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{action.label}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}

export default Player;
