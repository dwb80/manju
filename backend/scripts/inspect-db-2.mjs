import { DatabaseSync } from "node:sqlite";
import path from "node:path";

const db = new DatabaseSync(path.resolve("./data/sqlite.db"), { readOnly: true });

console.log("=== auth_users ===");
console.log(JSON.stringify(db.prepare("SELECT id, username, display_name, active FROM auth_users").all(), null, 2));

console.log("\n=== auth_memberships ===");
console.log(JSON.stringify(db.prepare("SELECT user_id, organization_id, role FROM auth_memberships").all(), null, 2));

console.log("\n=== image_tasks (count) ===");
console.log(db.prepare("SELECT COUNT(*) as n FROM image_tasks").get());

console.log("\n=== video_tasks (count) ===");
console.log(db.prepare("SELECT COUNT(*) as n FROM video_tasks").get());

console.log("\n=== compositions (count) ===");
console.log(db.prepare("SELECT COUNT(*) as n FROM compositions").get());

console.log("\n=== quality_auto_configs ===");
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='quality_auto_configs'").all();
console.log("table exists?", tables.length > 0);
if (tables.length > 0) {
  console.log(JSON.stringify(db.prepare("SELECT * FROM quality_auto_configs").all(), null, 2));
}

console.log("\n=== quality_reports ===");
console.log("count:", db.prepare("SELECT COUNT(*) as n FROM quality_reports").get().n);
