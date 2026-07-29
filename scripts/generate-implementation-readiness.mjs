import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const deliveryDir = path.join(root, "docs", "delivery-specs");
const outputDir = path.join(root, "docs", "implementation");
const apiOutput = path.join(outputDir, "02-openapi", "openapi.json");
const matrixOutput = path.join(outputDir, "05-testing", "test-matrix.json");
const acceptanceOutput = path.join(root, "tests", "acceptance", "features");

const specFiles = fs.readdirSync(deliveryDir)
  .filter((name) => /^0[1-9]-.*\.md$/.test(name))
  .sort();

const featurePattern = /^(US-(?:\d{3}|PM-001|DS-001)|MANGA-\d{3}|CAP-\d{3})\b/;
const features = [];

// 专业工作台需求复用现有交付功能，但必须保留直接、机器可读的需求追溯。
// 一个专项需求可以由多个 feature 协同实现；检查器会验证 19 个 ID 均至少被引用一次。
const requirementIdsByFeature = new Map(Object.entries({
  "US-DS-001": ["OPS-001", "OPS-002"],
  "US-018": ["OPS-003", "COLLAB-003"],
  "MANGA-002": ["SHOT-001"],
  "MANGA-006": ["SHOT-002"],
  "US-009": ["CAND-001"],
  "US-011": ["CAND-001", "CAND-002", "CAND-003"],
  "MANGA-008": ["CAND-002"],
  "MANGA-007": ["CONT-001", "CONT-002"],
  "CAP-008": ["CONT-001", "CONT-002"],
  "US-010": ["REV-001", "REV-002"],
  "US-012": ["REV-001", "REV-002", "REV-003"],
  "US-016": ["REV-001", "REV-003"],
  "US-015": ["EDIT-001", "EDIT-002", "EDIT-003"],
  "US-021": ["EDIT-001"],
  "CAP-001": ["COLLAB-001", "COLLAB-002", "COLLAB-003"],
  "CAP-009": ["OPS-002"],
  "CAP-010": ["COLLAB-001", "COLLAB-002", "COLLAB-003"],
}));

const nonFunctionalRequirementIdsByFeature = new Map(Object.entries({
  "MANGA-007": ["NFR-QUAL-001", "NFR-QUAL-002"],
  "CAP-008": ["NFR-QUAL-001", "NFR-QUAL-002"],
  "US-013": ["NFR-AUDIO-001"],
  "US-032": ["NFR-AUDIO-001", "NFR-SEC-001"],
  "US-015": ["NFR-TIMELINE-001", "NFR-DELIVERY-001"],
  "US-017": ["NFR-DELIVERY-001"],
  "MANGA-008": ["NFR-DELIVERY-001"],
  "US-DS-001": ["NFR-SCALE-001"],
  "US-029": ["NFR-RECOVERY-001", "NFR-PRIV-001"],
  "US-028": ["NFR-MIGRATION-001", "NFR-SEC-001"],
  "US-023": ["NFR-SEC-001"],
  "US-027": ["NFR-SEC-001"],
  "CAP-006": ["NFR-OPS-001"],
  "US-025": ["NFR-PRIV-001"],
  "CAP-001": ["NFR-A11Y-001"],
  "CAP-009": ["NFR-DELIVERY-001"],
  "CAP-010": ["NFR-A11Y-001", "NFR-SEC-001"],
}));

const testLayersByRequirement = new Map(Object.entries({
  "NFR-QUAL-002": ["quality-regression"],
  "NFR-AUDIO-001": ["security"],
  "NFR-DELIVERY-001": ["evidence-audit"],
  "NFR-SCALE-001": ["performance"],
  "NFR-RECOVERY-001": ["recovery-drill"],
  "NFR-MIGRATION-001": ["migration"],
  "NFR-SEC-001": ["security"],
  "NFR-OPS-001": ["operation-drill"],
  "NFR-A11Y-001": ["accessibility"],
  "NFR-PRIV-001": ["security", "recovery-drill"],
}));

