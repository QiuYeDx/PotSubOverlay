import { motion, useReducedMotion } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { AppWindow, Captions, Check, Move, Power } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TrayMenuAction, TrayMenuState } from "@/shared/types";

declare global {
  interface Window {
    trayMenuApi: {
      on: (channel: string, listener: (...args: never[]) => void) => () => void;
      send: (channel: string, ...args: unknown[]) => void;
    };
  }
}

/** Same storage key and shape as the control panel's theme store. */
const THEME_STORAGE_KEY = "potsuboverlay-theme";

function applyTheme() {
  let theme = "system";
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    theme = raw ? (JSON.parse(raw) as { state?: { theme?: string } }).state?.theme ?? "system" : "system";
  } catch {
    // Fall back to the system theme.
  }
  const dark =
    theme === "dark" || (theme !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

const send = (action: TrayMenuAction) => window.trayMenuApi.send("tray-menu:action", action);

function Item({
  icon,
  children,
  trailing,
  disabled,
  onSelect,
  role = "menuitem",
  checked,
}: {
  icon?: ReactNode;
  children: ReactNode;
  trailing?: ReactNode;
  disabled?: boolean;
  onSelect: () => void;
  role?: "menuitem" | "menuitemcheckbox" | "menuitemradio";
  checked?: boolean;
}) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={checked}
      data-menu-item
      disabled={disabled}
      onClick={onSelect}
      // Hover moves focus, as in shadcn's DropdownMenu, so mouse and keyboard share one highlight.
      onPointerMove={(event) => event.currentTarget.focus({ preventScroll: true })}
      className={cn(
        "relative flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-[13px] outline-none",
        "transition-colors duration-100 focus:bg-accent focus:text-accent-foreground",
        "disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0"
      )}
    >
      <span className="flex size-4 items-center justify-center text-muted-foreground">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {trailing}
    </button>
  );
}

/** Visual-only switch (the whole row is the button), matching the app's Switch. */
function SwitchIndicator({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex h-4 w-7 shrink-0 items-center rounded-full border-2 border-transparent transition-colors",
        checked ? "bg-primary" : "bg-input"
      )}
    >
      <span
        className={cn(
          "block size-3 rounded-full bg-background shadow-sm transition-transform",
          checked ? "translate-x-3" : "translate-x-0"
        )}
      />
    </span>
  );
}

const Separator = () => <div role="separator" className="-mx-1 my-1 h-px bg-border" />;

function TrayMenu() {
  const [state, setState] = useState<TrayMenuState | null>(null);
  const [openKey, setOpenKey] = useState(0);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const api = window.trayMenuApi;
    const offs = [
      api.on("tray-menu:state", (next: TrayMenuState) => {
        applyTheme();
        setState(next);
      }),
      api.on("tray-menu:open", () => {
        setOpenKey((key) => key + 1);
        // Focus the menu (not an item) so keyboard users can start with ↓.
        surfaceRef.current?.focus({ preventScroll: true });
      }),
    ];
    return () => offs.forEach((off) => off());
  }, []);

  // After every render with new state, report the exact size so the window fits.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!state || !root) return;
    // Layout size, unaffected by the entrance scale transform.
    window.trayMenuApi.send("tray-menu:ready", { width: root.offsetWidth, height: root.offsetHeight });
  }, [state]);

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      window.trayMenuApi.send("tray-menu:close");
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const items = [...(surfaceRef.current?.querySelectorAll<HTMLButtonElement>("[data-menu-item]:not(:disabled)") ?? [])];
    if (items.length === 0) return;
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      event.key === "ArrowDown"
        ? items[(index + 1) % items.length]
        : items[(index - 1 + items.length) % items.length];
    next.focus();
  };

  if (!state) return null;
  const { labels } = state;

  return (
    <div ref={rootRef} className="inline-block p-[10px]">
      <motion.div
        key={openKey}
        ref={surfaceRef}
        role="menu"
        tabIndex={-1}
        onKeyDown={onKeyDown}
        initial={reduceMotion ? false : { opacity: 0, scale: 0.97, y: 4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", duration: 0.22, bounce: 0 }}
        style={{ transformOrigin: "bottom right" }}
        className="w-[236px] rounded-lg border bg-popover p-1 text-popover-foreground shadow-[0_8px_30px_rgba(0,0,0,0.18)] outline-none dark:shadow-[0_8px_30px_rgba(0,0,0,0.5)]"
      >
        <Item icon={<AppWindow />} onSelect={() => send({ type: "open" })}>
          {labels.open}
        </Item>
        <Separator />
        <Item
          icon={<Captions />}
          role="menuitemcheckbox"
          checked={state.overlayVisible}
          onSelect={() => send({ type: "toggleOverlay" })}
          trailing={<SwitchIndicator checked={state.overlayVisible} />}
        >
          {labels.showSubtitle}
        </Item>
        <Item icon={<Move />} onSelect={() => send({ type: "edit" })}>
          {labels.editPosition}
        </Item>
        <Separator />
        <div className="px-2 pt-1 pb-1 text-[11px] font-medium text-muted-foreground">{labels.language}</div>
        {state.modes.map((mode) => (
          <Item
            key={mode.value}
            role="menuitemradio"
            checked={state.langMode === mode.value}
            disabled={!state.modesEnabled && mode.value !== "both"}
            icon={state.langMode === mode.value ? <Check className="text-foreground" /> : null}
            onSelect={() => send({ type: "langMode", value: mode.value })}
          >
            {mode.label}
          </Item>
        ))}
        <Separator />
        <Item icon={<Power />} onSelect={() => send({ type: "quit" })}>
          {labels.quit}
        </Item>
      </motion.div>
    </div>
  );
}

export default TrayMenu;
