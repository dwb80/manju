import sqlite from "node:sqlite";
const db = new sqlite.DatabaseSync("backend/data/sqlite.db");
const result1 = db.prepare("DELETE FROM pipeline_events WHERE run_id LIKE 'run-test%'").run();
const result2 = db.prepare("DELETE FROM pipeline_nodes WHERE run_id LIKE 'run-test%'").run();
const result3 = db.prepare("DELETE FROM pipeline_runs WHERE id LIKE 'run-test%'").run();
console.log("清理完成:");
console.log("  events:", result1.changes);
console.log("  nodes:", result2.changes);
console.log("  runs:", result3.changes);
