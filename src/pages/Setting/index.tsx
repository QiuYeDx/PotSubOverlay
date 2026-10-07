import { type ComponentType, useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Keyboard, MonitorUp, Settings as SettingsIcon, SlidersHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import BehaviorConfig from "./components/BehaviorConfig";
import GeneralConfig from "./components/GeneralConfig";
import HotkeyConfig from "./components/HotkeyConfig";
import UpdateConfig from "./components/UpdateConfig";

type TabKey = "general" | "behavior" | "hotkeys" | "update";

const PANELS: Record<TabKey, ComponentType> = {
  general: GeneralConfig,
  behavior: BehaviorConfig,
  hotkeys: HotkeyConfig,
  update: UpdateConfig,
};

const NAV = [
  {
    key: "general" as const,
    labelKey: "setting:nav.general.label",
    hintKey: "setting:nav.general.hint",
    icon: SettingsIcon,
  },
  {
    key: "behavior" as const,
    labelKey: "setting:nav.behavior.label",
    hintKey: "setting:nav.behavior.hint",
    icon: SlidersHorizontal,
  },
  {
    key: "hotkeys" as const,
    labelKey: "setting:nav.hotkeys.label",
    hintKey: "setting:nav.hotkeys.hint",
    icon: Keyboard,
  },
  {
    key: "update" as const,
    labelKey: "setting:nav.update.label",
    hintKey: "setting:nav.update.hint",
    icon: MonitorUp,
  },
];

const EASE_OUT_QUAD = [0.25, 0.46, 0.45, 0.94] as const;

const contentVariants = {
  initial: (dir: number) => ({ opacity: 0, y: dir * 8 }),
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.15, ease: EASE_OUT_QUAD },
  },
  exit: (dir: number) => ({
    opacity: 0,
    y: dir * -4,
    transition: { duration: 0.1, ease: EASE_OUT_QUAD },
  }),
};

function Setting() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<TabKey>("general");
  const [direction, setDirection] = useState(0);
  const scrollRootRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [showTopFade, setShowTopFade] = useState(false);
  const [showBottomFade, setShowBottomFade] = useState(false);

  const handleTabChange = useCallback(
    (newTab: TabKey) => {
      const oldIndex = NAV.findIndex((item) => item.key === tab);
      const newIndex = NAV.findIndex((item) => item.key === newTab);
      setDirection(newIndex > oldIndex ? 1 : -1);
      setTab(newTab);
    },
    [tab]
  );

  const checkScroll = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const maxScroll = scrollHeight - clientHeight;
    setShowTopFade(scrollTop > 1);
    setShowBottomFade(maxScroll > 0 && scrollTop < maxScroll - 1);
  }, []);

  useEffect(() => {
    const root = scrollRootRef.current;
    if (!root) return;
    const viewport = root.querySelector<HTMLDivElement>(
      '[data-slot="scroll-area-viewport"]'
    );
    if (!viewport) return;

    viewportRef.current = viewport;
    viewport.addEventListener("scroll", checkScroll, { passive: true });
    const resizeObserver = new ResizeObserver(checkScroll);
    resizeObserver.observe(viewport);
    checkScroll();

    return () => {
      viewport.removeEventListener("scroll", checkScroll);
      resizeObserver.disconnect();
    };
  }, [checkScroll]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewport.scrollTop = 0;
    checkScroll();
  }, [tab, checkScroll]);

  return (
    <div className="mx-auto flex h-[calc(100dvh-132px)] max-w-5xl flex-col px-4 pb-[40px] sm:px-8">
      <div className="mb-5 shrink-0">
        <div className="text-2xl font-semibold tracking-tight">
          {t("setting:title")}
        </div>
        <div className="mt-1 text-sm text-muted-foreground">
          {t("setting:description")}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[200px_1fr] gap-5 max-md:grid-cols-1 max-md:gap-3">
        <nav className="isolate flex flex-col gap-1 max-md:flex-row max-md:overflow-x-auto max-md:shrink-0">
          {NAV.map((item) => {
            const active = item.key === tab;
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                onClick={() => handleTabChange(item.key)}
                className={cn(
                  "group relative flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left transition-colors",
                  "max-md:min-w-[160px] max-md:shrink-0",
                  active
                    ? "z-0 text-foreground"
                    : "z-[1] text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                )}
              >
                {active ? (
                  <motion.div
                    layoutId="setting-nav-indicator"
                    className="absolute inset-0 rounded-lg border border-foreground/15 bg-accent"
                    transition={{
                      type: "spring",
                      duration: 0.35,
                      bounce: 0.15,
                    }}
                  />
                ) : null}
                <Icon className="relative h-[15px] w-[15px] shrink-0" />
                <div className="relative min-w-0 flex-1">
                  <div className="text-[13px] font-medium leading-tight">
                    {t(item.labelKey)}
                  </div>
                  <div
                    className={cn(
                      "mt-0.5 truncate text-[11px]",
                      active ? "text-foreground/60" : "text-muted-foreground/80"
                    )}
                  >
                    {t(item.hintKey)}
                  </div>
                </div>
              </button>
            );
          })}
        </nav>

        <div ref={scrollRootRef} className="relative min-h-0 min-w-0">
          <ScrollArea className="h-full">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={tab}
                custom={direction}
                variants={contentVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                onAnimationStart={(definition) => {
                  if (definition === "animate") checkScroll();
                }}
                className="flex flex-col gap-6 py-1 pr-3"
              >
                {(() => {
                  const Panel = PANELS[tab];
                  return <Panel />;
                })()}
              </motion.div>
            </AnimatePresence>
          </ScrollArea>

          <AnimatePresence>
            {showTopFade ? (
              <motion.div
                aria-hidden="true"
                className="pointer-events-none absolute left-0 right-0 top-0 z-[5] h-8 bg-gradient-to-b from-background to-transparent"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              />
            ) : null}
          </AnimatePresence>

          <AnimatePresence>
            {showBottomFade ? (
              <motion.div
                aria-hidden="true"
                className="pointer-events-none absolute bottom-0 left-0 right-0 z-[5] h-8 bg-gradient-to-t from-background to-transparent"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              />
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

export default Setting;
