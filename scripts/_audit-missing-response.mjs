/**
 * TEST INFRASTRUCTURE ONLY.
 *
 * Finds Express handlers whose success path never touches `res`, which makes the
 * request hang until the client times out (as POST /notifications/history/retry-failed did).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, acc);
    else if (entry.name.endsWith(".ts")) acc.push(p);
  }
  return acc;
}

const HANDLER = /export\s+(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/g;
const ARROW = /export\s+const\s+(\w+)\s*(?::[^=]*?)?=\s*async\s*\(([^)]*)\)/g;

/** Returns the balanced `{...}` block starting at or after `from`. */
function bodyAfter(src, from) {
  const open = src.indexOf("{", from);
  if (open < 0) return "";
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  return src.slice(open);
}

const findings = [];
for (const file of walk(path.join(ROOT, "src"))) {
  const src = fs.readFileSync(file, "utf8");
  for (const re of [HANDLER, ARROW]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(src))) {
      const [, name, params] = m;
      if (!/\bres\b/.test(params) || !/\breq\b/.test(params)) continue;
      const body = bodyAfter(src, m.index + m[0].length);
      if (!body) continue;
      // Ignore the catch block: a handler may legitimately only answer on error.
      const success = body.split(/\}\s*catch\s*\(/)[0];
      const answers =
        /\bres\s*\./.test(success) ||
        /\bnext\s*\(/.test(success) ||
        /\b(send|respond|reply)\w*\s*\(\s*res\b/.test(success) ||
        /\(\s*res\s*[,)]/.test(success);
      if (!answers) findings.push(`${path.relative(ROOT, file).replace(/\\/g, "/")} -> ${name}`);
    }
  }
}

findings.forEach((f) => console.log(f));
console.log(`\nhandlers whose success path never answers: ${findings.length}`);
