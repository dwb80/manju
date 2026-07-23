import { DatabaseSync } from "node:sqlite";
import path from "node:path";

const db = new DatabaseSync(path.resolve("./data/sqlite.db"), { readOnly: true });
const row = db.prepare("SELECT id FROM image_tasks WHERE status='succeeded' OR status='success' OR status='completed' ORDER BY created_at DESC LIMIT 1").get();
if (row) {
  console.log(row.id);
} else {
  const anyRow = db.prepare("SELECT id, status FROM image_tasks ORDER BY created_at DESC LIMIT 1").get();
  if (anyRow) {
    console.error("No succeeded image, using latest:", JSON.stringify(anyRow));
    console.log(anyRow.id);
  } else {
    console.error("No image_tasks at all");
    process.exit(1);
  }
}
