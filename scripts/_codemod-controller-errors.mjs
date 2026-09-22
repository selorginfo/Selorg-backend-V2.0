/**
 * One-off codemod: replace hand-rolled `res.status(500).json({ success:false, error: ... })`
 * catch bodies with `sendControllerError(res, err, fallback?)` so caught errors get the
 * correct HTTP status instead of a blanket 500.
 *
 * Usage: node scripts/_codemod-controller-errors.mjs [--dry]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const DRY = process.argv.includes("--dry");

const TARGETS = [
  "src/modules/production/production.controller.ts",
  "src/modules/merch/merch.controller.ts",
];

// res.status(500).json({ success: false, error: (err as Error).message || 'Fallback' });
const WITH_FALLBACK =
  /res\s*\.status\(500\)\s*\.json\(\{\s*success:\s*false,\s*error:\s*\((\w+) as Error\)\.message\s*\|\|\s*(['"`][^'"`]*['"`])\s*,?\s*\}\)\s*;/g;
// res.status(500).json({ success: false, error: (err as Error).message });
const PLAIN =
  /res\s*\.status\(500\)\s*\.json\(\{\s*success:\s*false,\s*error:\s*\((\w+) as Error\)\.message\s*,?\s*\}\)\s*;/g;

const IMPORT_LINE = `import { sendControllerError } from '../../utils/controller-error';`;

let totalReplaced = 0;

for (const rel of TARGETS) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) { console.log(`skip (missing): ${rel}`); continue; }
  let text = fs.readFileSync(file, "utf8");
  const before = text;
  let n = 0;

  text = text.replace(WITH_FALLBACK, (_m, errVar, fallback) => {
    n++;
    return `sendControllerError(res, ${errVar}, ${fallback});`;
  });
  text = text.replace(PLAIN, (_m, errVar) => {
    n++;
    return `sendControllerError(res, ${errVar});`;
  });

  if (n && !text.includes("utils/controller-error")) {
    // Insert after the final top-of-file import statement.
    const imports = [...text.matchAll(/^import .*?;$/gms)];
    if (imports.length) {
      const last = imports[imports.length - 1];
      const at = last.index + last[0].length;
      text = text.slice(0, at) + "\n" + IMPORT_LINE + text.slice(at);
    } else {
      text = IMPORT_LINE + "\n" + text;
    }
  }

  if (text !== before) {
    if (!DRY) fs.writeFileSync(file, text);
    console.log(`${DRY ? "[dry] " : ""}${rel}: ${n} replacements`);
    totalReplaced += n;
  } else {
    console.log(`${rel}: no change`);
  }
}

// Report anything left behind so nothing is silently missed.
for (const rel of TARGETS) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) continue;
  const left = (fs.readFileSync(file, "utf8").match(/res\s*\.status\(500\)/g) || []).length;
  if (left) console.log(`  remaining res.status(500) in ${rel}: ${left}`);
}

console.log(`total: ${totalReplaced}`);
