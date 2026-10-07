/**
 * Dev tool: show which subtitles PotSubOverlay would load for a media file and
 * how it understands them.
 *
 *   corepack pnpm subtitle:inspect "D:/path/to/video.mkv" [primary language, default zh]
 */
import fs from "node:fs/promises";
import path from "node:path";
import { composeDisplay } from "../electron/main/subtitle/compose";
import { matchSubtitleFiles } from "../electron/main/subtitle/finder";
import { buildTrack, selectDefaultTracks } from "../electron/main/subtitle/track";
import type { SubtitleLang } from "../src/shared/languages";

const formatTime = (ms: number) =>
  `${String(Math.floor(ms / 60000)).padStart(2, "0")}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}`;

async function main() {
  const mediaPath = process.argv[2];
  if (!mediaPath) {
    console.error("usage: subtitle:inspect <media path>");
    process.exit(1);
  }
  const entries = await fs.readdir(path.dirname(mediaPath));
  const candidates = matchSubtitleFiles(mediaPath, entries);
  console.log(`media: ${path.basename(mediaPath)}`);
  console.log(`candidates: ${candidates.length}`);

  const tracks = [];
  for (const candidate of candidates) {
    const started = performance.now();
    const track = buildTrack(candidate, await fs.readFile(candidate.path), { filterSigns: true });
    tracks.push(track);
    console.log(
      `  - ${candidate.fileName}\n    tag=${JSON.stringify(track.tag)} enc=${track.encoding} cues=${track.cues.length} langs=${track.langs.join("+")} bilingual=${track.bilingual} (${(performance.now() - started).toFixed(1)}ms)`
    );
  }

  const primaryLang = (process.argv[3] as SubtitleLang | undefined) ?? "zh";
  const selected = selectDefaultTracks(tracks, "sc", primaryLang);
  console.log(`default: ${selected.map((t) => t.fileName).join(", ") || "(none)"}`);
  const cues = selected[0]?.cues ?? [];
  const samples = [0.1, 0.3, 0.5, 0.7].map((ratio) => cues[Math.floor(cues.length * ratio)]);
  for (const cue of samples) {
    if (!cue) continue;
    const t = cue.start + 1;
    for (const mode of ["both", "primary", "secondary"] as const) {
      const display = composeDisplay(selected, t, mode, "primary-first", primaryLang);
      console.log(
        `  [${formatTime(t)}] ${mode.padEnd(9)} ${display.blocks.map((b) => `${b.lang}: ${b.lines.join(" / ")}`).join("  ‖  ")}`
      );
    }
  }
}

void main();
