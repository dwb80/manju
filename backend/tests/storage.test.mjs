import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { CsvRepository, encodeCsvCell, parseCsvLine, parseCsvRecords } from "../dist/src/storage/csv.js";

test("CSV cells escape quotes, new lines and injection prefixes", () => {
  const encoded = encodeCsvCell("=SUM(1,2)\n\"x\"");
  assert.equal(encoded, '"\'=SUM(1,2)\n""x"""');
  assert.deepEqual(parseCsvLine(encoded), ["'=SUM(1,2)\n\"x\""]);
  assert.deepEqual(parseCsvRecords(`a,b\n"1","hello\nworld"\n`), [["a", "b"], ["1", "hello\nworld"]]);
});

test("CsvRepository persists and updates daily records", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "agnes-csv-"));
  try {
    const repo = new CsvRepository(root, "things", [
      { key: "id", type: "string" },
      { key: "name", type: "string" },
      { key: "meta", type: "json" },
      { key: "created_at", type: "string" },
    ]);
    await repo.insert({ id: "a", name: "first", meta: { ok: true }, created_at: "2026-07-01T00:00:00.000Z" });
    await repo.update("a", { name: "second" });
    const found = await repo.findById("a");
    assert.equal(found.name, "second");
    assert.deepEqual(found.meta, { ok: true });
    const file = await readFile(path.join(root, "things", "things_2026-07-01.csv"), "utf8");
    assert.match(file, /id,name,meta,created_at/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("CsvRepository preserves multiline message fields", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "agnes-csv-multiline-"));
  try {
    const repo = new CsvRepository(root, "messages", [
      { key: "id", type: "string" },
      { key: "content", type: "string" },
      { key: "meta", type: "json" },
      { key: "created_at", type: "string" },
    ]);
    const content = "第一段\n\n1. 条目一\n2. 条目二\n\n```ts\nconsole.log(\"ok\")\n```";
    await repo.insert({ id: "m-1", content, meta: { ok: true }, created_at: "2026-07-01T00:00:00.000Z" });
    const found = await repo.findById("m-1");
    assert.equal(found.content, content);
    assert.deepEqual(found.meta, { ok: true });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("CsvRepository repairs legacy split message rows", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "agnes-csv-legacy-"));
  try {
    const dir = path.join(root, "messages");
    await mkdir(dir, { recursive: true });
    await writeFile(
      path.join(dir, "messages_2026-07-01.csv"),
      [
        "id,conversation_id,role,content,tokens,meta,created_at",
        '"m-1","c-1","assistant","开头","0","null",""',
        '"1. 第一条","","","","0","null",""',
        '"2. 第二条,42,{model:agnes-2.0-flash","tokens:42},2026-07-01T00:00:00.000Z","","","0","null",""',
        "",
      ].join("\n"),
      "utf8",
    );
    const repo = new CsvRepository(root, "messages", [
      { key: "id", type: "string" },
      { key: "conversation_id", type: "string" },
      { key: "role", type: "string" },
      { key: "content", type: "string" },
      { key: "tokens", type: "number" },
      { key: "meta", type: "json" },
      { key: "created_at", type: "string" },
    ]);
    const found = await repo.findMany({ conversation_id: "c-1" });
    assert.equal(found.length, 1);
    assert.equal(found[0].content, "开头\n1. 第一条\n2. 第二条");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
