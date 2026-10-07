import { cn } from "@/lib/utils";

/**
 * File-name truncation that keeps the end (episode number, tag, extension)
 * visible: the head shrinks with an ellipsis, the tail never does. The full
 * name is available as a tooltip and to assistive technology.
 */
export function MiddleTruncate({
  text,
  tail = 18,
  className,
}: {
  text: string;
  tail?: number;
  className?: string;
}) {
  const chars = Array.from(text);
  if (chars.length <= tail + 4) {
    return (
      <span className={cn("block truncate", className)} title={text}>
        {text}
      </span>
    );
  }
  const head = chars.slice(0, chars.length - tail).join("");
  const end = chars.slice(chars.length - tail).join("");
  return (
    <span className={cn("flex min-w-0", className)} title={text} aria-label={text}>
      <span className="min-w-0 truncate" aria-hidden="true">
        {head}
      </span>
      <span className="shrink-0 whitespace-pre" aria-hidden="true">
        {end}
      </span>
    </span>
  );
}
