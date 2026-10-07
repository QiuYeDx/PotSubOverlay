import fs from "node:fs";
import path from "node:path";
import { app, type BrowserWindow } from "electron";
import type { Controller } from "./controller";
import type { ControlWindow } from "./windows/control";
import type { OverlayWindow } from "./windows/overlay";

/**
 * Development-only visual QA driver. Set POTSUB_QA_SCRIPT to a JSON file with
 * an array of steps; captures of the app's own windows are written next to it.
 * Never active in normal runs.
 */
type Step =
  | { wait: number }
  | { capture: "overlay" | "control"; file: string }
  | { snapshot: string }
  | { edit: boolean }
  | { compact: boolean }
  | { js: string }
  | { size: [number, number] }
  | { quit: true };

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function capture(win: BrowserWindow | null | undefined, file: string) {
  if (!win || win.isDestroyed()) return;
  const image = await win.webContents.capturePage();
  fs.writeFileSync(file, image.toPNG());
}

export async function runQaScript(deps: {
  controller: Controller;
  overlay: OverlayWindow;
  control: ControlWindow;
}): Promise<void> {
  const scriptPath = process.env.POTSUB_QA_SCRIPT;
  if (!scriptPath) return;
  const outDir = path.dirname(scriptPath);
  const steps = JSON.parse(fs.readFileSync(scriptPath, "utf8")) as Step[];
  const log = (line: string) => fs.appendFileSync(path.join(outDir, "qa.log"), `${line}\n`);

  for (const step of steps) {
    try {
      log(JSON.stringify(step));
      if ("wait" in step) await delay(step.wait);
      else if ("capture" in step) {
        const win = step.capture === "overlay" ? deps.overlay.win : deps.control.win;
        await capture(win, path.join(outDir, step.file));
      } else if ("snapshot" in step) {
        fs.writeFileSync(
          path.join(outDir, step.snapshot),
          JSON.stringify(deps.controller.snapshot(), null, 2)
        );
      } else if ("edit" in step) await deps.controller.setEditing(step.edit);
      else if ("compact" in step) await deps.control.setCompact(step.compact);
      else if ("js" in step) await deps.control.win?.webContents.executeJavaScript(step.js);
      else if ("size" in step) deps.control.win?.setSize(step.size[0], step.size[1]);
      else if ("quit" in step) app.quit();
    } catch (error) {
      log(`error: ${String(error)}`);
    }
  }
}
