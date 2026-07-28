# 3.3 分镜导演上下文 (Storyboard Direction)

> **所属上下文**：分镜导演 (Storyboard Direction)
> **聚合根**：`Shot` / `Storyboard`（后期 Timeline 已迁移到 §3.9 `EditProject`）
> **对应页面**：分镜导演台、分镜板
> **配套规范**：[DDD 治理规范](../governance.md)｜[统一语言术语表](../glossary.md)｜[上下文映射](../context-map.md)｜[跨上下文协作契约](../contracts.md)

**边界**：分镜的创建、编辑、生成、送审、版本管理；分镜板管理；时间线编辑。

> **事件表说明**：聚合的"领域事件"表仅列出有消费者的关键事件。命令表"产出事件"列是事件全量来源。

---

## 1. 聚合根：Shot

```
Shot (Aggregate Root)
├── id: string
├── projectId: string
├── episodeId: string
├── storyboardId: string            // 所属分镜板 ID
├── order: number                   // 分镜顺序
├── status: ShotStatus              // draft | generating | ready | in_review | approved | rejected | needs_fix | archived
├── shotType: string                // 镜头类型（特写/中景/全景等）
├── angle: string                   // 角度
├── movement: string                // 运镜
├── dialogue: string | null         // 对白
├── actionDescription: string       // 动作描述
├── duration: number                // 预估时长（秒）
├── videoUrl: string | null         // 生成视频 URL
├── videoCandidateUrls: string[]    // 候选视频 URL 列表
├── selectedImageId: string | null  // 已选分镜图版本
├── imageCandidateIds: string[]     // 图片候选版本
├── assetBindings: ShotAssetBinding[] // 角色/场景/道具版本化引用
├── promptTemplateId: string | null
├── promptTemplateVersion: number | null
├── resolvedPromptSnapshot: string | null
├── reviewId: string | null         // 关联审核 ID
├── version: number
├── createdAt: string
├── updatedAt: string
└── deletedAt: string | null
```

### 1.1 状态机（8 态）

```
                                    ┌──────────┐
                              ┌────▶│ archived │
                              │     └────┬─────┘
                              │          │ restore
                              │          ▼
┌────────┐  markReady  ┌────────┐  submitForReview  ┌───────────┐  approve  ┌──────────┐
│ draft  │────────────▶│ ready  │─────────────────▶│ in_review │──────────▶│ approved │
└───┬────┘             └───┬────┘                  └─────┬─────┘           └────┬─────┘
    │ startGeneration       │ startGeneration             │ reject                │ requestFix
    ▼                       ▼                            ▼                       ▼
┌────────────┐  attachGeneratedVideo  ┌────────┐  ┌──────────┐  requestFix  ┌──────────┐
│ generating │───────────────────────▶│ ready  │  │ rejected │────────────▶│ needs_fix│
└────────────┘                        └────────┘  └────┬─────┘             └────┬─────┘
                                                      │                        │
                                                      │ archive                │ submitForReview
                                                      ▼                        ▼
                                                 ┌──────────┐            ┌───────────┐
                                                 │ archived │            │ in_review │
                                                 └──────────┘            └───────────┘

archive 命令: draft / ready / rejected / needs_fix / approved → archived
restore 命令: archived → ready（恢复到可编辑态）
softDelete 命令: draft / needs_fix（非 approved）→ deleted（软删除，不在状态机主图）
```

> **状态转换说明**：`approved` 分镜不可直接删除，必须先 `RequestShotFix` 回退到 `needs_fix` 再走 `ArchiveShot` 或 `SoftDeleteShot` 路径。`generating` 和 `in_review` 为中间态，不可直接 `ArchiveShot`。

### 1.2 命令

| 命令 | 前置状态 | 产出事件 | 说明 |
|------|---------|---------|------|
| `CreateShot` | 不存在 | `ShotCreated` | 在分镜板中创建新分镜 |
| `EditShotMetadata` | draft / needs_fix | `ShotMetadataEdited` | 编辑分镜元数据（镜头类型/角度/运镜/对白/动作描述/时长） |
| `BindAssetToShot` | draft / needs_fix | `ShotAssetBound` | 绑定已发布的角色/场景/道具及版本 |
| `UnbindAssetFromShot` | draft / needs_fix | `ShotAssetUnbound` | 解除资产绑定 |
| `SelectImageCandidate` | generating / ready / needs_fix | `ShotImageSelected` | 选择当前图片候选并冻结来源 |
| `MarkShotReady` | draft / needs_fix | `ShotMarkedReady` | 标记分镜为就绪状态 |
| `StartShotGeneration` | ready | `ShotGenerationStarted` | 触发 AI 视频生成 |
| `AttachGeneratedVideo` | generating | `ShotVideoCandidateAttached` | 附加生成的视频候选 |
| `SubmitShotForReview` | ready | `ShotSubmittedForReview` | 提交审核（触发审核质量上下文创建 Review） |
| `ApproveShot` | in_review | `ShotApproved` | 审核通过（由审核质量上下文 `ReviewApproved` 事件驱动） |
| `RejectShot` | in_review | `ShotRejected` | 审核驳回（由审核质量上下文 `ReviewRejected` 事件驱动） |
| `RequestShotFix` | in_review / approved | `ShotFixRequested` | 请求返工，回退到 needs_fix |
| `ArchiveShot` | draft / ready / rejected / needs_fix / approved | `ShotArchived` | 归档分镜 |
| `RestoreShot` | archived | `ShotRestored` | 恢复归档分镜到 ready |
| `SoftDeleteShot` | draft / needs_fix | `ShotDeleted` | 软删除（非 approved 状态） |

