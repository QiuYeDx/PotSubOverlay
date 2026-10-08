import type { DisplayPayload } from "@/shared/types";
import { activeCues, type SubtitleTrack } from "./track";

/**
 * Cues that start this close together are one line: the two languages of a
 * bilingual pair (two files, or two events in one file) rarely start on the
 * exact same millisecond.
 */
export const SAME_LINE_MS = 250;

export interface LineSpan {
  /** Earliest start of the line's cues: where to seek to hear all of it. */
  startMs: number;
  /** A time at which every cue of the line is showing, for composing it. */
  probeMs: number;
}

/** The line on screen at `timeMs`, or null in a gap between lines. */
export function lineAt(tracks: SubtitleTrack[], timeMs: number): LineSpan | null {
  let start = Infinity;
  let latest = -Infinity;
  for (const track of tracks) {
    for (const cue of activeCues(track, timeMs)) {
      start = Math.min(start, cue.start);
      latest = Math.max(latest, cue.start);
    }
  }
  return Number.isFinite(start) ? { startMs: start, probeMs: Math.max(latest, timeMs) } : null;
}

/** Last index in a sorted array whose value is < `limit`, or -1. */
function lastBelow(sorted: number[], limit: number): number {
  let lo = 0;
  let hi = sorted.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] < limit) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}

/**
 * The line that starts before `beforeMs` (by more than SAME_LINE_MS, so the
 * other language of the same line does not count), or null at the beginning.
 */
export function lineBefore(tracks: SubtitleTrack[], beforeMs: number): LineSpan | null {
  let latest = -Infinity;
  for (const track of tracks) {
    const index = lastBelow(track.starts, beforeMs - SAME_LINE_MS);
    if (index >= 0) latest = Math.max(latest, track.starts[index]);
  }
  if (!Number.isFinite(latest)) return null;
  // Gather the other cues of the same line, which may start slightly earlier.
  let start = latest;
  for (const track of tracks) {
    const index = lastBelow(track.starts, latest + 1);
    for (let i = index; i >= 0 && track.starts[i] >= latest - SAME_LINE_MS; i -= 1) {
      start = Math.min(start, track.starts[i]);
    }
  }
  return { startMs: start, probeMs: latest + 1 };
}

export interface ComposedLine {
  startMs: number;
  display: DisplayPayload;
}

/**
 * Lines before `anchorMs`, newest first. Lines that compose to nothing (e.g.
 * hidden by the language mode) and repeats of the line just listed, or of
 * `skipKey`, are passed over.
 */
export function linesBefore(
  tracks: SubtitleTrack[],
  anchorMs: number,
  count: number,
  compose: (timeMs: number) => DisplayPayload,
  skipKey = ""
): ComposedLine[] {
  const result: ComposedLine[] = [];
  let cursor = anchorMs;
  let lastKey = skipKey;
  // Bounded so a file made of empty or identical cues cannot spin for long.
  for (let guard = 0; result.length < count && guard < count * 20; guard += 1) {
    const line = lineBefore(tracks, cursor);
    if (!line) break;
    cursor = line.startMs;
    const display = compose(line.probeMs);
    if (display.blocks.length === 0 || display.key === lastKey || display.key === skipKey) continue;
    lastKey = display.key;
    result.push({ startMs: line.startMs, display });
  }
  return result;
}
