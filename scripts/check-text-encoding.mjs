import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(process.cwd(), "..");
const extensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".md", ".css", ".yml", ".yaml", ".html", ".env", ".example"]);
const ignored = new Set([".git", "node_modules", "dist", ".next", ".next-e2e", ".next-build", "playwright-report", "test-results", "artifacts", "data", "logs"]);
const ignoredFiles = new Set(["rule.md", "rule.md.bak"]);
const decoder = new TextDecoder("utf-8", { fatal: true });
const failures = [];
let checked = 0;

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    if (ignoredFiles.has(entry.name)) continue;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) { await walk(file); continue; }
    const ext = path.extname(entry.name).toLowerCase();
    if (!extensions.has(ext) && !entry.name.startsWith(".env")) continue;
    checked++;
    try {
      const value = decoder.decode(await readFile(file));
      if (value.includes("\u0000")) failures.push(`${path.relative(root, file)}: 包含 NUL 字节`);
      if (value.includes("\uFFFD")) failures.push(`${path.relative(root, file)}: 包含 Unicode 替换字符`);
    } catch (error) {
      failures.push(`${path.relative(root, file)}: 非法 UTF-8 (${error.message})`);
    }
  }
}

await walk(root);
if (failures.length) {
  console.error(`[encoding] ${failures.length} 个文本文件未通过 UTF-8 校验:`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`[encoding] PASS: ${checked} 个文本文件均为有效 UTF-8，且不含 NUL/替换字符`);
