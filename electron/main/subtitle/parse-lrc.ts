import type { RawCue } from "./types";

/** LRC lines have no end time; cap how long a line stays on screen. */
export const LRC_MAX_DURATION_MS = 10_000;

const TIME_TAG_RE = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;

function toMs(min: string, sec: string, frac?: string): number {
  const fraction = frac ? Math.round(Number(`0.${frac}`) * 1000) : 0;
  return (Number(min) * 60 + Number(sec)) * 1000 + fraction;
}

export function parseLrc(content: string): RawCue[] {
  const lines = content.replace(/^﻿/, "").split(/\r\n|\r|\n/);
  let offset = 0;
  const entries: { time: number; text: string; order: number }[] = [];

  lines.forEach((line, order) => {
    const offsetMatch = /^\s*\[offset:\s*([+-]?\d+)\s*\]/i.exec(line);
    if (offsetMatch) {
      offset = Number(offsetMatch[1]);
      return;
    }

    const times: number[] = [];
    let lastIndex = 0;
    TIME_TAG_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    // Timestamps must be a contiguous prefix: "[00:01.00][00:05.00]text".
    while ((match = TIME_TAG_RE.exec(line)) && match.index === lastIndex) {
      times.push(toMs(match[1], match[2], match[3]));
      lastIndex = TIME_TAG_RE.lastIndex;
    }
    if (times.length === 0) return;

    const text = line
      .slice(lastIndex)
      // Enhanced LRC word timing: <00:01.23>
      .replace(/<\d{1,3}:\d{1,2}(?:[.:]\d{1,3})?>/g, "")
      .trim();
    for (const time of times) entries.push({ time, text, order });
  });

  entries.sort((a, b) => a.time - b.time || a.order - b.order);

  // Group by timestamp: bilingual LRC repeats the time for the translation.
  const groups: { time: number; texts: string[] }[] = [];
  for (const entry of entries) {
    const last = groups[groups.length - 1];
    if (last && last.time === entry.time) {
      last.texts.push(entry.text);
    } else {
      groups.push({ time: entry.time, texts: [entry.text] });
    }
  }

  const cues: RawCue[] = [];
  groups.forEach((group, index) => {
    const texts = group.texts.filter((text) => text.length > 0);
    if (texts.length === 0) return; // an empty line only clears the previous one
    const next = groups[index + 1]?.time ?? Infinity;
    // [offset:+n] means lyrics should appear n ms earlier.
    const start = Math.max(0, group.time - offset);
    const end = Math.min(next - offset, start + LRC_MAX_DURATION_MS);
    if (end <= start) return;
    cues.push({
      start,
      end,
      lines: texts.map((text, slot) => ({ text, slot: String(slot) })),
    });
  });

  return cues;
}
