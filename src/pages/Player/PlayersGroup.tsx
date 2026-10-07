import { motion } from "motion/react";
import { useTranslation } from "react-i18next";
import { MonitorPlay, Pause, Play, Sparkles, Square } from "lucide-react";
import { MiddleTruncate } from "@/components/app/MiddleTruncate";
import { SettingsGroup } from "@/components/app/SettingsGroup";
import { baseName, cleanPlayerTitle, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PlayerInstance } from "@/shared/types";
import useAppStore from "@/store/useAppStore";

function StateIcon({ state }: { state: PlayerInstance["state"] }) {
  const Icon = state === "playing" ? Play : state === "paused" ? Pause : Square;
  return (
    <span
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-lg",
        state === "playing"
          ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400"
          : "bg-muted text-muted-foreground"
      )}
    >
      <Icon className="size-3.5" fill="currentColor" strokeWidth={0} />
    </span>
  );
}

function Radio({ checked }: { checked: boolean }) {
  return (
    <span
      className={cn(
        "relative flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors",
        checked ? "border-foreground bg-foreground" : "border-muted-foreground/40"
      )}
    >
      {checked ? (
        <motion.span
          layoutId="player-radio"
          className="size-1.5 rounded-full bg-background"
          transition={{ type: "spring", duration: 0.3, bounce: 0 }}
        />
      ) : null}
    </span>
  );
}

function PlayersGroup() {
  const { t } = useTranslation();
  const snapshot = useAppStore((s) => s.snapshot);
  const selectInstance = useAppStore((s) => s.selectInstance);
  const auto = snapshot.selection === "auto";

  return (
    <SettingsGroup
      title={t("player:players.title")}
      description={
        snapshot.instances.length > 1
          ? t("player:players.count", { count: snapshot.instances.length })
          : undefined
      }
    >
      {snapshot.instances.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-6 py-8 text-center">
          <MonitorPlay className="size-6 text-muted-foreground/60" strokeWidth={1.5} />
          <div className="text-[13px] font-medium">{t("player:players.empty_title")}</div>
          <div className="max-w-[280px] text-xs leading-5 text-muted-foreground">
            {t("player:players.empty_hint")}
          </div>
        </div>
      ) : (
        <>
          <button
            type="button"
            className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/50"
            onClick={() => selectInstance(null)}
          >
            <Radio checked={auto} />
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Sparkles className="size-3.5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-medium">{t("player:players.auto")}</span>
              <span className="block text-xs text-muted-foreground">{t("player:players.auto_hint")}</span>
            </span>
          </button>
          {snapshot.instances.map((instance) => {
            const name = instance.mediaPath
              ? baseName(instance.mediaPath)
              : cleanPlayerTitle(instance.title) || t("player:players.untitled");
            const isActive = instance.id === snapshot.activeId;
            return (
              <button
                key={instance.id}
                type="button"
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/50"
                onClick={() => selectInstance(instance.id)}
              >
                <Radio checked={!auto && isActive} />
                <StateIcon state={instance.state} />
                <span className="min-w-0 flex-1">
                  <MiddleTruncate text={name} tail={18} className="text-[13px] font-medium" />
                  <span className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-mono tabular-nums">
                      {formatTime(instance.positionMs)} / {formatTime(instance.durationMs)}
                    </span>
                    {auto && isActive ? (
                      <span className="rounded-full bg-foreground/8 px-1.5 py-px text-[10px] font-medium text-foreground/70">
                        {t("player:players.following")}
                      </span>
                    ) : null}
                  </span>
                </span>
              </button>
            );
          })}
        </>
      )}
    </SettingsGroup>
  );
}

export default PlayersGroup;
