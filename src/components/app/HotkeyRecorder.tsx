import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";

const CODE_TO_KEY: Record<string, string> = {
  BracketLeft: "[",
  BracketRight: "]",
  Comma: ",",
  Period: ".",
  Slash: "/",
  Backslash: "\\",
  Semicolon: ";",
  Quote: "'",
  Backquote: "`",
  Minus: "-",
  Equal: "=",
  Space: "Space",
  Enter: "Enter",
  Tab: "Tab",
  ArrowUp: "Up",
  ArrowDown: "Down",
  ArrowLeft: "Left",
  ArrowRight: "Right",
  Home: "Home",
  End: "End",
  PageUp: "PageUp",
  PageDown: "PageDown",
  Insert: "Insert",
  Delete: "Delete",
};

/** Map a keyboard event to an Electron accelerator key, or null for modifiers. */
function keyFromEvent(event: KeyboardEvent): string | null {
  const { code } = event;
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit\d$/.test(code)) return code.slice(5);
  if (/^Numpad\d$/.test(code)) return `num${code.slice(6)}`;
  if (/^F\d{1,2}$/.test(code)) return code;
  return CODE_TO_KEY[code] ?? null;
}

const DISPLAY: Record<string, string> = {
  Control: "Ctrl",
  Alt: "Alt",
  Shift: "Shift",
  Super: "Win",
  Up: "↑",
  Down: "↓",
  Left: "←",
  Right: "→",
};

export function Keycaps({ accelerator, muted }: { accelerator: string; muted?: boolean }) {
  // "+" itself can be a key ("Control+Plus" in Electron), so split carefully.
  const parts = accelerator.split("+").filter(Boolean);
  return (
    <span className="flex items-center gap-1">
      {parts.map((part, index) => (
        <kbd
          key={`${part}-${index}`}
          className={cn(
            "inline-flex h-6 min-w-6 items-center justify-center rounded-[6px] border border-b-2 bg-background px-1.5 font-sans text-[11px] font-medium shadow-xs",
            muted && "text-muted-foreground"
          )}
        >
          {DISPLAY[part] ?? part}
        </kbd>
      ))}
    </span>
  );
}

/**
 * Click, then press a combination. Requires a modifier (except F-keys).
 * Esc cancels, Backspace/Delete clears.
 */
export function HotkeyRecorder({
  value,
  onChange,
  failed,
}: {
  value: string;
  onChange: (accelerator: string) => void;
  failed?: boolean;
}) {
  const { t } = useTranslation();
  const [recording, setRecording] = useState(false);
  const [pending, setPending] = useState<string[]>([]);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!recording) return;
    void window.ipcRenderer.invoke("hotkeys:suspend", true);

    const onKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.key === "Escape") {
        setRecording(false);
        return;
      }
      const modifiers = [
        event.ctrlKey && "Control",
        event.altKey && "Alt",
        event.shiftKey && "Shift",
        event.metaKey && "Super",
      ].filter(Boolean) as string[];
      if ((event.key === "Backspace" || event.key === "Delete") && modifiers.length === 0) {
        onChange("");
        setRecording(false);
        return;
      }
      const key = keyFromEvent(event);
      setPending(key ? [...modifiers, key] : modifiers);
      if (!key) return;
      if (modifiers.length === 0 && !/^F\d{1,2}$/.test(key)) return;
      onChange([...modifiers, key].join("+"));
      setRecording(false);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (!event.ctrlKey && !event.altKey && !event.shiftKey && !event.metaKey) setPending([]);
    };
    const onBlur = () => setRecording(false);

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
      window.removeEventListener("blur", onBlur);
      setPending([]);
      void window.ipcRenderer.invoke("hotkeys:suspend", false);
    };
  }, [recording, onChange]);

  return (
    <div className="flex items-center gap-2">
      {failed && !recording ? (
        <span className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400" title={t("setting:hotkeys.conflict")}>
          <AlertTriangle className="size-3.5" />
          {t("setting:hotkeys.conflict_short")}
        </span>
      ) : null}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setRecording((current) => !current)}
        className={cn(
          "flex h-8 min-w-[148px] items-center justify-center rounded-lg border px-2 transition-[box-shadow,background-color] duration-150",
          recording
            ? "bg-accent ring-2 ring-ring/40"
            : "bg-background hover:bg-accent/60 dark:bg-input/30"
        )}
      >
        {recording ? (
          pending.length > 0 ? (
            <Keycaps accelerator={pending.join("+")} muted />
          ) : (
            <span className="text-xs text-muted-foreground">{t("setting:hotkeys.recording")}</span>
          )
        ) : value ? (
          <Keycaps accelerator={value} />
        ) : (
          <span className="text-xs text-muted-foreground">{t("setting:hotkeys.none")}</span>
        )}
      </button>
      {value && !recording ? (
        <button
          type="button"
          aria-label={t("setting:hotkeys.clear")}
          title={t("setting:hotkeys.clear")}
          className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          onClick={() => onChange("")}
        >
          <X className="size-3.5" />
        </button>
      ) : (
        <span className="size-6" />
      )}
    </div>
  );
}
