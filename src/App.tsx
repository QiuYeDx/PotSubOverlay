import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Route, Routes, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import "@/App.css";
import About from "@/pages/About";
import Appearance from "@/pages/Appearance";
import Compact from "@/pages/Compact";
import Player from "@/pages/Player";
import Setting from "@/pages/Setting";
import BottomNavigation from "@/pages/components/BottomNavigation";
import AppTitleBar from "@/pages/components/AppTitleBar";
import FadeMaskLayer from "@/pages/components/FadeMaskLayer";
import { Toaster } from "@/components/ui/sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TooltipProvider } from "@/components/ui/tooltip";
import Update from "@/components/update";
import useAppStore from "@/store/useAppStore";
import useUpdatePreferencesStore from "@/store/useUpdatePreferencesStore";

const ROUTE_ORDER: Record<string, number> = {
  "/": 0,
  "/appearance": 1,
  "/setting": 2,
  "/about": 3,
};

function getRouteIndex(pathname: string): number {
  return ROUTE_ORDER[pathname] ?? -1;
}

const SLIDE_OFFSET = 48;

const pageVariants = {
  enter: (direction: number) => ({
    left: direction * SLIDE_OFFSET,
    opacity: 0,
  }),
  center: {
    left: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    left: -direction * SLIDE_OFFSET,
    opacity: 0,
  }),
};

const pageTransition = {
  type: "spring" as const,
  duration: 0.3,
  bounce: 0,
};

function FullLayout() {
  const location = useLocation();
  const prevPathRef = useRef(location.pathname);
  const directionRef = useRef(1);
  const { autoCheck } = useUpdatePreferencesStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Each page starts at the top; the scroll container is shared between routes,
  // so reset it once the outgoing page has faded out.
  const resetScroll = () => {
    const viewport = scrollRef.current?.querySelector<HTMLElement>("[data-slot=scroll-area-viewport]");
    if (viewport) viewport.scrollTop = 0;
  };

  if (prevPathRef.current !== location.pathname) {
    const prevIndex = getRouteIndex(prevPathRef.current);
    const nextIndex = getRouteIndex(location.pathname);
    directionRef.current = nextIndex > prevIndex ? 1 : -1;
    prevPathRef.current = location.pathname;
  }

  return (
    <div className="app flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <AppTitleBar />
      <div className="h-10" />

      <ScrollArea ref={scrollRef} className="h-full flex-1">
        <div className="w-screen overflow-x-clip pt-12">
          <AnimatePresence
            mode="wait"
            custom={directionRef.current}
            initial={false}
            onExitComplete={resetScroll}
          >
            <motion.div
              key={location.pathname}
              custom={directionRef.current}
              className="relative"
              variants={pageVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={pageTransition}
            >
              <Routes location={location}>
                <Route path="/" element={<Player />} />
                <Route path="/appearance" element={<Appearance />} />
                <Route path="/setting" element={<Setting />} />
                <Route path="/about" element={<About />} />
              </Routes>
            </motion.div>
          </AnimatePresence>
        </div>
      </ScrollArea>

      <BottomNavigation />
      <Toaster position="top-right" />
      <Update autoCheck={autoCheck} showTrigger={false} />
      <FadeMaskLayer />
    </div>
  );
}

function App() {
  const { i18n } = useTranslation();
  const init = useAppStore((s) => s.init);
  const compact = useAppStore((s) => s.compact);
  const switching = useAppStore((s) => s.switchingLayout);

  useEffect(() => init(), [init]);

  // The tray menu and the overlay follow the UI language.
  useEffect(() => {
    const send = (lng: string) => window.ipcRenderer.send("app:locale", lng);
    send(i18n.resolvedLanguage || i18n.language);
    i18n.on("languageChanged", send);
    return () => i18n.off("languageChanged", send);
  }, [i18n]);

  return (
    <TooltipProvider delayDuration={400}>
      <motion.div
        className="h-screen"
        animate={{ opacity: switching ? 0 : 1, scale: switching ? 0.985 : 1 }}
        transition={{ type: "spring", duration: switching ? 0.14 : 0.32, bounce: 0 }}
      >
        {compact ? <Compact /> : <FullLayout />}
      </motion.div>
    </TooltipProvider>
  );
}

export default App;
