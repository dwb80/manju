import { DatabaseSync } from "node:sqlite";
import path from "node:path";

const db = new DatabaseSync(path.resolve("./data/sqlite.db"), { readOnly: true });

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
console.log("=== TABLES ===");
console.log(tables.map(r => r.name).join("\n"));

const tableNames = ["users", "projects", "project_members", "image_assets", "pipeline_runs", "pipeline_nodes", "quality_reports", "quality_auto_configs"];
for (const t of tableNames) {
  try {
    const count = db.prepare(`SELECT COUNT(*) as n FROM ${t}`).get();
    console.log(`\n=== ${t} (${count.n}) ===`);
    const sample = db.prepare(`SELECT * FROM ${t} LIMIT 3`).all();
    console.log(JSON.stringify(sample, null, 2));
  } catch (e) {
    console.log(`\n=== ${t} (N/A) ===`);
    console.log(e.message);
  }
}
