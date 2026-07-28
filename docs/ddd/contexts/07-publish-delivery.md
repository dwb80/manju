# 3.7 发布交付上下文 (Publish & Delivery)

> **所属上下文**：发布交付 (Publish & Delivery)
> **聚合根**：`FinalVideo` / `PublishPlan`
> **对应页面**：发布准备
> **配套规范**：[DDD 治理规范](../governance.md)｜[统一语言术语表](../glossary.md)｜[上下文映射](../context-map.md)｜[跨上下文协作契约](../contracts.md)

**边界**：成片管理、打包导出、发布计划、发布执行、发布记录。

> **事件表说明**：聚合的"领域事件"表仅列出有消费者的关键事件。命令表"产出事件"列是事件全量来源。

---

## 1. 聚合根：FinalVideo

```
FinalVideo (Aggregate Root)
├── id: string
├── projectId: string
├── episodeId: string
├── title: string
├── status: FinalVideoStatus       // draft | packaging | ready | published | failed
├── reviewStatus: string           // not_submitted | pending | in_review | approved | needs_fix | rejected
├── finalReviewId: string | null
├── sourceRenderJobId: string      // 后期制作渲染任务
├── sourceEditRevision: number     // 冻结的剪辑工程 revision
├── artifactRevision: number       // 每次成功打包 +1
├── approvedArtifactRevision: number | null
├── sourceShotIds: string[]        // 来源分镜 ID 列表（仅持有 ID）
├── videoUrl: string | null        // 成片文件路径
├── thumbnailUrl: string | null
├── duration: number               // 时长（秒）
├── resolution: string             // 分辨率
├── fileSize: number               // 文件大小（字节）
├── unpublishReason: string | null  // 撤销发布原因
├── unpublishedBy: string | null    // 撤销操作人 UserId
├── version: number
├── createdAt: string
├── updatedAt: string
└── deletedAt: string | null
```

### 1.1 状态机

```
┌────────┐  package  ┌───────────┐  complete  ┌────────┐  publish  ┌───────────┐
│ draft  │─────────▶│ packaging │───────────▶│ ready  │──────────▶│ published │
└────────┘          └─────┬─────┘            └────────┘          └─────┬─────┘
                          │ fail                                   │ unpublish
                          ▼                                        ▼
                    ┌────────┐                              ┌────────┐
                    │ failed │──retry(package)─────────────▶│packaging│
                    └────────┘                              └────────┘
                                                                     │
                                                                     │ re-package
                                                                     ▼
                                                              ┌────────┐
                                                              │ ready  │
                                                              └────────┘
```

> **`published` 语义说明（成片已发布）**：本上下文中 `FinalVideo` 的 `published` 表示**成片已发布**——即成片已发布到外部平台（如 B 站/抖音），是发布交付流程的**终态**，关注的是"外发完成"。此语义与[资产库上下文](04-asset-library.md)中资产（角色/场景/道具）的 `published`（资产可被分镜引用的生命周期阶段、属中间态）**含义不同**，详见 [glossary.md "已发布"语义区分说明](../glossary.md)。

### 1.2 命令

| 命令 | 前置状态 | 产出事件 | 说明 |
|------|---------|---------|------|
| `CreateFinalVideo` | 不存在 | `FinalVideoCreated` | 仅允许由 `RenderCompleted` 创建，记录 RenderJob 和剪辑 revision |
| `StartPackaging` | draft / failed / ready | `PackagingStarted` | 触发打包（失败后直接重试；撤销发布后 ready 状态可重新打包） |
| `CompletePackaging` | packaging | `PackagingCompleted` | 打包完成 |
| `FailPackaging` | packaging | `PackagingFailed` | 打包失败 |
| `SubmitFinalVideoForReview` | ready | `FinalVideoReviewSubmitted` | 创建 final_video 两级审核 |
| `MarkFinalVideoApproved` | ready | `FinalVideoApproved` | 由最终 `ReviewApproved` 驱动并绑定 artifactRevision |
| `PublishFinalVideo` | ready | `FinalVideoPublished` | 仅由 PublishPlan 成功回调执行；要求审核和预检均通过 |
| `UnpublishFinalVideo` | published | `FinalVideoUnpublished` | 撤销发布，回退到 ready（可重新发布）。需记录撤销原因和操作人 |
| `SoftDeleteFinalVideo` | draft / ready / failed（非已发布、非打包中） | `FinalVideoDeleted` | 软删除 |

### 1.3 不变量

