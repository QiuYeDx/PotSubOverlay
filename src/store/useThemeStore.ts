import { applyTheme, getIsDark, type ThemeValue } from "@/utils/common";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface ThemeStore {
  theme: ThemeValue;
  isDark: boolean;
  setTheme: (newTheme: ThemeValue) => void;
}

const LEGACY_KEY = "theme";
const STORAGE_KEY = "potsuboverlay-theme";

const isThemeValue = (theme: unknown): theme is ThemeValue =>
  theme === "light" || theme === "dark" || theme === "system";

const canUseLocalStorage = () => typeof localStorage !== "undefined";

const migrateLegacyTheme = () => {
  if (!canUseLocalStorage()) return;

  if (
    localStorage.getItem(LEGACY_KEY) !== null &&
    localStorage.getItem(STORAGE_KEY) === null
  ) {
    const savedTheme = localStorage.getItem(LEGACY_KEY);
    const theme = isThemeValue(savedTheme) ? savedTheme : "system";
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ state: { theme }, version: 0 })
    );
    localStorage.removeItem(LEGACY_KEY);
  }
};

const getStoredTheme = (): ThemeValue => {
  if (!canUseLocalStorage()) return "system";

  migrateLegacyTheme();

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return "system";

    const parsed = JSON.parse(raw) as { state?: { theme?: unknown } };
    return isThemeValue(parsed.state?.theme) ? parsed.state.theme : "system";
  } catch {
    return "system";
  }
};

const initialTheme = getStoredTheme();
applyTheme(initialTheme);

const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      theme: initialTheme,
      isDark: getIsDark(initialTheme),
      setTheme: (newTheme) => {
        applyTheme(newTheme);
        set({ theme: newTheme, isDark: getIsDark(newTheme) });
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ theme: state.theme }),
      merge: (persistedState, currentState) => {
        const persistedTheme = (persistedState as Partial<ThemeStore> | undefined)
          ?.theme;
        const theme = isThemeValue(persistedTheme)
          ? persistedTheme
          : currentState.theme;

        return {
          ...currentState,
          theme,
          isDark: getIsDark(theme),
        };
      },
      onRehydrateStorage: () => {
        migrateLegacyTheme();

        return (state) => {
          if (state) {
            applyTheme(state.theme);
            useThemeStore.setState({ isDark: getIsDark(state.theme) });
          }
        };
      },
    }
  )
);

if (typeof window !== "undefined") {
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  mediaQuery.addEventListener("change", (event: MediaQueryListEvent) => {
    const { theme } = useThemeStore.getState();
    if (theme === "system") {
      applyTheme(event.matches ? "dark" : "light");
      useThemeStore.setState({ isDark: event.matches });
    }
  });
}

export default useThemeStore;

