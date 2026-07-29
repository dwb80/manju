import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const openapiPath = path.join(root, "docs", "implementation", "02-openapi", "openapi.json");
const matrixPath = path.join(root, "docs", "implementation", "05-testing", "test-matrix.json");
const schemaPath = path.join(root, "docs", "implementation", "03-database", "target-schema.sql");
const prototypePath = path.join(root, "docs", "implementation", "04-prototypes", "index.html");
const environmentSchemaPath = path.join(root, "docs", "implementation", "07-operations", "environment.schema.json");
const failures = [];

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); }
  catch (error) { failures.push(`${path.relative(root, file)} is not valid JSON: ${error.message}`); return {}; }
}

function resolveRef(document, ref) {
  if (!ref.startsWith("#/")) return undefined;
  return ref.slice(2).split("/").reduce((value, key) => value?.[key.replace(/~1/g, "/").replace(/~0/g, "~")], document);
}

function walk(value, visitor) {
  if (!value || typeof value !== "object") return;
  visitor(value);
  for (const child of Object.values(value)) walk(child, visitor);
}

const api = readJson(openapiPath);
const matrix = readJson(matrixPath);

assert(api.openapi === "3.1.0", "OpenAPI version must be 3.1.0");
assert(api.info?.version === "1.0.0-design", "OpenAPI design version missing");
assert(api.components?.schemas?.ErrorEnvelope, "ErrorEnvelope missing");
assert(api.components?.schemas?.DataEnvelope, "DataEnvelope missing");

const operations = [];
for (const [apiPath, methods] of Object.entries(api.paths ?? {})) {
  assert(apiPath.startsWith("/api/v1/"), `non-v1 path: ${apiPath}`);
  assert(!apiPath.includes("?}"), `optional path parameter is invalid: ${apiPath}`);
  for (const [method, operation] of Object.entries(methods)) {
    if (!/^(get|post|put|patch|delete)$/.test(method)) continue;
    operations.push({ apiPath, method, operation });
    assert(operation.operationId, `${method.toUpperCase()} ${apiPath} missing operationId`);
    assert(operation["x-feature-id"], `${operation.operationId} missing x-feature-id`);
    assert(operation.responses?.["400"] && operation.responses?.["401"] && operation.responses?.["403"] && operation.responses?.["409"], `${operation.operationId} missing standard error responses`);
    if (["post", "put", "patch"].includes(method)) assert(operation.requestBody, `${operation.operationId} missing requestBody`);
    const declaredBodySchema = operation.requestBody?.content?.["application/json"]?.schema;
    const bodySchema = declaredBodySchema?.$ref ? resolveRef(api, declaredBodySchema.$ref) : declaredBodySchema;
    if (bodySchema) {
      assert(!bodySchema.allOf?.some((item) => item.$ref === "#/components/schemas/CommandMeta"), `${operation.operationId} uses a fallback request schema`);
      assert(bodySchema.additionalProperties === false, `${operation.operationId} request body must reject undeclared top-level fields`);
      assert(Object.keys(bodySchema.properties ?? {}).length > 0, `${operation.operationId} request body has no declared fields`);
    }
    for (const parameter of operation.parameters ?? []) {
      if (parameter.in === "path") assert(parameter.required === true, `${operation.operationId} path parameter ${parameter.name} must be required`);
    }
  }
}

