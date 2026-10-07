import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Grouped list in the spirit of macOS System Settings: a titled card whose
 * rows share inset dividers. Rows put the label on the left and the control
 * on the right; descriptions wrap under the label.
 */
export function SettingsGroup({
  title,
  description,
  action,
  children,
  className,
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col gap-2", className)}>
      {title || action ? (
        <div className="flex min-h-7 items-end justify-between gap-3 px-1">
          <div className="min-w-0">
            {title ? <h3 className="text-[13px] font-semibold tracking-tight">{title}</h3> : null}
            {description ? (
              <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      <div className="divide-y divide-border/70 overflow-hidden rounded-xl border bg-card shadow-xs">
        {children}
      </div>
    </section>
  );
}

export function SettingsRow({
  label,
  description,
  children,
  className,
  stacked = false,
}: {
  label: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  className?: string;
  /** Put the control under the label (for wide controls such as sliders with values). */
  stacked?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex gap-x-6 gap-y-2.5 px-4 py-3",
        stacked ? "flex-col" : "items-center justify-between",
        className
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium leading-5">{label}</div>
        {description ? (
          <div className="mt-0.5 text-xs leading-4 text-muted-foreground">{description}</div>
        ) : null}
      </div>
      {children ? <div className={cn(stacked ? "w-full" : "shrink-0")}>{children}</div> : null}
    </div>
  );
}