function splitBlocks(text) {
  const matches = [...text.matchAll(/^## (.+)$/gm)];
  return matches.map((match, index) => ({
    heading: match[1].trim(),
    body: text.slice(match.index + match[0].length, matches[index + 1]?.index ?? text.length),
  }));
}

function section(body, heading) {
  const marker = `### ${heading}`;
  const start = body.indexOf(marker);
  if (start < 0) return "";
  const rest = body.slice(start + marker.length);
  const end = rest.search(/^### /m);
  return end < 0 ? rest : rest.slice(0, end);
}

function tableRows(markdown) {
  return markdown.split(/\r?\n/)
    .filter((line) => /^\|.*\|$/.test(line.trim()))
    .map((line) => line.trim().slice(1, -1).split("|").map((cell) => cell.trim()))
    .filter((cells) => cells.length >= 3 && !cells.every((cell) => /^:?-+:?$/.test(cell)) && cells[0] !== "方法与路径");
}

function slug(value) {
  return value
    .replace(/[{}?]/g, "")
    .replace(/:([a-z])/gi, "-$1")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function normalizePath(value) {
  return value.replace(/\{([^}]+)\?\}/g, "{$1}");
}

function inferSchema(name, note = "") {
  const lower = name.toLowerCase();
  if (/^(is|has|include|create|sync|revoke)/.test(lower) || /enabled|partial/.test(lower)) return { type: "boolean" };
  if (/ids$|items$|refs$|roles$|tags$|nodes$|edges$|rules$|cues$|shots$|operations$|resolutions$|dimensions$|tracks$|clips$|variables$|blockers$|warnings$/.test(lower)) return { type: "array", items: { type: "object", additionalProperties: true } };
  if (/version|count|number|seconds|hours|width|height|fps|priority|attempt|duration|size|limit|threshold|cap|amount|cost|ms$/.test(lower)) return { type: "number" };
  if (/at$|date|time|expires|deadline|window/.test(lower)) return { type: "string", format: "date-time" };
  if (/email/.test(lower)) return { type: "string", format: "email" };
  if (/id$|ref$/.test(lower)) return { type: "string", minLength: 1 };
  if (/json|spec|profile|policy|metadata|properties|schema|content|body|timeline|mapping|scope|target|source|prompt|parameters|transform|typography|box|tail|mask|from|to|easing|driver/.test(lower)) return { type: "object", additionalProperties: true };
  const schema = { type: "string" };
  if (note.includes(`${name} 为 `)) schema.description = note;
  return schema;
}

const fallbackRequestFields = new Map(Object.entries({
  "/api/v1/episodes/{id}/deletion-precheck": "commandId",
  "/api/v1/projects/{id}/presentation-spec-impact": "commandId,spec",
  "/api/v1/shots/{id}/visual-layers/{layerId}": "commandId,type,assetVersionId?,zIndex,opacity,blendMode,transform,mask?,expectedVersion",
  "/api/v1/shots/{id}/text-overlays/{overlayId}": "commandId,text,language,typography,box,tail?,zIndex,expectedVersion",
  "/api/v1/shots/{id}/text-layout-precheck": "commandId,overlayIds[],presentationSnapshotId",
  "/api/v1/shots/{id}/comic-effects/{effectId}": "commandId,effectType,intensity,position,style,seed?,expectedVersion",
  "/api/v1/shots/{id}/effect-safety-precheck": "commandId,effectIds[],presentationSnapshotId",
  "/api/v1/shots/{id}/motion-cues/{cueId}": "commandId,driver,from,to,durationMs,easing,expectedVersion",
  "/api/v1/qc-reports/{id}/retry": "commandId,reason,expectedVersion",
  "/api/v1/characters/{id}": "commandId,name,description,appearance,personality,voiceProfile?,tags[],expectedVersion",
  "/api/v1/characters/{id}/images": "commandId,assetVersionId,viewType,shotType?,angle?,expression?",
  "/api/v1/characters/{id}/archive": "commandId,reason,expectedVersion",
  "/api/v1/scenes/{id}": "commandId,name,description,environment,lighting,mood,tags[],expectedVersion",
  "/api/v1/props/{id}": "commandId,name,description,appearance,usage,tags[],expectedVersion",
  "/api/v1/scenes/{id}/publish": "commandId,changeNote?,expectedVersion",
  "/api/v1/props/{id}/publish": "commandId,changeNote?,expectedVersion",
  "/api/v1/assets/batch": "commandId,assetIds[],operation,tags[],reason?,expectedVersions",
  "/api/v1/generated-videos/{id}/adopt": "commandId,shotId,presentationSnapshotId,expectedVersion",
  "/api/v1/subtitle-documents/{id}/imports": "commandId,uploadId,format,offsetMs?,language?",
  "/api/v1/subtitle-documents/{id}/publish": "commandId,changeNote?,expectedVersion",
  "/api/v1/edit-projects/{id}/render-precheck": "commandId,inputHash,renderProfileId",
  "/api/v1/publish-plans/{id}/precheck": "commandId,adapterVersion,expectedVersion",
  "/api/v1/publish-records/{id}/reconcile": "commandId,externalId?,expectedVersion",
  "/api/v1/edit-projects/{id}/clips/{clipId}": "commandId,trackId,assetVersionId,inMs,outMs,startMs,transform?,volume?,expectedVersion",
  "/api/v1/work-items/{id}": "commandId,title,description?,assigneeId?,priority,status,dueAt?,expectedVersion",
  "/api/v1/work-items/{id}/links": "commandId,targetType,targetId",
  "/api/v1/notifications/{id}/archive": "commandId,expectedVersion?",
  "/api/v1/notification-preferences": "commandId,categories,quietHours?,timezone,expectedVersion",
  "/api/v1/prompt-templates/{id}/draft": "commandId,name,content,variables[],changeNote,expectedVersion",
  "/api/v1/projects/{id}/members/{userId}": "commandId,role,allow[],deny[],expectedVersion",
  "/api/v1/model-configs/{id}": "commandId,provider,model,endpoint?,capabilities[],parameters,secretRef?,expectedVersion",
  "/api/v1/model-configs/{id}/connection-tests": "commandId,testPrompt?,timeoutMs?",
  "/api/v1/model-configs/{id}/activate": "commandId,scenes[],expectedVersion",
  "/api/v1/pipeline-templates/{id}/draft": "commandId,name,nodes[],edges[],variables[],changeNote,expectedVersion",
  "/api/v1/pipeline-templates/{id}/validate": "commandId,draftVersion",
  "/api/v1/pipeline-templates/{id}/publish": "commandId,changeNote,expectedVersion",
  "/api/v1/datasets/{id}/imports": "commandId,uploadId,mapping,schemaVersion",
  "/api/v1/datasets/{id}/versions/{v}/publish": "commandId,qualityDigest,changeNote?",
  "/api/v1/dataset-exports": "commandId,datasetId,version,format",
  "/api/v1/messages/{id}/stop": "commandId,reason?",
  "/api/v1/messages/{id}/regenerations": "commandId,modelPolicyId?,instructions?",
  "/api/v1/projects/{id}/budget/reconciliation-runs": "commandId,from?,to?,reason",
  "/api/v1/quality-rule-sets/{id}/draft": "commandId,name,rules[],changeNote,expectedVersion",
  "/api/v1/quality-rule-sets/{id}/sample-runs": "commandId,sampleRefs[],draftVersion",
  "/api/v1/quality-rule-sets/{id}/publish": "commandId,changeNote,expectedVersion",
  "/api/v1/projects/{id}/quality-policy": "commandId,ruleSetId,version,overrides?,expectedVersion"
}));

function schemaFromFieldList(fieldList, note) {
  const properties = {};
  const required = [];
  for (const token of fieldList.split(",")) {
    const raw = token.trim();
    if (!raw) continue;
    const optional = raw.endsWith("?");
    const array = raw.replace(/\?$/, "").endsWith("[]");
    const key = raw.replace(/\?$/, "").replace(/\[\]$/, "");
    properties[key] = array
      ? { type: "array", items: /Ids$|Refs$|roles$|tags$|scenes$|capabilities$|variables$|overlayIds$|effectIds$|assetIds$|allow$|deny$/i.test(key) ? { type: "string", minLength: 1 } : { type: "object", additionalProperties: true } }
      : inferSchema(key, note);
    if (!optional) required.push(key);
  }
  return { type: "object", additionalProperties: false, properties, required, description: note };
}

function requestSchema(note, method, apiPath) {
  if (method === "put" && apiPath === "/api/v1/edit-projects/{id}/timeline") {
    return { $ref: "#/components/schemas/TimelineUpdateRequest" };
  }
  const codeObjects = [...note.matchAll(/`(\{[^`]+\})`/g)];
  const firstObject = codeObjects[0];
  const prefix = firstObject ? note.slice(0, firstObject.index) : "";
  const source = /返回|响应/.test(prefix) ? undefined : firstObject?.[1];
  if (!source) {
    if (["post", "put", "patch"].includes(method)) {
      const fields = fallbackRequestFields.get(apiPath);
      if (!fields) throw new Error(`No explicit request schema for ${method.toUpperCase()} ${apiPath}: ${note}`);
      return schemaFromFieldList(fields, note);
    }
    return null;
  }
  const inner = source.slice(1, -1);
  const tokens = [];
  let current = "";
  let depth = 0;
  for (const char of inner) {
    if ("[{(".includes(char)) depth++;
    if ("]})".includes(char)) depth--;
    if (char === "," && depth === 0) { tokens.push(current); current = ""; }
    else current += char;
  }
  if (current) tokens.push(current);
  const properties = {};
  const required = [];
  for (const raw of tokens) {
    const part = raw.trim();
    if (!part) continue;
    const rawKey = part.split(":", 1)[0].trim().replace(/["']/g, "");
    const optional = rawKey.endsWith("?");
    const array = rawKey.replace(/\?$/, "").endsWith("[]");
    const key = rawKey.replace(/\?$/, "").replace(/\[\]$/, "");
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(key)) continue;
    properties[key] = array
      ? { type: "array", items: /Ids$|Refs$|roles$|tags$/i.test(key) ? { type: "string", minLength: 1 } : { type: "object", additionalProperties: true } }
      : inferSchema(key, note);
    if (!optional) required.push(key);
  }
  if (["post", "put", "patch"].includes(method) && !properties.commandId && /commandId/.test(note)) {
    properties.commandId = { type: "string", format: "uuid" };
    required.unshift("commandId");
  }
  return { type: "object", additionalProperties: false, properties, ...(required.length ? { required: [...new Set(required)] } : {}), description: note };
}

function successStatus(method, apiPath, requestNote) {
  const explicit = requestNote.match(/(?:^|[^0-9])(200|201|202|204)(?:[^0-9]|$)/)?.[1];
  if (explicit) return explicit;
  if (method === "delete") return "204";
  if (method !== "post") return "200";
  if (/\/(?:precheck|validate|apply|publish|adopt|retry|reconcile|stop|activate|archive)$/.test(apiPath)) return "200";
  if (/\/(?:jobs|runs|tests)$/.test(apiPath)) return "202";
  return "201";
}

function extractOperations(apiSection, feature) {
  const operations = [];
  for (const [endpointCell, requestNote = "", constraintNote = ""] of tableRows(apiSection)) {
    const codeSpans = [...endpointCell.matchAll(/`([^`]*\/api\/v1\/[^`]*)`/g)].map((m) => m[1]);
    for (const span of codeSpans) {
      const match = span.match(/^(GET|POST|PUT|PATCH|DELETE)(?:\/(GET|POST|PUT|PATCH|DELETE))*\s+(\/api\/v1\/.*)$/i);
      if (!match) continue;
      const methodPart = span.slice(0, span.indexOf(" "));
      const apiPath = normalizePath(span.slice(span.indexOf(" ") + 1).trim());
      for (const methodName of methodPart.split("/")) {
        const method = methodName.toLowerCase();
        if (!/^(get|post|put|patch|delete)$/.test(method)) continue;
        operations.push({ method, path: apiPath, requestNote, constraintNote, feature });
      }
    }
  }
  return operations;
}

for (const file of specFiles) {
  const text = fs.readFileSync(path.join(deliveryDir, file), "utf8");
  for (const block of splitBlocks(text)) {
    const match = block.heading.match(featurePattern);
    if (!match) continue;
    const id = match[1];
    const title = block.heading.slice(id.length).trim();
    const apiSection = section(block.body, "API 契约");
    const dataSection = section(block.body, "数据模型");
    const pageSection = section(block.body, "页面交互规格");
    const acceptance = section(block.body, "可执行验收用例");
    const scenarios = [...acceptance.matchAll(/Scenario:\s+([A-Z0-9-]+)\s+([^\r\n]+)([\s\S]*?)(?=\nScenario:|\n```|$)/g)].map((m) => ({
      id: m[1],
      title: m[2].trim(),
      steps: m[3].split(/\r?\n/).map((line) => line.trim()).filter((line) => /^(Given|When|Then|And|But)\s+/.test(line)),
    }));
    const pages = [...pageSection.matchAll(/`(\/[^`]+)`/g)].map((m) => m[1]).filter((v) => !v.startsWith("/api/"));
    const tables = [...dataSection.matchAll(/`([a-z][a-z0-9_]+)(?:\([^`]+\))?`/g)].map((m) => m[1]).filter((v) => v.includes("_") || /^[a-z]+s$/.test(v));
    const feature = {
      id,
      title,
      file,
      scenarios,
      pages: [...new Set(pages)],
      tables: [...new Set(tables)],
      requirementIds: [
        ...(requirementIdsByFeature.get(id) ?? []),
        ...(nonFunctionalRequirementIdsByFeature.get(id) ?? []),
      ],
    };
    feature.operations = extractOperations(apiSection, feature);
    features.push(feature);
  }
}

