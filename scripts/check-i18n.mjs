import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const localesRoot = path.join(root, "src", "locales");
const languages = ["zh", "zh-Hant", "en", "ja"];
const namespaces = ["common", "player", "appearance", "about", "setting"];

function flattenKeys(value, prefix = "") {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      flattenKeys(item, prefix ? `${prefix}.${index}` : String(index))
    );
  }

  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, child]) =>
      flattenKeys(child, prefix ? `${prefix}.${key}` : key)
    );
  }

  return [prefix];
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

let failed = false;

for (const namespace of namespaces) {
  const basePath = path.join(localesRoot, "zh", `${namespace}.json`);
  const baseKeys = flattenKeys(readJson(basePath)).sort();

  for (const language of languages) {
    const filePath = path.join(localesRoot, language, `${namespace}.json`);
    if (!fs.existsSync(filePath)) {
      console.error(`[i18n] Missing file: ${filePath}`);
      failed = true;
      continue;
    }

    const keys = flattenKeys(readJson(filePath)).sort();
    const missing = baseKeys.filter((key) => !keys.includes(key));
    const extra = keys.filter((key) => !baseKeys.includes(key));

    if (missing.length || extra.length) {
      failed = true;
      console.error(`[i18n] ${language}/${namespace}.json mismatch`);
      if (missing.length) console.error(`  Missing: ${missing.join(", ")}`);
      if (extra.length) console.error(`  Extra: ${extra.join(", ")}`);
    }
  }
}

if (failed) {
  process.exit(1);
}

console.log("[i18n] Locale keys are aligned.");

