import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = path.resolve(import.meta.dirname, "..");
const sourceRoot = path.join(root, "backend", "src");
const failures = [];

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(target));
    else if (entry.name.endsWith(".ts")) files.push(target);
  }
  return files;
}

for (const file of await walk(sourceRoot)) {
  const text = await readFile(file, "utf8");
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (!/(?:prepare|exec)\s*\(\s*`/.test(line) || !line.includes("${")) return;
    const safeIdentifier = line.includes("quoteIdentifier(");
    const fixedExportTables = file.endsWith(`${path.sep}sec-p1-service.ts`)
      && line.includes("${table}")
      && text.includes('const tables = ["users", "project_members", "projects", "cost_records"]');
    if (!safeIdentifier && !fixedExportTables) failures.push(`${path.relative(root, file)}:${index + 1}: dynamic SQL interpolation`);
  });
}

if (failures.length > 0) {
  console.error("SQL 注入静态审计失败：\n" + failures.join("\n"));
  process.exit(1);
}
console.log("Security audit passed: SQL identifiers are allowlisted and values use bound parameters.");
