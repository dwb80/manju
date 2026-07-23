# FEAT-PIPE-004 质量检测 — 实施计划

> **范围**：P0 基础服务接线 + P1 自动触发 hook 集成（**不含** P2 AI 评分）
> **当前状态**：核心 service 已写好（`quality-detection-service.ts` 已存在），缺 app.ts 挂载、executeNode hook 调用、e2e 测试。

---

## Context

**问题**：FEAT-PIPE-004 质量检测的「核心 service」已在 W10 完成，但「接线 + 集成 + 测试」未完成：
- `src/services/app.ts` 的 `AppContext` 接口**没有** `qualityDetectionService` 字段，`createAppContext` 末尾**没有**实例化
- `src/services/module-domain/pipeline-run-service.ts` 的 `executeNode` 写完 `node_completed` 事件后**没有**调 `maybeAutoTriggerQualityCheck`
- 缺两个 e2e：`tests/e2e-quality-hook.mjs`（自动 hook 验证）、`tests/e2e-quality-on-failure.mjs`（on_failure=review 联动）

**目标**：让 `e2e-quality-integration.mjs` 通过 + 节点完成时自动触发质检 + on_failure 三种联动全部可用。

---

## 当前状态分析（来自 Phase 1 探索）

### 已完成（无需再写）
| 文件 | 状态 | 备注 |
|------|------|------|
| `d:\trae\manju\backend\src\services\module-domain\quality-detection-service.ts` | ✅ 已存在 20058B | 含 `QualityDetectionService`、`createQualityDetectionService`、`maybeAutoTriggerQualityCheck`、`extractTargetIdFromOutput`、`onFailure`（log/review/block 三种）、`isRecentlyDetected` |
| `d:\trae\manju\backend\tests\e2e-quality-integration.mjs` | ✅ 已存在 | 6 步骤全量集成测试，引用 `ctx.qualityDetectionService.detect(...)` |
| `d:\trae\manju\backend\src\types\pipeline.ts` | ✅ | `QualityReport`/`QualityAutoConfig`/`PipelineEventType.node_completed`/`node_error_classified` 全部就绪 |
| `d:\trae\manju\backend\src\services\horizontal\review-service.ts` | ✅ | `ctx.reviewService.submit({ targetType, targetId, projectId, submittedBy })` |

### 未完成（本次要做的）
| 文件 | 缺失 | 行号参考 |
|------|------|----------|
| `d:\trae\manju\backend\src\services\app.ts` | (a) AppContext 接口缺 `qualityDetectionService` 字段；(b) `createAppContext` 末尾未挂载 | 接口 L207 之后；挂载点 L375 之后 |
| `d:\trae\manju\backend\src\services\module-domain\pipeline-run-service.ts` | `executeNode` L1362 `node_completed` 事件后缺 fire-and-forget 调 hook | executeNode 函数 L1255–1600 范围；事件写于 L1356-1367 |
| `d:\trae\manju\backend\tests\e2e-quality-hook.mjs` | 缺 | — |
| `d:\trae\manju\backend\tests\e2e-quality-on-failure.mjs` | 缺 | — |

---

## 实施步骤

### Step 1：`app.ts` 加 `qualityDetectionService` 字段和挂载（P0 收尾）

#### 1.1 接口加字段
**文件**：`d:\trae\manju\backend\src\services\app.ts`，在 L207 `pipelineRunService: ...` 行之后插入：
```ts
  /** V2 W6+ REQ-PIPE-004 质检中心服务（detect + 落表 + 自动 hook）。 */
  qualityDetectionService: import("./module-domain/quality-detection-service.js").QualityDetectionService;
```

#### 1.2 挂载实例
**文件**：同一文件，在 L375 `(ctxTyped as { pipelineRunService: unknown }).pipelineRunService = ...` 行之后插入：
```ts
  // V2 W6+ REQ-PIPE-004 质检中心服务
  (ctxTyped as { qualityDetectionService: unknown }).qualityDetectionService =
    (await import("./module-domain/quality-detection-service.js"))
      .createQualityDetectionService(ctxTyped);
```

