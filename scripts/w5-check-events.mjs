import sqlite from "node:sqlite";
const db = new sqlite.DatabaseSync("backend/data/sqlite.db", { readOnly: true });
const events = db.prepare("SELECT id, run_id, node_id, type, payload, created_at FROM pipeline_events WHERE run_id = 'run-test-1784639536487' ORDER BY created_at ASC").all();
console.log(JSON.stringify(events, null, 2));
