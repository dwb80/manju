# FEAT-PIPE-004 质量检测 — 实施计划

> **范围**：P0 基础服务 + P1 自动触发 hook（**不含** P2 AI 评分、**不含** 一致性包）
> **on_failure=block 行为**：软阻断（仅写 `node_error_classified` 事件 + warn 日志，不修改 node.status）
> **目标**：让 `e2e-quality-integration.mjs` 通过 + 节点完成时自动触发质检 + 三种 on_failure 联动全部可用

---

## Context

**问题**：FEAT-PIPE-004 质量检测当前是「壳子已搭好、缺实体」的状态——W6 REQ-PIPE-004-05 已建好 `quality_reports` / `quality_auto_configs` 两张表、7 个 HTTP 端点、QualityAutoConfig 类型，但核心 `qualityDetectionService` 完全缺失：
- `src/services/module-domain/quality-detection-service.ts` 不存在
- `AppContext` 接口里没有 `qualityDetectionService` 字段
- `createAppContext` 没有实例化
- `tests/e2e-quality-integration.mjs` 引用 `ctx.qualityDetectionService.detect(...)` 因此**跑不通**
- 节点完成时（`node_completed` 事件）没有 W6 设计的 `maybeAutoTriggerQualityCheck` hook

**目标**：让质检中心从「壳子」变成「可用的服务」，完成 MOD-PIPELINE 6 个 Feature 中的 FEAT-PIPE-004 收尾。完成 P0 + P1 后：
- `e2e-quality-integration.mjs` 跑通（72+72+55+48+11+新用例 = 累加 5+ 用例）
- W6 自动触发 hook 在节点完成时按项目配置自动跑 detect
- `on_failure=log/review/block` 三种联动全部可用
- MOD-PIPELINE 完整率从 4/6 = 67% 提升到 5/6 = 83%

---

## 阶段 1：P0 基础服务（半天）

### 1.1 新建 `src/services/module-domain/quality-detection-service.ts`

**导出**：
```ts
export interface QualityDetectionService {
  detect(
    targetId: string,
    targetType: QualityTargetType,
    projectId: string,
    runId?: string,
    nodeId?: string,
    opts?: { useAIScoring?: boolean },
  ): Promise<{
    reportId: string;
    overallScore: number;
    status: "passed" | "warning" | "failed";
  }>;
}
export function createQualityDetectionService(ctx: AppContext): QualityDetectionService;
```

**detect 内部流程**：
1. 读 `ctx.qualityAutoConfigs.findOne({ project_id })`；无记录则用 `DEFAULT_CFG = { enabled: false, target_types: [], threshold: 70, on_failure: "log" }`
2. `enabled = cfg.enabled || opts?.useAIScoring === true`
3. `check_type` 用 `defaultCheckFor(targetType)` 映射：image→resolution / video→duration / audio→audio_level / composition→aspect_ratio
4. **启发式评分**（按 targetType 走不同分支，每分支 try/catch 兜底）：

| targetType | 数据来源 | 评分规则 |
|------------|----------|----------|
| `image` | `ctx.images.findById(targetId)` | 优先解 `image_urls[0]` 拿尺寸；不可得则 `Math.min(100, 70 + floor(rand*30))`；可解析时按"宽×高"给分（≥1024×768 满分，否则按比例扣分） |
| `video` | `ctx.videos.findById(targetId)` | 按 `seconds` 长度 + `size` 字节数评分；缺字段则降级到随机启发式 |
| `audio` | `ctx.audios.findById(targetId)` | 按 `duration` + `size` 评分；缺字段则降级到随机启发式 |
| `composition` | `ctx.projectClips.findById(targetId)` | 按 `duration` + `ratio` 评分；缺字段则降级到随机启发式 |

5. `status` 三段判定：`score >= threshold` → passed；`score >= threshold - 15` → warning；其余 → failed
6. 写 `ctx.qualityReports.insert(report)`：`{ id: makeId("qrpt"), project_id, run_id, node_id, check_type, score, threshold, passed, details: { targetId, targetType, overallScore, status, enabled, onFailure, items, metadata: { source: "auto" | "auto_disabled" | "manual_detect" } }, created_at: nowIso() }`
7. 记 `log.info({ event: "quality.detect.completed" })`
8. 返回 `{ reportId, overallScore, status }`

**异常处理**：
- 找不到 asset / 字段缺失 → `score = 50`（中性不挡下游），`details.items` 写 `{ reason: "asset_not_found_or_invalid" }`
- 任何 IO 异常 → try/catch 兜底 → `log.warn` → 返回 score=50 的报告

### 1.2 改 `src/services/app.ts`（2 处）

**(a) AppContext 接口加字段**（约 L200 之后）：
```ts
/** V2 W6+ REQ-PIPE-004 质检中心服务（detect + 落表 + 自动 hook）。 */
qualityDetectionService: import("./module-domain/quality-detection-service.js").QualityDetectionService;
```