#### 1.3 验证编译
```powershell
cd d:\trae\manju\backend
npm run build
node tests\e2e-quality-integration.mjs
```

---

### Step 2：`pipeline-run-service.ts` 加 hook 调用（P1 接线）

**文件**：`d:\trae\manju\backend\src\services\module-domain\pipeline-run-service.ts`

**位置**：`executeNode` 函数中 `await ctx.pipelineRunService.recordEvent({ type: "node_completed", ... })` **之后**（L1367 之后），用 fire-and-forget 包裹：

**新增代码**（直接插入到 `node_completed` recordEvent 调用之后）：
```ts
      // V2 W6+ REQ-PIPE-004：节点完成 → 自动触发质检（fire-and-forget，不阻塞调度器）
      void (async () => {
        try {
          const { maybeAutoTriggerQualityCheck } =
            await import("./quality-detection-service.js");
          await maybeAutoTriggerQualityCheck(ctx, {
            runId,
            nodeId: node.id,
            projectId,
            nodeType: String(node.type ?? ""),
            output: (output ?? {}) as Record<string, unknown>,
          });
        } catch (err) {
          log.warn(
            { event: "quality.hook.failed", err: String(err), nodeId: node.id },
            "auto quality hook failed",
          );
        }
      })();
```

**注意**：
- `output` 变量必须已在该作用域内（`executeNode` 内局部变量，看 L1362 附近的上下文）
- 必须用 `void (async () => {...})()` 包裹（fire-and-forget，不 await）
- 内部 try/catch 兜底（不影响调度器）

#### 2.1 验证编译
```powershell
npm run build
```

---

### Step 3：新建 `tests/e2e-quality-hook.mjs`（P1 验证自动 hook）

**文件**：`d:\trae\manju\backend\tests\e2e-quality-hook.mjs`

**测试目标**：节点完成时，hook 自动触发 detect 并落 `quality_reports` 表

**测试结构**（参考 `e2e-quality-integration.mjs`）：
1. `createAppContext()` 建 ctx
2. 用 `os.tmpdir()` + `mkdtemp` 建临时目录
3. 插入测试 image asset 到 `image_tasks`（同 e2e-quality-integration）
4. 插入 `quality_auto_configs`（enabled=true, threshold=60, on_failure=log）
5. **构造 run**：1 个 `image_generation` 节点 + executeFn 模拟（参考 e2e-pipeline-rework 的 dummy pattern；或直接调内部 `createRun` + 注入一个返回 `output = { image_id: "img-xxx" }` 的执行器）
6. 调 `startRun` 等跑完（用 await / setTimeout poll 节点状态）
7. **断言**：`ctx.qualityReports.findMany({ project_id })` 至少 1 条；`details.metadata.source === "auto"`；`targetType === "image"`
8. 清理：删 config + image asset

**关键点**：
- 节点要真完成才能触发 hook（手动 set status=completed 不行，必须经过 executeNode 链路）
- 如直接 `executeNode` 调用不便，可改用更简单方案：**直接调 `maybeAutoTriggerQualityCheck(ctx, payload)`**（它是 export 出来的，service 文件 L593），绕过 run 调度器
- 推荐用直接调 `maybeAutoTriggerQualityCheck` 方案（更快、更确定），但要 import path 正确：`import { maybeAutoTriggerQualityCheck } from "../dist/src/services/module-domain/quality-detection-service.js";`

---

### Step 4：新建 `tests/e2e-quality-on-failure.mjs`（P1 验证 on_failure=review）

**文件**：`d:\trae\manju\backend\tests\e2e-quality-on-failure.mjs`

**测试目标**：`on_failure=review` 时，质检 failed 状态会触发 `ctx.reviewService.submit`

**测试结构**：
1. `createAppContext()` 建 ctx
2. 插入测试 image asset（**故意让评分低**：image_tasks.params 留空，触发 `no_size_metadata` 路径 → score=50 < threshold）
3. 插入 `quality_auto_configs`（enabled=true, threshold=99, on_failure=review）
4. **记录 review_items 数量基线**：`ctx.reviewItems.findMany({}).length`
5. **直接调** `maybeAutoTriggerQualityCheck(ctx, { runId: "r1", nodeId: "n1", projectId, nodeType: "image_generation", output: { image_id: TEST_IMAGE_ID } })`
6. **断言**：
   - `ctx.reviewItems.findMany({}).length` 增加了 1
   - 最新 review item 的 `target_type` 映射为 `character_image`（image_generation → character_image）
   - `submitted_by === "system:quality-hook"`
   - `project_id === TEST_PROJECT_ID`