### 1.3 领域事件

| 事件 | Payload | 消费者 |
|------|---------|-------|
| `ShotCreated` | shotId, storyboardId, projectId, episodeId | 智能助手 |
| `ShotMarkedReady` | shotId, storyboardId | — |
| `ShotGenerationStarted` | shotId, storyboardId, projectId | AI任务调度（创建生成任务） |
| `ShotVideoCandidateAttached` | shotId, storyboardId, videoUrl | 智能助手 |
| `ShotAssetBound` | shotId, projectId, assetType, assetId, assetVersion | 资产库（引用计数 +1） |
| `ShotAssetUnbound` | shotId, projectId, assetType, assetId, assetVersion | 资产库（引用计数 -1） |
| `ShotSubmittedForReview` | shotId, storyboardId, projectId | 审核质量（创建 Review 聚合） |
| `ShotApproved` | shotId, storyboardId, projectId, reviewId | 分镜导演（更新 Storyboard 派生状态）、智能助手 |
| `ShotRejected` | shotId, storyboardId, projectId, reviewId, reason | 智能助手（创建返工工作项） |
| `ShotFixRequested` | shotId, storyboardId | 智能助手 |
| `ShotArchived` | shotId, storyboardId | 分镜导演（从 shotIds 移除引用） |
| `ShotDeleted` | shotId, storyboardId | 智能助手 |

### 1.4 不变量

- 未具备生成结果的分镜不能送审。
- 送审前必须选择唯一的当前候选结果；审核对象记录候选版本，不得只引用可变 URL。
- 绑定资产必须属于同一项目且处于 published 状态。
- 生成时必须冻结 Prompt、模型配置、一致性包和资产版本。
- 已审核分镜不能通过普通删除入口删除。
- 审核结果必须关联有效 `reviewId`。
- 重复生成回调不能覆盖人工返工后的新状态（通过 `version` 乐观锁校验）。

---

## 2. 聚合根：Storyboard

```
Storyboard (Aggregate Root)
├── id: string
├── projectId: string
├── episodeId: string
├── scriptDocumentId: string       // 关联的剧本文档
├── status: StoryboardStatus       // draft | generating | ready | archived
├── shotCount: number
├── approvedCount: number
├── version: number
├── createdAt: string
├── updatedAt: string
└── editProjectId: string | null   // 后期制作上下文剪辑工程 ID
```

> **聚合内引用规则**：Storyboard 通过 `shotIds: string[]` 引用 Shot 聚合（仅持有 ID，不持有对象），详见[依赖方向约束](../dependency-rules.md)。

### 2.1 命令

| 命令 | 前置状态 | 产出事件 | 说明 |
|------|---------|---------|------|
| `CreateStoryboard` | 不存在 | `StoryboardCreated` | 从已发布剧本文档创建分镜板 |
| `AddShot` | draft / generating | `ShotAdded` | 添加分镜（创建 Shot 聚合，shotIds 追加） |
| `ReorderShots` | draft / generating | `ShotsReordered` | 调整分镜顺序（仅更新 shotIds 顺序） |
| `RemoveShot` | draft / generating | `ShotRemoved` | 从 shotIds 移除（Shot 聚合单独归档） |
| `ArchiveStoryboard` | 任意非 archived | `StoryboardArchived` | 归档分镜板 |

### 2.2 状态机

```
┌────────┐  (任一 Shot startGeneration)  ┌────────────┐  (全部分镜 approved)  ┌────────┐
│ draft  │─────────────────────────────▶│ generating │─────────────────────▶│ ready  │
└───┬────┘                               └─────┬──────┘                      └────┬───┘
    │                                          │                                  │
    │ (全部分镜 draft 或 无 Shot)               │ (生成失败/取消)                   │ archive
    │◀─────────────────────────────────────────┘                                  │
    │                                                                             ▼
    │                                          archive                      ┌──────────┐
    └──────────────────────────────────────────────────────────────────────▶│ archived │
                                                                               └──────────┘
```

> **状态派生说明**：`generating` 和 `ready` 是从 Storyboard 内 Shot 聚合状态派生的——当任一 Shot 进入 `generating` 状态时 Storyboard 自动转为 `generating`；当所有 Shot 均处于 `approved` 时自动转为 `ready`。`draft` 到 `generating` 和 `generating` 到 `ready` 的转换由 Shot 状态变更事件（`ShotGenerationStarted` / `ShotApproved`）驱动，不需要显式命令。

### 2.3 不变量

- 分镜顺序变更不影响各 Shot 的状态。
- Shot 归档/删除后，Storyboard 从 `shotIds` 数组中移除该引用（保留历史快照但不参与排序）。

---

## 3. 值对象：ShotAssetBinding

```text
ShotAssetBinding
├── assetType: character | scene | prop
├── assetId: string
├── assetVersion: number
├── usage: primary | reference
└── boundAt: string
```

剪辑、音频、字幕和渲染统一由[后期制作上下文](09-post-production.md)负责。Storyboard 仅保存 `editProjectId`，避免跨上下文持有对象。
