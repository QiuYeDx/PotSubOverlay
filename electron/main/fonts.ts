import { execFile } from "node:child_process";

let cache: Promise<string[]> | null = null;

const SCRIPT = [
  "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8",
  "Add-Type -AssemblyName System.Drawing",
  "(New-Object System.Drawing.Text.InstalledFontCollection).Families | ForEach-Object { $_.Name }",
].join("; ");

/**
 * Installed font families (names as Windows reports them in the UI language;
 * Chromium resolves localized family names through DirectWrite).
 */
export function listFontFamilies(): Promise<string[]> {
  cache ??= new Promise((resolve) => {
    execFile(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", SCRIPT],
      { windowsHide: true, encoding: "utf8", timeout: 15_000, maxBuffer: 4 * 1024 * 1024 },
      (error, stdout) => {
        if (error) {
          console.error("[fonts] enumeration failed", error);
          cache = null;
          resolve([]);
          return;
        }
        const names = [...new Set(stdout.split(/\r?\n/).map((name) => name.trim()).filter(Boolean))];
        resolve(names.sort((a, b) => a.localeCompare(b)));
      }
    );
  });
  return cache;
}
