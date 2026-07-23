import { readFile } from "node:fs/promises";
import path from "node:path";
import "./check-ddd-boundaries.mjs";

const root = path.resolve(import.meta.dirname, "..");
const violations = [];

async function source(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

function forbid(relativePath, text, pattern, message) {
  if (pattern.test(text)) violations.push(`${relativePath}: ${message}`);
}

const guardedRouters = [
  "src/http/pipeline-router.ts",
  "src/http/quality-router.ts",
  "src/http/final-videos-router.ts",
];
for (const file of guardedRouters) {
  const text = await source(file);
  forbid(
    file,
    text,
    /\bctx\.[A-Za-z][A-Za-z0-9]*\.(?:insert|update|delete)\s*\(/,
    "Router 禁止直接写 Repository，必须调用应用服务命令",
  );
}

const qualityRouter = await source("src/http/quality-router.ts");
forbid(
  "src/http/quality-router.ts",
  qualityRouter,
  /Math\.random\(\)[\s\S]{0,200}(?:score|QualityReport)/,
  "禁止随机生成质量分或伪造质检报告",
);
const qualityService = await source("src/services/module-domain/quality-detection-service.ts");
forbid(
  "src/services/module-domain/quality-detection-service.ts",
  qualityService,
  /Math\.random\(\)[\s\S]{0,200}(?:score|passed)/,
  "质检服务异常兜底禁止随机生成分数或伪通过结果",
);

const videoTask = await source("src/services/module-domain/video-task-module.ts");
forbid(
  "src/services/module-domain/video-task-module.ts",
  videoTask,
  /\bctx\.(?:shots|storyboards)\.(?:insert|update|delete)\s*\(/,
  "视频模块禁止直接写分镜域仓储",
);

const pipeline = await source("src/services/module-domain/pipeline-run-service.ts");
forbid(
  "src/services/module-domain/pipeline-run-service.ts",
  pipeline,
  /\bctx\.todos\./,
  "编排模块禁止直接读写 Todo 仓储",
);
const pipelineLines = pipeline.split(/\r?\n/).length;
if (pipelineLines > 2100) {
  violations.push(
    `src/services/module-domain/pipeline-run-service.ts: ${pipelineLines} 行超过整改基线 2100 行；新增职责必须拆分`,
  );
}

const pipelinePage = await source("../frontend/app/pipeline/page.tsx");
forbid(
  "../frontend/app/pipeline/page.tsx",
  pipelinePage,
  /INSERT\s+INTO/i,
  "用户界面禁止指导用户直接修改数据库",
);

if (violations.length > 0) {
  console.error("V2 architecture gate failed:");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exitCode = 1;
} else {
  console.log("V2 architecture gate passed.");
}