const paths = {};
const operationIds = new Set();
for (const feature of features) {
  feature.operationIds = [];
  for (const op of feature.operations) {
    paths[op.path] ??= {};
    const existingOperation = paths[op.path][op.method];
    if (existingOperation) {
      existingOperation["x-feature-ids"] = [...new Set([...(existingOperation["x-feature-ids"] ?? [existingOperation["x-feature-id"]]), feature.id])];
      existingOperation["x-sources"] = [...new Set([...(existingOperation["x-sources"] ?? [existingOperation["x-source"]]), `docs/delivery-specs/${feature.file}`])];
      feature.operationIds.push(existingOperation.operationId);
      continue;
    }
    let operationId = `${feature.id.toLowerCase().replace(/-/g, "_")}_${op.method}_${slug(op.path.replace(/^\/api\/v1\//, ""))}`;
    let suffix = 2;
    while (operationIds.has(operationId)) operationId = `${operationId}_${suffix++}`;
    operationIds.add(operationId);
    feature.operationIds.push(operationId);
    const pathParameters = [...op.path.matchAll(/\{([^}]+)\}/g)].map((m) => ({ name: m[1], in: "path", required: true, schema: { type: "string", minLength: 1 } }));
    const isWrite = ["post", "put", "patch", "delete"].includes(op.method);
    const schema = requestSchema(op.requestNote, op.method, op.path);
    const successCode = successStatus(op.method, op.path, op.requestNote);
    paths[op.path][op.method] = {
      operationId,
      tags: [feature.id],
      summary: `${feature.id} ${feature.title}`,
      description: `${op.requestNote}\n\n约束：${op.constraintNote}`.trim(),
      "x-feature-id": feature.id,
      "x-feature-ids": [feature.id],
      "x-requirement-ids": feature.requirementIds,
      "x-source": `docs/delivery-specs/${feature.file}`,
      "x-sources": [`docs/delivery-specs/${feature.file}`],
      "x-idempotency-required": isWrite && /幂等|commandId|Idempotency/i.test(`${op.requestNote} ${op.constraintNote}`),
      "x-optimistic-concurrency": /If-Match/.test(op.constraintNote),
      security: [{ sessionCookie: [] }],
      parameters: [
        ...pathParameters,
        ...(isWrite && /If-Match/.test(op.constraintNote) ? [{ name: "If-Match", in: "header", required: true, schema: { type: "string" } }] : []),
        ...(isWrite && /幂等/.test(op.constraintNote) ? [{ name: "Idempotency-Key", in: "header", required: true, schema: { type: "string", minLength: 8, maxLength: 128 } }] : []),
        { name: "X-Correlation-Id", in: "header", required: false, schema: { type: "string", format: "uuid" } },
      ],
      ...(schema && isWrite ? { requestBody: { required: op.method !== "delete", content: { "application/json": { schema } } } } : {}),
      responses: {
        [successCode]: successCode === "204"
          ? { description: "删除/归档命令已接受或完成" }
          : { description: "成功", content: { "application/json": { schema: { $ref: "#/components/schemas/DataEnvelope" } } } },
        "400": { $ref: "#/components/responses/BadRequest" },
        "401": { $ref: "#/components/responses/Unauthenticated" },
        "403": { $ref: "#/components/responses/Forbidden" },
        "404": { $ref: "#/components/responses/NotFound" },
        "409": { $ref: "#/components/responses/Conflict" },
        "429": { $ref: "#/components/responses/RateLimited" },
        "500": { $ref: "#/components/responses/InternalError" },
      },
    };
  }
}