**(b) createAppContext 末尾挂上**（在 `pipelineRunService` 挂载之后约 L376）：
```ts
// V2 W6+ REQ-PIPE-004 质检中心服务
(ctxTyped as { qualityDetectionService: unknown }).qualityDetectionService =
  (await import("./module-domain/quality-detection-service.js"))
    .createQualityDetectionService(ctxTyped);
```

### 1.3 验证 P0
```powershell
cd d:\trae\manju\backend
npm run build                                # 必须通过
node tests\e2e-quality-integration.mjs        # 应该全过
```
预期：测试 STEP 4/5 调 `ctx.qualityDetectionService.detect(...)` 不再因 undefined 报错，STEP 6 看到 quality_reports 表新增条目。

---

## 阶段 2：P1 自动触发 hook（半天）

### 2.1 改 `src/services/module-domain/quality-detection-service.ts`（加 1 导出函数 + 1 helper）

**新增导出**：
```ts
export function extractTargetIdFromOutput(
  nodeType: string,
  output: Record<string, unknown>,
): string | null;
```

**规则**：
| nodeType | 提取字段（按顺序） |
|----------|--------------------|
| `image_generation` / `generate_image` | `image_id` → `asset_id` → `id` |
| `video_generation` / `generate_video` | `video_id` → `asset_id` |
| `tts` | `audio_id` → `asset_id` |
| `composition` / `compose` | `composition_id` → `clip_id` |
| `render` | `render_job_id` → `clip_id` |
| 其它 | `null` |

**新增导出 hook 函数**（与 `createQualityDetectionService` 同文件，便于复用）：
```ts
export async function maybeAutoTriggerQualityCheck(
  ctx: AppContext,
  payload: {
    runId: string;
    nodeId: string;
    projectId: string;
    nodeType: string;
    output: Record<string, unknown>;
  },
): Promise<{ reportId?: string; status?: string; skipped?: boolean }>;
```

**内部逻辑**：
1. **不触发** nodeType ∈ {`quality_check`, `review`, `notification`, `wait`, `webhook`} → `{ skipped: true }`
2. **nodeType → targetType** 映射：

| nodeType | targetType |
|----------|------------|
| `image_generation` / `generate_image` | `image` |
| `video_generation` / `generate_video` | `video` |
| `tts` | `audio` |
| `composition` / `compose` / `render` | `composition` |
| 其它 | `null`（返回 `{ skipped: true }`） |

3. `targetId = extractTargetIdFromOutput(...)`；空 → `{ skipped: true }`
4. **幂等性**：调用前 `ctx.qualityReports.findOne({ node_id: payload.nodeId })`；若最近 60s 内已有 → 跳过（避免重试节点 N 条 report）
5. 调 `ctx.qualityDetectionService.detect(targetId, targetType, projectId, runId, nodeId)`
6. **失败联动 `handleOnFailure(ctx, payload, result)`**：
   - `status === "passed"` → return
   - `on_failure = "log"` → `log.warn({ event: "quality.detect.warning", score, reportId })`
   - `on_failure = "review"` 且 `status === "failed"`（不是 warning）→ 调 `ctx.reviewService.submit({ targetType: mapToReviewTargetType(nodeType), targetId: nodeId, projectId, submittedBy: "system:quality-hook" })`；失败时 try/catch 兜底 log warn
   - `on_failure = "block"`（软阻断）→ 调 `ctx.pipelineRunService.recordEvent({ type: "node_error_classified", payload: { source: "quality_block", score, reportId } })`；**不**修改 `node.status`

7. 返回 `{ reportId, status }`

### 2.2 改 `src/services/module-domain/pipeline-run-service.ts`（1 处调用）

**位置**：`executeNode` 函数内，`await ctx.pipelineRunService.recordEvent({ type: "node_completed", ... })` 调用**之后**。

**新增**：
```ts
// V2 W6+ REQ-PIPE-004：节点完成 → 自动触发质检（fire-and-forget，不阻塞调度器）
void (async () => {
  try {
    const { maybeAutoTriggerQualityCheck } = await import("./quality-detection-service.js");
    await maybeAutoTriggerQualityCheck(ctx, {
      runId,
      nodeId: node.id,
      projectId,
      nodeType: String(node.type ?? ""),
      output: output as Record<string, unknown>,
    });
  } catch (err) {
    log.warn({ event: "quality.hook.failed", err: String(err), nodeId: node.id }, "auto quality hook failed");
  }
})();
```

### 2.3 新增 e2e 测试

**`tests/e2e-quality-hook.mjs`**（P1 验证）：
- 构造 ctx + server → 创建项目 + config（enabled=true, threshold=60, on_failure=log）
- 插入测试用 image asset
- 构造一个 run，含 1 个 `image_generation` 节点（用 dummy `executeFn` 走通 executeNode，让它 set output = `{ image_id: "img-xxx" }`）
- 调 `pipelineRunService.startRun(runId)` 跑完
- 断言 `quality_reports` 表 ≥1 条，targetType=image，source=auto
- 再禁用 config 重跑，断言只增 1 条 source=auto_disabled

**`tests/e2e-quality-on-failure.mjs`**（P1 验证 review 联动）：
- 配 `on_failure=review` + `threshold=99`（绝大多数过不了）
- 跑节点 → 断言 `review_items` 多 1 条（target_type=image/character_image 之一、status=pending、submitted_by=system:quality-hook）

