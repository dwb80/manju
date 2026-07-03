import { copyFile, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { encodeCsvCell, parseCsvRecords } from "../backend/dist/src/storage/csv.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const csvRoot = path.join(root, "backend", "data", "csv");
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

function compactValue(value) {
  if (typeof value === "string") {
    if (value.startsWith("data:")) {
      return `[uploaded-image:${Math.round(value.length / 1024)}KB]`;
    }
    return value;
  }
  if (Array.isArray(value)) return value.map(compactValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, compactValue(item)]));
  }
  return value;
}

function formatSize(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)}MB`;
}

async function compactDirectory(entity) {
  const dir = path.join(csvRoot, entity);
  let files = [];
  try {
    files = await readdir(dir);
  } catch {
    return [];
  }

  const results = [];
  for (const file of files.filter((name) => name.endsWith(".csv"))) {
    const filePath = path.join(dir, file);
    const before = (await stat(filePath)).size;
    const content = await readFile(filePath, "utf8");
    const records = parseCsvRecords(content);
    if (records.length === 0) continue;

    const paramsIndex = records[0].indexOf("params");
    if (paramsIndex < 0) continue;

    let changed = false;
    const nextRecords = records.map((row, index) => {
      if (index === 0) return row;
      const raw = row[paramsIndex];
      if (!raw) return row;
      try {
        const compacted = compactValue(JSON.parse(raw));
        const nextRaw = JSON.stringify(compacted);
        if (nextRaw !== raw) changed = true;
        return row.map((cell, cellIndex) => (cellIndex === paramsIndex ? nextRaw : cell));
      } catch {
        return row;
      }
    });

    if (!changed) continue;

    const backupPath = `${filePath}.bak-${timestamp}`;
    await copyFile(filePath, backupPath);
    await writeFile(filePath, `${nextRecords.map((row) => row.map(encodeCsvCell).join(",")).join("\n")}\n`, "utf8");
    const after = (await stat(filePath)).size;
    results.push({ filePath, backupPath, before, after });
  }
  return results;
}

const results = [
  ...(await compactDirectory("image_tasks")),
  ...(await compactDirectory("video_tasks")),
];

if (results.length === 0) {
  console.log("No CSV files required compaction.");
} else {
  for (const result of results) {
    console.log(`${result.filePath}`);
    console.log(`  backup: ${result.backupPath}`);
    console.log(`  size: ${formatSize(result.before)} -> ${formatSize(result.after)}`);
  }
}
