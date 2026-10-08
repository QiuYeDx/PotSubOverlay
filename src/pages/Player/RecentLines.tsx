import { AnimatePresence, motion } from "motion/react";
import { MessageSquareText, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SettingsGroup } from "@/components/app/SettingsGroup";
import { HTML_LANG } from "@/shared/languages";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import useAppStore from "@/store/useAppStore";

/**
 * The last few lines, oldest first, ending with the one on screen. Clicking a
 * line plays from it, which is the quickest way back to something missed.
 */
function RecentLines() {
  const { t } = useTranslation();
  const history = useAppStore((s) => s.snapshot.history);
  const offsetMs = useAppStore((s) => s.snapshot.offsetMs);
  const playLine = useAppStore((s) => s.playLine);

  return (
    <SettingsGroup title={t("player:recent.title")} description={t("player:recent.description")}>
      {history.length === 0 ? (
        <div className="flex items-center gap-2.5 px-4 py-4 text-xs text-muted-foreground">
          <MessageSquareText className="size-4 shrink-0 text-muted-foreground/60" strokeWidth={1.5} />
          {t("player:recent.empty")}
        </div>
      ) : (
        <ul className="flex flex-col py-1">
          <AnimatePresence initial={false} mode="popLayout">
            {history.map((line) => {
              const [first, ...rest] = line.blocks;
              return (
                <motion.li
                  key={`${line.startMs}:${line.key}`}
                  layout="position"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, transition: { duration: 0.12 } }}
                  transition={{ type: "spring", duration: 0.35, bounce: 0 }}
                  className="px-1"
                >
                  <button
                    type="button"
                    title={t("player:recent.play_from")}
                    onClick={() => playLine(line.startMs)}
                    className={cn(
                      "group flex w-full items-start gap-3 rounded-lg px-3 py-1.5 text-left transition-colors",
                      line.current ? "bg-accent" : "hover:bg-accent/60"
                    )}
                  >
                    <span
                      className={cn(
                        "mt-px w-11 shrink-0 font-mono text-[11px] leading-5 tabular-nums",
                        line.current ? "text-foreground/70" : "text-muted-foreground"
                      )}
                    >
                      {formatTime(line.startMs + offsetMs)}
                    </span>
                    <span className="min-w-0 flex-1">
                      {first ? (
                        <span
                          lang={HTML_LANG[first.lang]}
                          className={cn(
                            "block text-[13px] leading-5 break-words",
                            line.current ? "font-medium text-foreground" : "text-foreground/85"
                          )}
                        >
                          {first.lines.join(" ")}
                        </span>
                      ) : null}
                      {rest.map((block, index) => (
                        <span
                          key={`${block.lang}-${index}`}
                          lang={HTML_LANG[block.lang]}
                          className="block text-xs leading-[18px] break-words text-muted-foreground"
                        >
                          {block.lines.join(" ")}
                        </span>
                      ))}
                    </span>
                    {line.current ? (
                      <span className="mt-0.5 shrink-0 rounded-[5px] bg-foreground/[0.07] px-1.5 py-px text-[10px] font-medium text-foreground/70">
                        {t("player:recent.current")}
                      </span>
                    ) : (
                      <RotateCcw className="mt-1 size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
                    )}
                  </button>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </SettingsGroup>
  );
}

export default RecentLines;
