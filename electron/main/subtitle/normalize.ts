import type { RawCue } from "./types";

const FLICKER_GAP_MS = 50;
const TRANSITION_CUE_MS = 30;

function sameLines(a: RawCue, b: RawCue): boolean {
  return (
    a.lines.length === b.lines.length &&
    a.lines.every((line, index) => line.text === b.lines[index].text)
  );
}

/**
 * YouTube auto-translated captions "roll": every cue repeats the previous
 * cue's last line above the new one, separated by ~10ms transition cues.
 * Detect that shape and keep only the new text.
 */
export function isRollingCaptions(cues: RawCue[]): boolean {
  let multi = 0;
  let rolling = 0;
  for (let i = 1; i < cues.length; i += 1) {
    const cue = cues[i];
    if (cue.lines.length < 2) continue;
    multi += 1;
    const previous = cues[i - 1].lines;
    if (cue.lines[0].text === previous[previous.length - 1]?.text) rolling += 1;
  }
  return multi >= 4 && rolling / multi > 0.6;
}

function unroll(cues: RawCue[]): RawCue[] {
  const result: RawCue[] = [];
  let lastShown = "";
  for (const cue of cues) {
    const lines = cue.lines.filter((line) => line.text !== lastShown);
    const duration = cue.end - cue.start;
    if (lines.length === 0 || duration <= TRANSITION_CUE_MS) {
      // Transition cue or pure repeat: extend the previous cue instead.
      const previous = result[result.length - 1];
      if (previous && cue.end > previous.end && lines.length === 0) previous.end = cue.end;
      continue;
    }
    result.push({
      ...cue,
      lines: lines.map((line, index) => ({ ...line, slot: String(index) })),
    });
    lastShown = cue.lines[cue.lines.length - 1].text;
  }
  return result;
}

/** Merge back-to-back cues with identical text so the overlay does not re-animate. */
function mergeContinuations(cues: RawCue[]): RawCue[] {
  const result: RawCue[] = [];
  for (const cue of cues) {
    const previous = result[result.length - 1];
    if (
      previous &&
      sameLines(previous, cue) &&
      cue.start - previous.end <= FLICKER_GAP_MS &&
      cue.start >= previous.start
    ) {
      previous.end = Math.max(previous.end, cue.end);
      continue;
    }
    result.push({ ...cue, lines: [...cue.lines] });
  }
  return result;
}

export function normalizeCues(cues: RawCue[]): RawCue[] {
  const cleaned = cues
    .map((cue) => ({
      ...cue,
      lines: cue.lines.filter((line) => line.text.trim().length > 0),
    }))
    .filter((cue) => cue.lines.length > 0 && cue.end > cue.start);
  const unrolled = isRollingCaptions(cleaned) ? unroll(cleaned) : cleaned;
  return mergeContinuations(unrolled);
}