const errorResponse = (description) => ({ description, content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } } });
const timelineComponentSchemas = {
  NormalizedPoint: {
    type: "object", additionalProperties: false, required: ["x", "y"],
    properties: { x: { type: "number", minimum: 0, maximum: 1 }, y: { type: "number", minimum: 0, maximum: 1 } },
  },
  Timebase: {
    type: "object", additionalProperties: false, required: ["fpsNumerator", "fpsDenominator", "dropFrame"],
    properties: { fpsNumerator: { type: "integer", minimum: 1 }, fpsDenominator: { type: "integer", minimum: 1 }, dropFrame: { type: "boolean" } },
  },
  EffectInstance: {
    type: "object", additionalProperties: false,
    required: ["id", "effectType", "implementationId", "implementationVersion", "enabled", "parameters", "parameterSchemaVersion"],
    properties: {
      id: { type: "string", minLength: 1 }, effectType: { type: "string", minLength: 1 }, implementationId: { type: "string", minLength: 1 },
      implementationVersion: { type: "string", minLength: 1 }, enabled: { type: "boolean" }, parameters: { type: "object", additionalProperties: true },
      parameterSchemaVersion: { type: "integer", minimum: 1 },
    },
  },
  ClipTransform: {
    type: "object", additionalProperties: false, required: ["position", "scale", "rotationDegrees", "anchor", "crop"],
    properties: {
      position: { $ref: "#/components/schemas/NormalizedPoint" }, anchor: { $ref: "#/components/schemas/NormalizedPoint" }, rotationDegrees: { type: "number" },
      scale: { type: "object", additionalProperties: false, required: ["x", "y"], properties: { x: { type: "number", exclusiveMinimum: 0 }, y: { type: "number", exclusiveMinimum: 0 } } },
      crop: { type: "object", additionalProperties: false, required: ["top", "right", "bottom", "left"], properties: {
        top: { type: "number", minimum: 0, maximum: 1 }, right: { type: "number", minimum: 0, maximum: 1 }, bottom: { type: "number", minimum: 0, maximum: 1 }, left: { type: "number", minimum: 0, maximum: 1 },
      } },
    },
  },
  VideoClip: {
    type: "object", additionalProperties: false,
    required: ["id", "trackId", "sourceType", "sourceId", "sourceVersion", "sourceContentHash", "sourceInMs", "sourceOutMs", "timelineStartMs", "playbackRate", "opacity", "transform", "effects", "sortKey"],
    properties: {
      id: { type: "string", minLength: 1 }, trackId: { type: "string", minLength: 1 }, sourceType: { enum: ["shot_video", "uploaded_video", "rendered_video"] },
      sourceId: { type: "string", minLength: 1 }, sourceVersion: { type: "integer", minimum: 1 }, sourceContentHash: { type: "string", minLength: 1 }, presentationSnapshotId: { type: ["string", "null"] },
      sourceInMs: { type: "integer", minimum: 0 }, sourceOutMs: { type: "integer", minimum: 1 }, timelineStartMs: { type: "integer", minimum: 0 }, playbackRate: { type: "number", exclusiveMinimum: 0 },
      opacity: { type: "number", minimum: 0, maximum: 1 }, transform: { $ref: "#/components/schemas/ClipTransform" }, effects: { type: "array", items: { $ref: "#/components/schemas/EffectInstance" } }, sortKey: { type: "string" },
    },
  },
  AudioClip: {
    type: "object", additionalProperties: false,
    required: ["id", "trackId", "audioAssetId", "sourceVersion", "sourceContentHash", "sourceInMs", "sourceOutMs", "timelineStartMs", "playbackRate", "gainDb", "pan", "fadeInMs", "fadeOutMs", "channelMapping", "effects"],
    properties: {
      id: { type: "string", minLength: 1 }, trackId: { type: "string", minLength: 1 }, audioAssetId: { type: "string", minLength: 1 }, sourceVersion: { type: "integer", minimum: 1 }, sourceContentHash: { type: "string", minLength: 1 },
      sourceInMs: { type: "integer", minimum: 0 }, sourceOutMs: { type: "integer", minimum: 1 }, timelineStartMs: { type: "integer", minimum: 0 }, playbackRate: { type: "number", exclusiveMinimum: 0 },
      gainDb: { type: "number" }, pan: { type: "number", minimum: -1, maximum: 1 }, fadeInMs: { type: "integer", minimum: 0 }, fadeOutMs: { type: "integer", minimum: 0 },
      channelMapping: { type: "array", items: { type: "string" } }, effects: { type: "array", items: { $ref: "#/components/schemas/EffectInstance" } },
    },
  },
  TimelineSubtitleCue: {
    type: "object", additionalProperties: false, required: ["id", "trackId", "textSnapshot", "startMs", "endMs"],
    properties: {
      id: { type: "string", minLength: 1 }, trackId: { type: "string", minLength: 1 }, subtitleDocumentId: { type: ["string", "null"] }, subtitleDocumentVersion: { type: ["integer", "null"], minimum: 1 },
      sourceCueId: { type: ["string", "null"] }, textSnapshot: { type: "string", minLength: 1 }, speakerId: { type: ["string", "null"] }, startMs: { type: "integer", minimum: 0 }, endMs: { type: "integer", minimum: 1 },
      styleOverride: { type: ["object", "null"], additionalProperties: false, properties: { fontFamily: { type: "string" }, fontSize: { type: "number", exclusiveMinimum: 0 }, color: { type: "string" }, background: { type: "string" }, align: { enum: ["left", "center", "right"] } } },
      positionOverride: { anyOf: [{ $ref: "#/components/schemas/NormalizedPoint" }, { type: "null" }] },
    },
  },
  Transition: {
    type: "object", additionalProperties: false, required: ["id", "trackId", "fromClipId", "toClipId", "type", "durationMs", "implementationId", "implementationVersion", "parameters"],
    properties: {
      id: { type: "string", minLength: 1 }, trackId: { type: "string", minLength: 1 }, fromClipId: { type: "string", minLength: 1 }, toClipId: { type: "string", minLength: 1 },
      type: { enum: ["cut", "dissolve", "fade", "wipe", "custom"] }, durationMs: { type: "integer", minimum: 0 }, implementationId: { type: "string", minLength: 1 }, implementationVersion: { type: "string", minLength: 1 }, parameters: { type: "object", additionalProperties: true },
    },
  },
  VideoTrack: {
    type: "object", additionalProperties: false, required: ["id", "name", "order", "locked", "muted", "hidden", "compositingMode", "clips"],
    properties: { id: { type: "string", minLength: 1 }, name: { type: "string" }, order: { type: "integer", minimum: 0 }, locked: { type: "boolean" }, muted: { type: "boolean" }, hidden: { type: "boolean" }, compositingMode: { enum: ["normal", "multiply", "screen", "overlay"] }, clips: { type: "array", items: { $ref: "#/components/schemas/VideoClip" } } },
  },
  AudioTrack: {
    type: "object", additionalProperties: false, required: ["id", "name", "order", "role", "locked", "muted", "solo", "gainDb", "clips"],
    properties: { id: { type: "string", minLength: 1 }, name: { type: "string" }, order: { type: "integer", minimum: 0 }, role: { enum: ["dialogue", "bgm", "sfx", "ambience", "custom"] }, locked: { type: "boolean" }, muted: { type: "boolean" }, solo: { type: "boolean" }, gainDb: { type: "number" }, clips: { type: "array", items: { $ref: "#/components/schemas/AudioClip" } } },
  },
  SubtitleTrack: {
    type: "object", additionalProperties: false, required: ["id", "name", "order", "language", "locked", "hidden", "defaultStyle", "cues"],
    properties: { id: { type: "string", minLength: 1 }, name: { type: "string" }, order: { type: "integer", minimum: 0 }, language: { type: "string", minLength: 2 }, locked: { type: "boolean" }, hidden: { type: "boolean" }, defaultStyle: { type: "object", additionalProperties: false, properties: { fontFamily: { type: "string" }, fontSize: { type: "number" }, color: { type: "string" }, background: { type: "string" }, align: { enum: ["left", "center", "right"] } }, required: ["fontFamily", "fontSize", "color", "align"] }, cues: { type: "array", items: { $ref: "#/components/schemas/TimelineSubtitleCue" } } },
  },
  Timeline: {
    type: "object", additionalProperties: false, required: ["timebase", "durationMs", "videoTracks", "audioTracks", "subtitleTracks", "transitions"],
    properties: { timebase: { $ref: "#/components/schemas/Timebase" }, durationMs: { type: "integer", minimum: 0 }, videoTracks: { type: "array", items: { $ref: "#/components/schemas/VideoTrack" } }, audioTracks: { type: "array", items: { $ref: "#/components/schemas/AudioTrack" } }, subtitleTracks: { type: "array", items: { $ref: "#/components/schemas/SubtitleTrack" } }, transitions: { type: "array", items: { $ref: "#/components/schemas/Transition" } } },
  },
  TimelineUpdateRequest: {
    type: "object", additionalProperties: false, required: ["commandId", "timeline", "expectedVersion"],
    properties: { commandId: { type: "string", format: "uuid" }, timeline: { $ref: "#/components/schemas/Timeline" }, expectedVersion: { type: "integer", minimum: 0 } },
  },
};
const openapi = {
  openapi: "3.1.0",
  info: {
    title: "Manju AI 漫剧生产平台 API",
    version: "1.0.0-design",
    description: "开发就绪目标契约。当前实现路径仍处于兼容迁移期；实现状态以 03-feature-status.md 为准。",
  },
  servers: [{ url: "http://localhost:3000", description: "本地开发" }],
  tags: features.map((feature) => ({ name: feature.id, description: feature.title })),
  paths,
  components: {
    securitySchemes: { sessionCookie: { type: "apiKey", in: "cookie", name: "manju_session" } },
    schemas: {
      DataEnvelope: { type: "object", additionalProperties: false, required: ["data"], properties: { data: { type: ["object", "array", "null"], additionalProperties: true }, page: { $ref: "#/components/schemas/PageInfo" } } },
      PageInfo: { type: "object", additionalProperties: false, required: ["hasMore"], properties: { cursor: { type: ["string", "null"] }, nextCursor: { type: ["string", "null"] }, hasMore: { type: "boolean" } } },
      ErrorEnvelope: { type: "object", additionalProperties: false, required: ["error"], properties: { error: { type: "object", additionalProperties: false, required: ["code", "message", "retryable", "traceId"], properties: { code: { type: "string", pattern: "^[a-z][a-z0-9_]*$" }, message: { type: "string" }, details: { type: ["object", "array", "null"], additionalProperties: true }, retryable: { type: "boolean" }, traceId: { type: "string", minLength: 1 } } } } },
      ...timelineComponentSchemas,
    },
    responses: {
      BadRequest: errorResponse("请求或业务校验失败"),
      Unauthenticated: errorResponse("未认证或会话失效"),
      Forbidden: errorResponse("已认证但无权限"),
      NotFound: errorResponse("资源不存在或已删除"),
      Conflict: errorResponse("版本、幂等或状态冲突"),
      RateLimited: errorResponse("超过速率限制"),
      InternalError: errorResponse("未预期服务错误"),
    },
  },
  "x-generated-from": specFiles.map((file) => `docs/delivery-specs/${file}`),
};

