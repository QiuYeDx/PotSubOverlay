/**
 * Rasterise src/assets/app-logo.svg into the icons electron-builder and the
 * tray need. Run with Electron (it provides the renderer):
 *
 *   corepack pnpm icons:build
 */
const fs = require("node:fs");
const path = require("node:path");
const { app, BrowserWindow } = require("electron");

const root = path.join(__dirname, "..");
const svg = fs.readFileSync(path.join(root, "src/assets/app-logo.svg"), "utf8");
const ICO_SIZES = [16, 20, 24, 32, 40, 48, 64, 128, 256];

async function render(win, size) {
  const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  const png = await win.webContents.executeJavaScript(`
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = ${size};
        const ctx = canvas.getContext("2d");
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, ${size}, ${size});
        resolve(canvas.toDataURL("image/png").split(",")[1]);
      };
      img.onerror = reject;
      img.src = ${JSON.stringify(dataUrl)};
    })
  `);
  return Buffer.from(png, "base64");
}

/** ICO container with PNG-compressed entries (supported since Windows Vista). */
function buildIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  const entries = [];
  let offset = 6 + images.length * 16;
  for (const { size, data } of images) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    entries.push(entry);
  }
  return Buffer.concat([header, ...entries, ...images.map((image) => image.data)]);
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 64, height: 64 });
  await win.loadURL("about:blank");
  const images = [];
  for (const size of ICO_SIZES) images.push({ size, data: await render(win, size) });
  const ico = buildIco(images);
  fs.writeFileSync(path.join(root, "build/icon.ico"), ico);
  fs.writeFileSync(path.join(root, "public/favicon.ico"), ico);
  fs.writeFileSync(path.join(root, "build/icon.png"), await render(win, 1024));
  console.log(`icons written (${ICO_SIZES.join(", ")} + 1024)`);
  app.quit();
});