const environmentSchema = readJson(environmentSchemaPath);
assert(environmentSchema.$schema === "https://json-schema.org/draft/2020-12/schema", "environment schema must use JSON Schema 2020-12");
for (const name of ["NODE_ENV", "DATABASE_PATH", "AUTH_JWT_SECRET", "DATA_ENCRYPTION_KEY", "CORS_ALLOWED_ORIGINS"]) {
  assert(environmentSchema.required?.includes(name), `environment schema missing required ${name}`);
}
const sourceRoots = [path.join(root, "backend"), path.join(root, "frontend")];
const sourceFiles = [];
function collectSourceFiles(directory) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && !["node_modules", "dist", ".next"].includes(entry.name)) collectSourceFiles(path.join(directory, entry.name));
    else if (entry.isFile() && /\.(?:ts|tsx|js|mjs)$/.test(entry.name)) sourceFiles.push(path.join(directory, entry.name));
  }
}
for (const sourceRoot of sourceRoots) collectSourceFiles(sourceRoot);
const usedEnvironmentNames = new Set();
for (const sourceFile of sourceFiles) {
  const source = fs.readFileSync(sourceFile, "utf8");
  for (const match of source.matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)) usedEnvironmentNames.add(match[1]);
  for (const match of source.matchAll(/process\.env\[['"]([A-Z][A-Z0-9_]*)['"]\]/g)) usedEnvironmentNames.add(match[1]);
}
const passThroughNames = new Set(environmentSchema["x-runtime-pass-through"] ?? []);
const passThroughPrefixes = environmentSchema["x-runtime-pass-through-prefixes"] ?? [];
for (const name of usedEnvironmentNames) {
  const documented = environmentSchema.properties?.[name] || passThroughNames.has(name) || passThroughPrefixes.some((prefix) => name.startsWith(prefix));
  assert(documented, `runtime environment variable is not documented: ${name}`);
}

const operationIds = operations.map(({ operation }) => operation.operationId);
assert(new Set(operationIds).size === operationIds.length, "duplicate operationId found");
assert(operations.length >= 180, `expected at least 180 target operations, got ${operations.length}`);
assert(api.components?.schemas?.Timeline?.additionalProperties === false, "Timeline schema must reject undeclared fields");
assert(api.components?.schemas?.VideoClip?.additionalProperties === false, "VideoClip schema must reject undeclared fields");
assert(api.components?.schemas?.AudioClip?.additionalProperties === false, "AudioClip schema must reject undeclared fields");
assert(api.components?.schemas?.TimelineSubtitleCue?.additionalProperties === false, "TimelineSubtitleCue schema must reject undeclared fields");

walk(api, (value) => {
  if (typeof value.$ref === "string" && value.$ref.startsWith("#/")) {
    assert(resolveRef(api, value.$ref) !== undefined, `unresolved OpenAPI ref: ${value.$ref}`);
  }
});

const features = matrix.features ?? [];
assert(features.length === 52, `expected 52 features, got ${features.length}`);
const featureIds = features.map((feature) => feature.id);
assert(new Set(featureIds).size === featureIds.length, "duplicate feature ID in test matrix");
const scenarios = features.flatMap((feature) => feature.scenarios ?? []);
assert(scenarios.length >= 109, `expected at least 109 scenarios, got ${scenarios.length}`);
assert(new Set(scenarios.map((scenario) => scenario.id)).size === scenarios.length, "duplicate scenario ID in test matrix");

const expectedProfessionalRequirementIds = [
  "OPS-001", "OPS-002", "OPS-003",
  "SHOT-001", "SHOT-002",
  "CAND-001", "CAND-002", "CAND-003",
  "CONT-001", "CONT-002",
  "REV-001", "REV-002", "REV-003",
  "EDIT-001", "EDIT-002", "EDIT-003",
  "COLLAB-001", "COLLAB-002", "COLLAB-003",
];
const expectedNonFunctionalRequirementIds = [
  "NFR-QUAL-001", "NFR-QUAL-002", "NFR-AUDIO-001", "NFR-TIMELINE-001",
  "NFR-DELIVERY-001", "NFR-SCALE-001", "NFR-RECOVERY-001", "NFR-MIGRATION-001",
  "NFR-SEC-001", "NFR-OPS-001", "NFR-A11Y-001", "NFR-PRIV-001",
];
const expectedRequirementIds = [...expectedProfessionalRequirementIds, ...expectedNonFunctionalRequirementIds];
const tracedRequirementIds = new Set(features.flatMap((feature) => feature.requirementIds ?? []));
for (const requirementId of expectedRequirementIds) {
  assert(tracedRequirementIds.has(requirementId), `requirement is not traced: ${requirementId}`);
}

for (const feature of features) {
  assert(fs.existsSync(path.join(root, feature.source)), `${feature.id} source missing: ${feature.source}`);
  assert(fs.existsSync(path.join(root, feature.featureFile)), `${feature.id} acceptance feature missing: ${feature.featureFile}`);
  assert(feature.operationIds?.length > 0, `${feature.id} has no OpenAPI operation`);
  for (const requirementId of feature.requirementIds ?? []) assert(expectedRequirementIds.includes(requirementId), `${feature.id} has unknown requirement ${requirementId}`);
  for (const operationId of feature.operationIds ?? []) assert(operationIds.includes(operationId), `${feature.id} references missing operationId ${operationId}`);
  assert(feature.implementationEvidence?.status === "unverified", `${feature.id} must remain unverified before implementation`);
  assert(feature.requiredTestLayers?.includes("contract"), `${feature.id} missing contract test layer`);
  for (const scenario of feature.scenarios ?? []) {
    assert((scenario.steps ?? []).some((step) => step.startsWith("Given ")), `${scenario.id} missing Given step`);
    assert((scenario.steps ?? []).some((step) => step.startsWith("When ")), `${scenario.id} missing When step`);
    assert((scenario.steps ?? []).some((step) => step.startsWith("Then ")), `${scenario.id} missing Then step`);
  }
}

if (fs.existsSync(schemaPath)) {
  const sql = fs.readFileSync(schemaPath, "utf8");
  for (const table of ["schema_migrations", "shot_visual_layers", "shot_text_overlays", "shot_comic_effects", "shot_motion_cues", "presentation_snapshots", "typed_settings", "audit_records", "budget_reservations", "quality_rule_set_versions", "outbox_events"]) {
    assert(new RegExp(`CREATE TABLE(?: IF NOT EXISTS)? ${table}\\b`, "i").test(sql), `target schema missing table ${table}`);
  }
  assert(/PRAGMA foreign_keys\s*=\s*ON/i.test(sql), "target schema must enable foreign keys");
  try {
    const { DatabaseSync } = await import("node:sqlite");
    const db = new DatabaseSync(":memory:");
    db.exec(sql);
    const quickCheck = db.prepare("PRAGMA quick_check").get();
    assert(quickCheck?.quick_check === "ok", `SQLite quick_check failed: ${JSON.stringify(quickCheck)}`);
    const foreignKeyProblems = db.prepare("PRAGMA foreign_key_check").all();
    assert(foreignKeyProblems.length === 0, `SQLite foreign_key_check returned ${foreignKeyProblems.length} issue(s)`);
    const tableCount = db.prepare("SELECT count(*) AS count FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").get()?.count ?? 0;
    assert(tableCount >= 60, `target schema expected at least 60 tables, got ${tableCount}`);
    db.close();
  } catch (error) {
    failures.push(`target schema cannot execute in SQLite: ${error.message}`);
  }
}

if (fs.existsSync(prototypePath)) {
  const html = fs.readFileSync(prototypePath, "utf8");
  for (const state of ["loading", "empty", "ready", "forbidden", "conflict", "error"]) assert(html.includes(`data-state=\"${state}\"`) || html.includes(`\"${state}\"`), `prototype missing state ${state}`);
}

if (failures.length) {
  console.error(`Implementation readiness check failed (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`PASS implementation readiness: ${features.length} features, ${operations.length} operations, ${scenarios.length} scenarios.`);
