/**
 * Fails when package.json's version has no entry in CHANGELOG.md, so a
 * release can't ship without its changelog. Entries must use the heading the
 * in-app update dialog parses:  ## [x.y.z] - <date or note>
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const { version } = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const changelogPath = path.join(root, "CHANGELOG.md");

if (!fs.existsSync(changelogPath)) {
  console.error("[changelog] CHANGELOG.md is missing. Copy docs/CHANGELOG_TEMPLATE.md to get started.");
  process.exit(1);
}

const lines = fs.readFileSync(changelogPath, "utf8").split(/\r?\n/);
const heading = /^## \[(\d+\.\d+\.\d+)\]\s*-\s*(.+)$/;
const start = lines.findIndex((line) => heading.exec(line)?.[1] === version);

if (start < 0) {
  console.error(
    `[changelog] No entry for version ${version}. Add a section like:\n\n## [${version}] - YYYY-MM-DD\n\n### 新增\n\n- ...\n`
  );
  process.exit(1);
}

// The entry must say something: at least one list item before the next version.
const end = lines.findIndex((line, index) => index > start && line.startsWith("## "));
const body = lines.slice(start + 1, end < 0 ? undefined : end);
if (!body.some((line) => /^\s*[-*]\s+\S/.test(line))) {
  console.error(`[changelog] The entry for ${version} has no items.`);
  process.exit(1);
}

console.log(`[changelog] ${version} is documented.`);
