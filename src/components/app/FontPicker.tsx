import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import useAppStore from "@/store/useAppStore";

const MAX_RESULTS = 160;

/**
 * Searchable font list. Installed recommended fonts come first; every entry
 * is previewed in its own face with a sample in the target language.
 */
export function FontPicker({
  value,
  onChange,
  recommended,
  sample,
}: {
  value: string;
  onChange: (family: string) => void;
  recommended: string[];
  sample: string;
}) {
  const { t } = useTranslation();
  const fonts = useAppStore((s) => s.fonts);
  const loadFonts = useAppStore((s) => s.loadFonts);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) void loadFonts();
  }, [open, loadFonts]);

  const { suggested, others } = useMemo(() => {
    const installed = new Set(fonts ?? []);
    const q = query.trim().toLowerCase();
    const match = (name: string) => !q || name.toLowerCase().includes(q);
    // Before the list loads, still offer the recommendations.
    const suggested = recommended.filter((name) => (fonts ? installed.has(name) : true) && match(name));
    const others = (fonts ?? [])
      .filter((name) => !recommended.includes(name) && match(name))
      .slice(0, MAX_RESULTS);
    return { suggested, others };
  }, [fonts, query, recommended]);

  const item = (name: string) => (
    <button
      key={name}
      type="button"
      onClick={() => {
        onChange(name);
        setOpen(false);
      }}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent",
        name === value && "bg-accent/60"
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px]">{name}</span>
        <span className="block truncate text-[13px] text-muted-foreground" style={{ fontFamily: `"${name}"` }}>
          {sample}
        </span>
      </span>
      {name === value ? <Check className="size-3.5 shrink-0" /> : null}
    </button>
  );

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-8 w-[220px] items-center gap-2 rounded-md border bg-background px-2.5 text-left text-[13px] shadow-xs transition-colors hover:bg-accent dark:bg-input/30"
        >
          <span className="min-w-0 flex-1 truncate" style={{ fontFamily: `"${value}"` }}>
            {value}
          </span>
          <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[300px] p-0"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          inputRef.current?.focus();
        }}
      >
        <div className="flex items-center gap-2 border-b px-3">
          <Search className="size-3.5 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("appearance:font.search")}
            className="h-9 w-full bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="max-h-[320px] overflow-y-auto p-1.5">
          {suggested.length > 0 ? (
            <>
              <div className="px-2 pt-1 pb-1 text-[11px] font-medium text-muted-foreground">
                {t("appearance:font.recommended")}
              </div>
              {suggested.map(item)}
            </>
          ) : null}
          {others.length > 0 ? (
            <>
              <div className="px-2 pt-2 pb-1 text-[11px] font-medium text-muted-foreground">
                {t("appearance:font.all")}
              </div>
              {others.map(item)}
            </>
          ) : null}
          {fonts === null ? (
            <div className="px-2 py-3 text-xs text-muted-foreground">{t("appearance:font.loading")}</div>
          ) : suggested.length + others.length === 0 ? (
            <div className="px-2 py-3 text-xs text-muted-foreground">{t("appearance:font.empty")}</div>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