### 2.4 验证 P1
```powershell
cd d:\trae\manju\backend
npm run build
node tests\e2e-quality-hook.mjs
node tests\e2e-quality-on-failure.mjs
node tests\e2e-quality-integration.mjs    # 回归
```

---

## 关键文件清单

| 路径 | 阶段 | 动作 |
|------|------|------|
| `src/services/module-domain/quality-detection-service.ts` | P0 + P1 | **新建**（P0 工厂 + P1 hook） |
| `src/services/app.ts` | P0 | **改 2 处**（接口加字段 + 工厂挂载） |
| `src/services/module-domain/pipeline-run-service.ts` | P1 | **改 1 处**（executeNode 末尾 fire-and-forget 调 hook） |
| `tests/e2e-quality-hook.mjs` | P1 | **新建**（自动 hook 验证） |
| `tests/e2e-quality-on-failure.mjs` | P1 | **新建**（on_failure=review 联动验证） |
| `tests/e2e-quality-integration.mjs` | P0 | **不改**（仅做回归验证） |

---

## 复用的现有工具

| 工具 | 来源 | 用途 |
|------|------|------|
| `id(prefix)` / `nowIso()` | `src/utils.ts` | 生成 report id + 时间戳 |
| `rootLogger.child({ module })` | `src/logger.js` | 模块日志 |
| `SqliteRepository<T>` | `src/storage/sqlite.js` | 已用 `qualityReports` / `qualityAutoConfigs` |
| `recordEvent` | `pipelineRunService.recordEvent` | on_failure=block 时写事件 |
| `ctx.reviewService.submit` | `src/services/horizontal/review-service.ts` | on_failure=review 提交审核 |
| `PipelineEvent` type | `src/types/pipeline.ts` | `node_error_classified` 事件 type 已存在 |
| `defaultCheckTypeFor` 逻辑 | `src/http/quality-router.ts:119-127` | 服务里复制一份（避免循环依赖） |

---

## 关键风险与缓解

| 风险 | 缓解 |
|------|------|
| hook 同步等待拖慢调度器 | 整段用 `void (async () => { ... })()` fire-and-forget；内部 try/catch |
| `targetId` 解析不到 | `extractTargetIdFromOutput` 找不到时直接 `return { skipped: true }`（不发任何 report、不记 warn） |
| 同一节点被重试触发 N 次 | hook 入口加"同 node 已有 report 且 created_at 在最近 60s"幂等检查 |
| 缺 review targetType 适配 | on_failure=review 失败时如果 `ctx.reviewService.submit` 抛错 → try/catch 兜底 log warn，不影响主流程 |
| `extractTargetIdFromOutput` 字段名漂移 | 按 `output.X` 顺序查找（前缀命中即用）；不可得时直接 `return null` |
| `qualityDetectionService` 在 e2e 旧 ctx cache | 测试每次 `createAppContext()`，无 cache 风险 |

---

## 验证（端到端）

```powershell
cd d:\trae\manju\backend

# P0 验证
npm run build
node tests\e2e-quality-integration.mjs

# P1 验证
node tests\e2e-quality-hook.mjs
node tests\e2e-quality-on-failure.mjs

# 回归（确保没破坏 W8 SLA 等其他模块）
node tests\e2e-sla-upgrade.mjs
node tests\e2e-condition.mjs
node tests\e2e-pipeline-rework.mjs
node tests\e2e-project-baseline.mjs
```

**预期结果**：全部通过。测试累加 5+ 用例（P0 让 e2e-quality-integration 6 用例可跑 + P1 新增 ≥4 用例）。

---

## 收尾

- 更新 `docs/requirements/v2-implementation-status.md`：
  - §1 W 阶段新增 "W10 FEAT-PIPE-004 质量检测 P0+P1 完成"
  - §2 详细表加 "REQ-PIPE-004-05+06/07" 行
  - §3 FEAT-PIPE-004 行：🔧 → ✅
  - §3 完整率：4/6 = 67% → **5/6 = 83%**
  - §7 结论加段："W10 FEAT-PIPE-004 质量检测收尾"
- 更新 CHANGELOG（如有）

---

## 关键文件位置（实施时直接打开）

- `d:\trae\manju\backend\src\types\pipeline.ts`（已就绪）
- `d:\trae\manju\backend\src\http\quality-router.ts`（已就绪，等 P0 service）
- `d:\trae\manju\backend\src\services\app.ts`（P0 接线）
- `d:\trae\manju\backend\src\services\module-domain\quality-detection-service.ts`（P0 新建 → P1 加 hook）
- `d:\trae\manju\backend\src\services\module-domain\pipeline-run-service.ts`（P1 hook 调用点）
- `d:\trae\manju\backend\tests\e2e-quality-integration.mjs`（P0 验证）
- `d:\trae\manju\backend\tests\e2e-quality-hook.mjs`（P1 新增）
- `d:\trae\manju\backend\tests\e2e-quality-on-failure.mjs`（P1 新增）
