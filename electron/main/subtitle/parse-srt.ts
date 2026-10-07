import type { RawCue } from "./types";

/**
 * Parser shared by SRT and WebVTT. It is line-based rather than block-based
 * because real files are messy: YouTube exports put whitespace-only lines
 * inside cues, some files omit blank separators, and VTT allows identifiers.
 */

const TIMING_RE =
  /^\s*((?:\d+:)?\d{1,2}:\d{1,2}(?:[.,]\d{1,3})?)\s*-->\s*((?:\d+:)?\d{1,2}:\d{1,2}(?:[.,]\d{1,3})?)/;

export function parseTimestamp(value: string): number {
  const [clock, fraction = ""] = value.trim().split(/[.,]/);
  const parts = clock.split(":").map(Number);
  while (parts.length < 3) parts.unshift(0);
  const [h, m, s] = parts;
  const ms = fraction ? Math.round(Number(`0.${fraction}`) * 1000) : 0;
  return ((h * 60 + m) * 60 + s) * 1000 + ms;
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  lrm: "",
  rlm: "",
};

export function cleanMarkupText(text: string): string {
  return (
    text
      // WebVTT ruby annotations: keep the base text, drop the reading.
      .replace(/<rt>[\s\S]*?<\/rt>/gi, "")
      // HTML-ish / VTT tags, including inline timestamps like <00:00:01.000>.
      .replace(/<[^>\n]*>/g, "")
      // ASS-style override blocks that some SRT files carry, e.g. {\an8}.
      .replace(/\{\\[^}]*\}/g, "")
      .replace(/&(#\d+|[a-z]+);/gi, (match, name: string) => {
        if (name.startsWith("#")) return String.fromCodePoint(Number(name.slice(1)));
        return ENTITIES[name.toLowerCase()] ?? match;
      })
      .replace(/\s+$/g, "")
      .replace(/^\s+/g, "")
  );
}

export function parseSrtLike(content: string, kind: "srt" | "vtt"): RawCue[] {
  const lines = content.replace(/^﻿/, "").split(/\r\n|\r|\n/);
  const cues: RawCue[] = [];
  let current: { start: number; end: number; body: string[] } | null = null;
  let skippingBlock = false;

  const finish = () => {
    if (!current) return;
    const body = trimBlockTail(current.body);
    const textLines = body
      .map((line) => cleanMarkupText(line))
      .filter((line) => line.length > 0);
    if (textLines.length > 0 && current.end > current.start) {
      cues.push({
        start: current.start,
        end: current.end,
        lines: textLines.map((text, index) => ({ text, slot: String(index) })),
      });
    }
    current = null;
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    if (kind === "vtt" && !current) {
      // Skip header and NOTE/STYLE/REGION blocks until the next blank line.
      if (/^(WEBVTT|NOTE|STYLE|REGION)\b/.test(line)) {
        skippingBlock = true;
        continue;
      }
      if (skippingBlock) {
        if (line.trim() === "") skippingBlock = false;
        continue;
      }
    }

    const timing = TIMING_RE.exec(line);
    if (timing) {
      finish();
      current = {
        start: parseTimestamp(timing[1]),
        end: parseTimestamp(timing[2]),
        body: [],
      };
      continue;
    }

    if (current) current.body.push(line);
  }
  finish();

  return cues.sort((a, b) => a.start - b.start);
}

/**
 * The body collected for a cue runs until the next timing line, so it also
 * contains the separator and the next cue's identifier. Cut at the last truly
 * empty line; fall back to dropping a trailing numeric identifier.
 */
function trimBlockTail(body: string[]): string[] {
  let lastEmpty = -1;
  for (let i = body.length - 1; i >= 0; i -= 1) {
    if (body[i] === "") {
      lastEmpty = i;
      break;
    }
  }
  if (lastEmpty >= 0) {
    // Everything after the separator is the next cue's identifier.
    let end = lastEmpty;
    while (end > 0 && body[end - 1] === "") end -= 1;
    return body.slice(0, end);
  }
  if (body.length > 0 && /^\s*\d+\s*$/.test(body[body.length - 1])) {
    return body.slice(0, -1);
  }
  return body;
}