- 创建成片前，RenderJob 必须 completed，且其全部来源分镜必须 approved。
- 发布前 `reviewStatus` 必须为 approved，且 `approvedArtifactRevision = artifactRevision`。
- 已发布的成片不可删除，可通过 `UnpublishFinalVideo` 撤销发布。
- 撤销发布需记录撤销原因（`unpublishReason`）和操作人（`unpublishedBy`）。
- 打包中不可重复触发打包（`StartPackaging` 时校验 status 不在 `packaging`）。
- `unpublish → ready` 后设置 `approvedArtifactRevision = null`；必须重新打包、重新终审并通过发布预检后才能再次发布。
- 项目归档后（收到 `ProjectArchived` 事件），本上下文所有成片和发布计划标记为只读，拒绝执行 `CreateFinalVideo` / `StartPackaging` / `PublishFinalVideo` / `UnpublishFinalVideo` / `CreatePublishPlan` / `SchedulePublishPlan` / `ExecutePublishPlan` 等写命令；项目恢复后（`ProjectRestored`）解除只读。

### 1.4 领域事件

| 事件 | Payload | 消费者 |
|------|---------|-------|
| `FinalVideoCreated` | finalVideoId, projectId, episodeId | 智能助手 |
| `PackagingStarted` | finalVideoId, projectId | 智能助手 |
| `PackagingCompleted` | finalVideoId, projectId, videoUrl | 智能助手 |
| `PackagingFailed` | finalVideoId, projectId, errorMessage | 智能助手（创建工作项）、通知（告警剪辑/制片人） |
| `FinalVideoReviewSubmitted` | finalVideoId, projectId, artifactRevision | 审核质量（创建 final_video Review） |
| `FinalVideoApproved` | finalVideoId, projectId, reviewId, artifactRevision | 发布交付（允许发布预检）、智能助手 |
| `FinalVideoPublished` | finalVideoId, projectId | 项目管控（更新项目进度）、智能助手（创建发布确认工作项） |
| `FinalVideoUnpublished` | finalVideoId, projectId, reason, operator | 项目管控（更新项目进度） |
| `FinalVideoDeleted` | finalVideoId, projectId | 智能助手 |

---

## 2. 聚合根：PublishPlan

```
PublishPlan (Aggregate Root)
├── id: string
├── projectId: string
├── name: string
├── status: PublishPlanStatus       // draft | scheduled | executing | completed | failed | cancelled
├── platform: string                // bilibili | douyin | youtube | ...
├── adapterVersion: string           // 冻结的平台适配器版本
├── credentialRef: string            // 凭据引用；聚合不持有密钥
├── scheduledAt: string             // 计划发布时间
├── finalVideoIds: string[]         // 关联成片 ID 列表
├── account: PublishAccount         // 发布账号（值对象）
├── visibility: string              // public | paid | members
├── tags: string[]
├── description: string
├── precheck: PublishPrecheck | null
├── retryCount: number
├── maxRetry: number
├── records: PublishRecord[]
├── failReason: string | null       // 失败原因
├── version: number
├── createdAt: string
├── updatedAt: string
└── completedAt: string | null
```

### 2.1 状态机

```
┌────────┐  schedule  ┌───────────┐  execute  ┌───────────┐  complete  ┌───────────┐
│ draft  │──────────▶│ scheduled │─────────▶│ executing │───────────▶│ completed │
└───┬────┘           └─────┬─────┘           └─────┬─────┘            └───────────┘
    │ cancel                │ cancel                │ fail
    ▼                       ▼                       ▼
┌──────────┐          ┌──────────┐          ┌────────┐  schedule  ┌───────────┐
│cancelled │          │cancelled │          │ failed │───────────▶│ scheduled │
└──────────┘          └──────────┘          └────────┘            └───────────┘
                                                            (重新排定再执行)
```

### 2.2 命令

| 命令 | 前置状态 | 产出事件 | 说明 |
|------|---------|---------|------|
| `CreatePublishPlan` | 不存在 | `PublishPlanCreated` | 创建发布计划 |
| `RunPublishPrecheck` | draft / failed | `PublishPrecheckCompleted` | 校验审核、资产、字幕、分辨率、时长和平台规则 |
| `SchedulePublishPlan` | draft / failed | `PublishPlanScheduled` | 仅预检通过后排定（失败后重新排定） |
| `ExecutePublishPlan` | scheduled | `PublishPlanExecutionStarted` | 执行发布 |
| `CompletePublishPlan` | executing | `PublishPlanCompleted`, `PublishRecordCreated` | 发布完成并保存外部链接和平台响应摘要 |
| `FailPublishPlan` | executing | `PublishPlanFailed` | 发布失败（记录原因） |
| `CancelPublishPlan` | draft / scheduled | `PublishPlanCancelled` | 取消发布计划 |
| `ReconcilePublishResult` | executing / failed | `PublishResultReconciled` | 按平台 requestId 查询最终状态，处理请求超时但平台已成功 |
| `CapturePublishMetrics` | completed | `PublishMetricsCaptured` | 在授权和合规允许时追加不可变指标快照 |

