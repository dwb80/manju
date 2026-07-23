import sqlite from "node:sqlite";
const db = new sqlite.DatabaseSync("backend/data/sqlite.db");
const now = new Date().toISOString();
const runId = "run-test-" + Date.now();
const nodeId = "node-test-" + Date.now();
db.prepare("INSERT INTO pipeline_runs (id, project_id, name, status, created_at, updated_at) VALUES (?, ?, 'W5-test-run', 'pending', ?, ?)").run(runId, "p-171a35d8-0c63-40a3-8ece-d69e6ee39764", now, now);
db.prepare("INSERT INTO pipeline_nodes (id, run_id, project_id, type, name, status, created_at, updated_at) VALUES (?, ?, 'p-171a35d8-0c63-40a3-8ece-d69e6ee39764', 'script', 'test-node-1', 'pending', ?, ?)").run(nodeId, runId, now, now);
console.log("runId=" + runId);
console.log("nodeId=" + nodeId);
