import { useTranslation } from "react-i18next";
import { Minimize2 } from "lucide-react";
import { APP_NAME } from "@/constants/app";
import useAppStore from "@/store/useAppStore";

const isMac = navigator.userAgent.includes("Mac");
const isWindows = navigator.userAgent.includes("Windows");

type WindowControlAction = "close" | "minimize" | "toggle-maximize";

const WINDOWS_TRAFFIC_LIGHTS: ReadonlyArray<{
  action: WindowControlAction;
  ariaLabelKey: string;
  colorClassName: string;
}> = [
  {
    action: "close",
    ariaLabelKey: "common:window.close",
    colorClassName: "bg-[#FF5F57]",
  },
  {
    action: "minimize",
    ariaLabelKey: "common:window.minimize",
    colorClassName: "bg-[#FEBC2E]",
  },
  {
    action: "toggle-maximize",
    ariaLabelKey: "common:window.toggle_maximize",
    colorClassName: "bg-[#28C840]",
  },
];

function AppTitleBar() {
  const { t } = useTranslation();
  const appName = t("common:app_name", { defaultValue: APP_NAME });
  const setCompact = useAppStore((state) => state.setCompact);

  const handleWindowControl = async (action: WindowControlAction) => {
    try {
      await window.ipcRenderer.invoke("window-control", action);
    } catch (error) {
      console.error("[AppTitleBar] window control failed:", error);
    }
  };

  return (
    <div className="app-region-drag fixed top-0 z-50 flex h-10 w-full items-center justify-center">
      {isMac ? (
        <div className="pointer-events-none absolute left-1.5 top-1/2 h-7 w-[72px] -translate-y-1/2 rounded-full border border-border/40 bg-background/60 backdrop-blur-md" />
      ) : null}
      <div
        className={`flex h-7 items-center justify-center rounded-full border border-border/40 bg-background/60 px-4 font-mono text-xs backdrop-blur-md select-none ${
          isWindows ? "app-region-no-drag group relative min-w-[112px]" : ""
        }`}
      >
        {isWindows ? (
          <>
            <span className="transition-opacity duration-150 group-hover:opacity-0">
              {appName}
            </span>
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100">
              {WINDOWS_TRAFFIC_LIGHTS.map((item) => {
                const label = t(item.ariaLabelKey);
                return (
                  <button
                    key={item.action}
                    type="button"
                    aria-label={label}
                    title={label}
                    className={`h-3 w-3 rounded-full border border-black/10 ${item.colorClassName} transition-transform duration-150 hover:scale-110 active:scale-95`}
                    onClick={() => void handleWindowControl(item.action)}
                  />
                );
              })}
            </div>
          </>
        ) : (
          appName
        )}
      </div>
      <button
        type="button"
        aria-label={t("common:window.compact")}
        title={t("common:window.compact")}
        className="app-region-no-drag absolute top-1/2 right-2.5 flex h-7 -translate-y-1/2 items-center gap-1.5 rounded-full border border-border/40 bg-background/60 px-2.5 text-xs text-muted-foreground backdrop-blur-md transition-colors hover:text-foreground"
        onClick={() => setCompact(true)}
      >
        <Minimize2 className="size-3.5" />
        {t("common:window.compact_short")}
      </button>
    </div>
  );
}

export default AppTitleBar;