const STANDARD_UI_STATES = ["loading", "empty", "ready", "forbidden", "conflict", "error_retry"];
const LONG_TASK_STATES = ["queued", "running", "cancelling", "completed", "failed", "cancelled", "timed_out", "unknown_result"];
const LONG_TASK_FEATURE_IDS = new Set([
  "US-004", "US-006", "US-009", "US-011", "US-013", "US-015", "US-017",
  "US-028", "US-029", "US-DS-001", "CAP-005", "CAP-006", "CAP-009",
]);

const testMatrix = {
  version: 1,
  sourceRevision: 1,
  features: features.map(({ id, title, file, scenarios, pages, tables, operationIds, requirementIds }) => ({
    id, title, source: `docs/delivery-specs/${file}`, featureFile: `tests/acceptance/features/${id.toLowerCase()}.feature`, requirementIds, scenarios, pages, pageRoutes: pages, tables, operationIds,
    uiStates: [...STANDARD_UI_STATES, ...(LONG_TASK_FEATURE_IDS.has(id) ? LONG_TASK_STATES : [])],
    roleVariants: ["authorized", "read_only", "forbidden"],
    requiredTestLayers: [...new Set([
      "contract",
      "integration",
      ...(pages.length ? ["e2e"] : []),
      ...requirementIds.flatMap((requirementId) => testLayersByRequirement.get(requirementId) ?? []),
    ])],
    implementationEvidence: { code: [], migrations: [], tests: [], status: "unverified" },
  })),
};

fs.mkdirSync(path.dirname(apiOutput), { recursive: true });
fs.mkdirSync(path.dirname(matrixOutput), { recursive: true });
fs.mkdirSync(acceptanceOutput, { recursive: true });
fs.writeFileSync(apiOutput, `${JSON.stringify(openapi, null, 2)}\n`, "utf8");
fs.writeFileSync(matrixOutput, `${JSON.stringify(testMatrix, null, 2)}\n`, "utf8");
for (const feature of features) {
  const lines = [`@${feature.id} @design-contract`, `Feature: ${feature.id} ${feature.title}`, `  Source: docs/delivery-specs/${feature.file}`, ""];
  for (const scenario of feature.scenarios) {
    lines.push(`  Scenario: ${scenario.id} ${scenario.title}`);
    for (const step of scenario.steps) lines.push(`    ${step}`);
    lines.push("");
  }
  fs.writeFileSync(path.join(acceptanceOutput, `${feature.id.toLowerCase()}.feature`), `${lines.join("\n")}\n`, "utf8");
}
console.log(`Generated ${features.length} features, ${operationIds.size} operations, ${testMatrix.features.reduce((n, f) => n + f.scenarios.length, 0)} scenarios.`);