### 2.3 不变量

- 已完成的发布计划不可删除，只能撤销（通过创建新的取消操作记录——实际上 `completed` 是终态，无命令可再操作）。
- 排定前关联成片必须为 ready、最终审核通过、审核版本等于当前 artifactRevision，且预检全部通过。
- 执行中的计划不可修改关联成片。
- 失败后可重新排定（`failed → scheduled`）。
- 每次执行无论成功或失败都创建不可变 PublishRecord；外部请求使用 planId + retryCount 作为幂等键。
- 一个 PublishPlan 只对应一个平台账号；“多平台同步发布”由应用服务创建同一 batchId 下的多个计划，单平台失败不回滚其他平台成功结果。
- 聚合只保存 `credentialRef`，密钥由平台安全配置解析，响应、日志和审计均不得写入访问令牌。
- 适配器错误必须分类为 `retryable/non_retryable/unknown_result`；unknown_result 先对账，禁止直接重发造成重复发布。
- 自动重试使用指数退避和平台 Retry-After，最多 maxRetry；认证、合规、参数错误不可自动重试。
- 发布成功必须保存外部内容 ID、URL 和平台回执摘要；平台返回成功但回执持久化失败时，通过幂等查询恢复。

### 2.4 领域事件

| 事件 | Payload | 消费者 |
|------|---------|-------|
| `PublishPlanCreated` | planId, projectId, platform | 智能助手 |
| `PublishPlanScheduled` | planId, projectId, scheduledAt | 智能助手 |
| `PublishPlanExecutionStarted` | planId, projectId | 智能助手 |
| `PublishPlanCompleted` | planId, projectId, platform | 智能助手、项目管控 |
| `PublishPrecheckCompleted` | planId, projectId, passed, failures[] | 智能助手 |
| `PublishRecordCreated` | recordId, planId, platform, status, externalUrl | 智能助手（发布历史） |
| `PublishPlanFailed` | planId, projectId, failReason | 智能助手（创建工作项）、通知（告警发布运营/制片人） |
| `PublishResultReconciled` | planId, recordId, finalStatus, externalId, externalUrl | 智能助手、通知 |
| `PublishMetricsCaptured` | planId, recordId, capturedAt, metrics | 发布效果读模型、数据中心 |
| `PublishPlanCancelled` | planId, projectId | 智能助手 |

---

## 3. 值对象

| 值对象 | 字段 | 说明 |
|-------|------|------|
| `PublishAccount` | `platform: string`, `accountId: string`, `accountName: string` | 发布账号 |
| `PublishPrecheck` | `passed: boolean`, `checkedAt: string`, `failures: PrecheckFailure[]`, `artifactRevisions: Record<string, number>` | 发布预检不可变结果；成片版本变化后自动失效 |
| `PublishRecord` | `id`, `planId`, `batchId`, `attempt`, `status`, `providerRequestId`, `externalId`, `externalUrl`, `responseCode`, `errorCode`, `startedAt`, `completedAt` | 单次外部发布执行记录，不可修改或删除 |
| `PublishMetricSnapshot` | `recordId`, `capturedAt`, `views`, `likes`, `comments`, `shares`, `watchTime`, `rawDigest` | 渠道允许时采集的不可变效果快照；缺失保持 null，不伪造 |

## 4. 平台适配器契约

```ts
interface PublishPlatformAdapter {
  readonly platform: string;
  readonly version: string;
  validateAccount(credentialRef: string): Promise<AccountSummary>;
  getRules(): Promise<PlatformPublishRules>;
  precheck(input: PublishArtifactSnapshot): Promise<PlatformPrecheckResult>;
  publish(input: PublishRequest, idempotencyKey: string): Promise<PublishProviderResult>;
  query(providerRequestId: string): Promise<PublishProviderResult>;
  unpublish(externalId: string, idempotencyKey: string): Promise<void>;
  fetchMetrics(externalId: string, cursor?: string): Promise<MetricPage>;
}
```

- 适配器负责平台字段、分辨率/时长/封面、认证、限流和回执翻译；核心域不写死渠道规则。
- 适配器必须提供契约测试：幂等、限流、超时未知结果、认证过期、平台拒绝、重复内容和回执缺字段。
- 首发可启用 bilibili/douyin/youtube/self_hosted 中已通过真实沙箱/测试账号验收的适配器；未通过者不在 UI 标记可用。