7. 清理：删 config + image asset + 提交的 review item

---

### Step 5：跑全套测试 + 回归

```powershell
cd d:\trae\manju\backend
npm run build

# 新增
node tests\e2e-quality-integration.mjs
node tests\e2e-quality-hook.mjs
node tests\e2e-quality-on-failure.mjs

# 回归（确保没破坏其他模块）
node tests\e2e-sla-upgrade.mjs
node tests\e2e-condition.mjs
node tests\e2e-pipeline-rework.mjs
node tests\e2e-project-baseline.mjs
```

**预期**：全部通过。

---

### Step 6：收尾（可选，若用户同意）

- 更新 `docs/requirements/v2-implementation-status.md`：
  - §1 W 阶段新增 "W10 FEAT-PIPE-004 质量检测 P0+P1 完成"
  - §3 FEAT-PIPE-004 行：🔧 → ✅
  - §3 完整率：4/6 = 67% → **5/6 = 83%**
- 更新 CHANGELOG（如有）

---

## 关键风险与缓解

| 风险 | 缓解 |
|------|------|
| `executeNode` 内 `output` 变量作用域 | 先读 L1362 附近代码确认 `output` 是 const/let 在该作用域；如不在则降级用 `node.output_data` 或 `{}` |
| hook 同步等待拖慢调度器 | 整段用 `void (async () => { ... })()` fire-and-forget；内部 try/catch |
| e2e 测试中 `import path` 错 | 与现有 `e2e-quality-integration.mjs` 一致用 `../dist/src/...`（dist 路径） |
| 节点类型 `output` 字段名 | 直接调 `maybeAutoTriggerQualityCheck` 时显式传 `output: { image_id: ... }`，避开 `extractTargetIdFromOutput` 漂移 |
| 已有 review_items 干扰计数 | 测试一开始记基线长度，比较 delta |

---

## 关键文件清单

| 路径 | 步骤 | 动作 |
|------|------|------|
| `d:\trae\manju\backend\src\services\app.ts` | Step 1 | 改 2 处（接口 + 挂载） |
| `d:\trae\manju\backend\src\services\module-domain\pipeline-run-service.ts` | Step 2 | 改 1 处（executeNode 末尾 fire-and-forget 调 hook） |
| `d:\trae\manju\backend\tests\e2e-quality-hook.mjs` | Step 3 | 新建 |
| `d:\trae\manju\backend\tests\e2e-quality-on-failure.mjs` | Step 4 | 新建 |
| `d:\trae\manju\docs\requirements\v2-implementation-status.md` | Step 6 | 更新（可选） |

---

## 复用工具

| 工具 | 来源 | 用途 |
|------|------|------|
| `id(prefix)` / `nowIso()` | `src/utils.ts` | service 内部已用 |
| `rootLogger.child({ module })` | `src/logger.js` | service 内部已用 |
| `SqliteRepository<T>` | `src/storage/sqlite.js` | `qualityReports` / `qualityAutoConfigs` / `reviewItems` |
| `recordEvent` | `pipelineRunService.recordEvent` | on_failure=block 时写事件 |
| `ctx.reviewService.submit` | `horizontal/review-service.ts` | on_failure=review 提交审核 |

---

## 验证（端到端）

1. `npm run build` 通过
2. `e2e-quality-integration.mjs` 通过（验证 app.ts 挂载 + service 完整）
3. `e2e-quality-hook.mjs` 通过（验证 hook 链路）
4. `e2e-quality-on-failure.mjs` 通过（验证 review 联动）
5. 回归：`e2e-sla-upgrade.mjs` / `e2e-condition.mjs` / `e2e-pipeline-rework.mjs` / `e2e-project-baseline.mjs` 全过
