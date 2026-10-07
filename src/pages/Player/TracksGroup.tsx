import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { AlertCircle, FileSearch, FileText, Loader2 } from "lucide-react";
import { MiddleTruncate } from "@/components/app/MiddleTruncate";
import { SettingsGroup } from "@/components/app/SettingsGroup";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { SubtitleTrackInfo } from "@/shared/types";
import useAppStore from "@/store/useAppStore";

function LangBadges({ track }: { track: SubtitleTrackInfo }) {
  const { t } = useTranslation();
  const labels = track.bilingual
    ? [t("player:tracks.bilingual")]
    : track.langs.map((lang) => t(`player:tracks.lang_${lang}`));
  return (
    <>
      {labels.map((label) => (
        <span
          key={label}
          className="rounded-[5px] bg-foreground/[0.07] px-1.5 py-px text-[10px] font-medium text-foreground/75"
        >
          {label}
        </span>
      ))}
    </>
  );
}

function EmptyState({ icon, title, hint }: { icon: ReactNode; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-8 text-center">
      {icon}
      <div className="text-[13px] font-medium">{title}</div>
      {hint ? <div className="max-w-[300px] text-xs leading-5 text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

function TracksGroup({ actions }: { actions: ReactNode }) {
  const { t } = useTranslation();
  const snapshot = useAppStore((s) => s.snapshot);
  const toggleTrack = useAppStore((s) => s.toggleTrack);
  const iconClass = "size-6 text-muted-foreground/60";

  let body: ReactNode;
  if (snapshot.status === "no-player" || snapshot.status === "waiting-path") {
    body = (
      <EmptyState
        icon={<FileText className={iconClass} strokeWidth={1.5} />}
        title={t("player:tracks.idle_title")}
        hint={t("player:tracks.idle_hint")}
      />
    );
  } else if (snapshot.status === "scanning" && snapshot.tracks.length === 0) {
    body = (
      <EmptyState
        icon={<Loader2 className={cn(iconClass, "animate-spin")} strokeWidth={1.5} />}
        title={t("player:tracks.scanning")}
      />
    );
  } else if (snapshot.status === "error") {
    body = (
      <EmptyState
        icon={<AlertCircle className="size-6 text-destructive/80" strokeWidth={1.5} />}
        title={t("player:tracks.error_title")}
        hint={t("player:tracks.error_hint")}
      />
    );
  } else if (snapshot.tracks.length === 0) {
    body = (
      <EmptyState
        icon={<FileSearch className={iconClass} strokeWidth={1.5} />}
        title={t("player:tracks.none_title")}
        hint={t("player:tracks.none_hint")}
      />
    );
  } else {
    body = snapshot.tracks.map((track) => (
      <label
        key={track.id}
        className="flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/50"
      >
        <span className="min-w-0 flex-1">
          <MiddleTruncate text={track.fileName} tail={24} className="text-[13px] font-medium" />
          <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span className="rounded-[5px] border px-1.5 py-px font-mono text-[10px] uppercase text-foreground/70">
              {track.format}
            </span>
            {track.error ? (
              <span className="text-destructive">{t("player:tracks.read_failed")}</span>
            ) : (
              <>
                <LangBadges track={track} />
                <span className="tabular-nums">{t("player:tracks.cues", { count: track.cueCount })}</span>
                <span className="text-muted-foreground/60">·</span>
                <span>{track.encoding}</span>
              </>
            )}
          </span>
        </span>
        <Switch
          checked={track.enabled}
          disabled={Boolean(track.error)}
          onCheckedChange={(enabled) => toggleTrack(track.path, enabled)}
        />
      </label>
    ));
  }

  return (
    <SettingsGroup
      title={t("player:tracks.title")}
      description={snapshot.tracks.length > 1 ? t("player:tracks.multi_hint") : undefined}
      action={actions}
    >
      {body}
    </SettingsGroup>
  );
}

export default TracksGroup;
