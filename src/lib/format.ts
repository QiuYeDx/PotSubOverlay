export function formatTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

export function baseName(filePath: string): string {
  return filePath.split(/[\\/]/).pop() ?? filePath;
}

export function dirName(filePath: string): string {
  const parts = filePath.split(/[\\/]/);
  parts.pop();
  return parts.join("\\");
}

/** "+1.5s", "−0.5s", "0.0s" */
export function formatOffset(ms: number): string {
  const seconds = ms / 1000;
  if (Math.abs(seconds) < 0.05) return "0.0s";
  return `${seconds > 0 ? "+" : "−"}${Math.abs(seconds).toFixed(1)}s`;
}

/** PotPlayer window titles end with " - PotPlayer"; strip it for display. */
export function cleanPlayerTitle(title: string): string {
  return title.replace(/\s*-\s*PotPlayer\s*$/i, "").trim();
}
