import { DatabaseSync } from "node:sqlite";
import { access, mkdir, stat } from "node:fs/promises";
import path from "node:path";

function option(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const source = path.resolve(option("--source") ?? process.env.DATABASE_FILE ?? "data/sqlite.db");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const output = path.resolve(option("--output") ?? path.join("data", "backup", `backup-${stamp}.sqlite`));

await access(source);
await mkdir(path.dirname(output), { recursive: true });

const sourceDb = new DatabaseSync(source);
try {
  const integrity = sourceDb.prepare("PRAGMA integrity_check").get();
  if (integrity.integrity_check !== "ok") throw new Error(`源数据库完整性校验失败: ${JSON.stringify(integrity)}`);
  sourceDb.exec("PRAGMA wal_checkpoint(FULL)");
  const escapedOutput = output.replaceAll("'", "''");
  sourceDb.exec(`VACUUM INTO '${escapedOutput}'`);
} finally {
  sourceDb.close();
}

const restoredDb = new DatabaseSync(output, { readOnly: true });
try {
  const integrity = restoredDb.prepare("PRAGMA integrity_check").get();
  if (integrity.integrity_check !== "ok") throw new Error(`备份数据库完整性校验失败: ${JSON.stringify(integrity)}`);
} finally {
  restoredDb.close();
}

const info = await stat(output);
console.log(JSON.stringify({ success: true, source, output, sizeBytes: info.size, integrity: "ok" }));
