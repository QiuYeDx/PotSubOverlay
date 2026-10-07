import type { RawCue } from "./types";

const DEFAULT_EVENT_FORMAT = [
  "layer",
  "start",
  "end",
  "style",
  "name",
  "marginl",
  "marginr",
  "marginv",
  "effect",
  "text",
];

function parseAssTime(value: string): number {
  const match = /^(\d+):(\d{1,2}):(\d{1,2})(?:\.(\d{1,3}))?$/.exec(value.trim());
  if (!match) return NaN;
  const [, h, m, s, frac = "0"] = match;
  return (
    ((Number(h) * 60 + Number(m)) * 60 + Number(s)) * 1000 +
    Math.round(Number(`0.${frac}`) * 1000)
  );
}

const SIGN_TAG_RE = /\\(pos|move|org|clip|iclip)\s*\(|\\p[1-9]/;

export function cleanAssText(text: string): string[] {
  return text
    .replace(/\{[^}]*\}/g, "")
    .replace(/\\h/g, " ")
    .split(/\\[Nn]/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 0);
}

export function parseAss(content: string): RawCue[] {
  const lines = content.replace(/^﻿/, "").split(/\r\n|\r|\n/);
  let section = "";
  let format = DEFAULT_EVENT_FORMAT;
  const cues: RawCue[] = [];
  const seen = new Set<string>();

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.startsWith("[") && line.endsWith("]")) {
      section = line.slice(1, -1).toLowerCase();
      continue;
    }
    if (section !== "events") continue;

    if (/^format\s*:/i.test(line)) {
      format = line
        .slice(line.indexOf(":") + 1)
        .split(",")
        .map((field) => field.trim().toLowerCase());
      continue;
    }
    if (!/^dialogue\s*:/i.test(line)) continue;

    const body = line.slice(line.indexOf(":") + 1).replace(/^\s+/, "");
    const fields: string[] = [];
    let rest = body;
    for (let i = 0; i < format.length - 1; i += 1) {
      const comma = rest.indexOf(",");
      if (comma < 0) break;
      fields.push(rest.slice(0, comma));
      rest = rest.slice(comma + 1);
    }
    fields.push(rest);
    if (fields.length < format.length) continue;

    const get = (name: string) => fields[format.indexOf(name)] ?? "";
    const start = parseAssTime(get("start"));
    const end = parseAssTime(get("end"));
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;

    const rawText = get("text");
    const style = get("style").trim() || "Default";
    const effect = get("effect").trim();
    const textLines = cleanAssText(rawText);
    if (textLines.length === 0) continue;

    // Fansubs often duplicate events on several layers for blur/border effects.
    const dedupeKey = `${start}|${end}|${textLines.join("\n")}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    cues.push({
      start,
      end,
      isSign: SIGN_TAG_RE.test(rawText) || /^(banner|scroll)/i.test(effect),
      lines: textLines.map((text, index) => ({ text, slot: `${style}#${index}` })),
    });
  }

  return cues.sort((a, b) => a.start - b.start);
}
