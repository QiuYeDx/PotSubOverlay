import { app, BrowserWindow } from "electron";
import {
  smoothCorners,
  smoothCornersCSS,
} from "@qiuyedx/smooth-corners";

const EXPECTED_ELECTRON_VERSION = "41.10.3";
const MINIMUM_CHROMIUM_MAJOR = 139;
const variables = smoothCorners(24, 0.7);
const cssContractFailures = [];

if (!smoothCornersCSS.includes("border-radius: var(--sc-r)")) {
  cssContractFailures.push("smooth corners CSS has no border-radius fallback");
}
if (!smoothCornersCSS.includes("@supports (corner-shape: superellipse(2))")) {
  cssContractFailures.push("smooth corners CSS has no corner-shape feature guard");
}
if (!smoothCornersCSS.includes("corner-shape: var(--sc-s)")) {
  cssContractFailures.push("smooth corners CSS has no enhanced corner-shape rule");
}

const variableDeclarations = Object.entries(variables)
  .map(([name, value]) => `${name}: ${value};`)
  .join("\n");

const html = `
<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <style>
      ${smoothCornersCSS}
      #target {
        ${variableDeclarations}
        width: 160px;
        height: 96px;
      }
    </style>
  </head>
  <body>
    <div id="target" class="smooth-corners"></div>
  </body>
</html>`;

async function checkRuntime() {
  await app.whenReady();

  const window = new BrowserWindow({
    show: false,
    webPreferences: {
      sandbox: true,
    },
  });

  try {
    await window.loadURL(
      `data:text/html;charset=UTF-8,${encodeURIComponent(html)}`
    );

    const rendererResult = await window.webContents.executeJavaScript(`
      (() => {
        const target = document.getElementById("target");
        const style = getComputedStyle(target);
        return {
          supportsCornerShape: CSS.supports(
            "corner-shape",
            "superellipse(2)"
          ),
          borderRadius: style.borderRadius,
          cornerShape: style.cornerShape,
        };
      })()
    `);

    const chromiumMajor = Number(process.versions.chrome.split(".")[0]);
    const failures = [...cssContractFailures];

    if (process.versions.electron !== EXPECTED_ELECTRON_VERSION) {
      failures.push(
        `expected Electron ${EXPECTED_ELECTRON_VERSION}, got ${process.versions.electron}`
      );
    }
    if (chromiumMajor < MINIMUM_CHROMIUM_MAJOR) {
      failures.push(
        `expected Chromium >= ${MINIMUM_CHROMIUM_MAJOR}, got ${process.versions.chrome}`
      );
    }
    if (!rendererResult.supportsCornerShape) {
      failures.push("corner-shape: superellipse() is not supported");
    }
    if (rendererResult.borderRadius !== variables["--sc-i"]) {
      failures.push(
        `expected enhanced radius ${variables["--sc-i"]}, got ${rendererResult.borderRadius}`
      );
    }
    if (rendererResult.cornerShape !== variables["--sc-s"]) {
      failures.push(
        `expected corner shape ${variables["--sc-s"]}, got ${rendererResult.cornerShape}`
      );
    }

    const report = {
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node,
      ...rendererResult,
    };

    if (failures.length > 0) {
      throw new Error(
        `${failures.join("; ")}\n${JSON.stringify(report, null, 2)}`
      );
    }

    console.log(`[electron:check] ${JSON.stringify(report, null, 2)}`);
  } finally {
    if (!window.isDestroyed()) window.destroy();
  }
}

checkRuntime()
  .then(() => app.exit(0))
  .catch((error) => {
    console.error("[electron:check] failed", error);
    app.exit(1);
  });
