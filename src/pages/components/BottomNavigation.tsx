import { MouseEvent, useMemo } from "react";
import { AnimatePresence, motion } from "motion/react";
import * as htmlToImage from "html-to-image";
import { Captions, Info, Moon, Palette, Settings, Sun } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useWindowSize } from "@reactuses/core";
import { Button } from "@/components/ui/button";
import useThemeStore from "@/store/useThemeStore";
import useFadeMaskLayerStore from "@/store/useFadeMaskLayer";
import { cn } from "@/lib/utils";

const springTransition = {
  type: "spring" as const,
  duration: 0.5,
  bounce: 0,
};

function BottomNavigation() {
  const { width, height } = useWindowSize();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { isDark, setTheme } = useThemeStore();
  const {
    showMaskLayer,
    setVisible,
    setShowInner,
    setCenterXY,
    setRectSize,
    setShowMaskLayer,
    setBackgroundImage,
  } = useFadeMaskLayerStore();

  const mainNavItems = useMemo(
    () => [
      { path: "/", icon: Captions, label: "common:menu.player" },
      { path: "/appearance", icon: Palette, label: "common:menu.appearance" },
      { path: "/setting", icon: Settings, label: "common:menu.setting" },
      { path: "/about", icon: Info, label: "common:menu.about" },
    ],
    []
  );

  const handleToggleDarkMode = (event: MouseEvent<HTMLButtonElement>) => {
    const node = document.getElementById("root");
    if (!node) {
      setTheme(isDark ? "light" : "dark");
      return;
    }

    htmlToImage
      .toPng(node, {
        filter: (el) => {
          if (!el) return false;
          if (
            el instanceof HTMLElement &&
            el.classList.contains("fade-mask-layer")
          ) {
            return false;
          }
          return true;
        },
      })
      .then((dataUrl) => {
        setBackgroundImage(dataUrl);
        setShowInner(isDark);
        setVisible(true);
        setRectSize(width, height);
        setCenterXY(event.clientX, event.clientY);
        setShowMaskLayer(!showMaskLayer);
        setTheme(isDark ? "light" : "dark");
      })
      .catch(() => {
        setTheme(isDark ? "light" : "dark");
      });
  };

  return (
    <div className="pointer-events-none fixed bottom-0 left-1/2 z-40 flex w-full -translate-x-1/2 items-center justify-center">
      <AnimatePresence mode="popLayout">
        <motion.div
          key="main-menu"
          initial={{ opacity: 0, y: 68 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 68 }}
          transition={springTransition}
          className="pointer-events-auto mx-2 my-2 flex flex-nowrap justify-center gap-1 rounded-full border border-border bg-card/80 p-1 shadow-lg backdrop-blur-md"
        >
          {mainNavItems.map(({ path, icon: Icon, label }) => (
            <Button
              key={path}
              variant="ghost"
              size="sm"
              onClick={() => navigate(path)}
              className={cn(
                "relative gap-2 rounded-full text-muted-foreground/70 transition-colors hover:bg-transparent hover:text-foreground dark:hover:bg-transparent",
                location.pathname === path && "text-foreground"
              )}
            >
              {location.pathname === path ? (
                <motion.div
                  layoutId="nav-highlight"
                  className="absolute inset-0 rounded-full bg-secondary"
                  transition={springTransition}
                />
              ) : null}
              <Icon className="relative z-1 size-5" />
              <span className="relative z-1">{t(label)}</span>
            </Button>
          ))}
        </motion.div>
      </AnimatePresence>

      <div className="pointer-events-auto absolute right-6">
        <Button
          variant="outline"
          size="icon"
          onClick={handleToggleDarkMode}
          className="h-9 w-9 rounded-full dark:bg-background dark:hover:bg-accent"
        >
          {isDark ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
          <span className="sr-only">{t("common:action.toggle_theme")}</span>
        </Button>
      </div>
    </div>
  );
}

export default BottomNavigation;

