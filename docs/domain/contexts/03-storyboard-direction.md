# 3.3 分镜导演上下文 (Storyboard Direction)

> **所属上下文**：分镜导演 (Storyboard Direction)
> **聚合根**：`Shot` / `Storyboard`（后期 Timeline 已迁移到 §3.9 `EditProject`）
> **对应页面**：分镜导演台、分镜板
> **配套规范**：[DDD 治理规范](../02-governance.md)｜[统一语言术语表](../03-glossary.md)｜[上下文映射](../04-context-map.md)｜[跨上下文协作契约](../05-contracts.md)

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
├── composition: CompositionSpec     // 画幅、安全区、主体位置、视觉动线
├── visualLayers: VisualLayer[]      // 背景/角色/道具/前景/遮罩图层
├── textOverlays: TextOverlay[]      // 对白气泡/思考气泡/旁白/标题/拟声词
├── comicEffects: ComicEffectCue[]   // 参数化漫画特效
├── motionCues: MotionCue[]          // 图层级有限动态
├── presentationSnapshot: PresentationSnapshot | null // 当前送审/渲染表现快照
├── adoptedImageVersionId: string | null
├── adoptedVideoVersionId: string | null
├── mediaCandidates: MediaCandidate[] // 图片/视频候选实体；URL 不是业务引用
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
| `UpdateComposition` | draft / needs_fix | `ShotCompositionUpdated` | 更新画幅、安全区、主体锚点、景深和视觉动线 |
| `UpsertVisualLayer` | draft / needs_fix | `ShotVisualLayerUpserted` | 新增或更新背景/角色/道具/前景/遮罩图层及资产版本 |
| `RemoveVisualLayer` | draft / needs_fix | `ShotVisualLayerRemoved` | 删除未被文字、特效或 MotionCue 引用的图层 |
| `UpsertTextOverlay` | draft / needs_fix | `ShotTextOverlayUpserted` | 新增或更新对白气泡、旁白、标题或拟声词 |
| `RemoveTextOverlay` | draft / needs_fix | `ShotTextOverlayRemoved` | 删除文字叠层并清理其受控音效关联 |
| `UpsertComicEffect` | draft / needs_fix | `ShotComicEffectUpserted` | 新增或更新受控漫画特效及模板版本 |
| `RemoveComicEffect` | draft / needs_fix | `ShotComicEffectRemoved` | 删除特效 |
| `UpsertMotionCue` | draft / needs_fix | `ShotMotionCueUpserted` | 新增或更新时间范围、目标图层和缓动参数 |
| `RemoveMotionCue` | draft / needs_fix | `ShotMotionCueRemoved` | 删除有限动态指令 |
| `BindAssetToShot` | draft / needs_fix | `ShotAssetBound` | 绑定已发布的角色/场景/道具及版本 |
| `UnbindAssetFromShot` | draft / needs_fix | `ShotAssetUnbound` | 解除资产绑定 |
| `AttachGeneratedImage` | generating / ready / needs_fix | `ShotImageCandidateAttached` | 附加图片候选版本，不改变当前采纳结果 |
| `AdoptImageCandidate` | generating / ready / needs_fix | `ImageAdopted` | 采纳一个图片候选确切版本并冻结 AI 执行与输入快照来源 |
| `ArchiveMediaCandidate` | ready / needs_fix | `MediaCandidateArchived` | 仅归档无当前采纳关系的候选；保留来源证据 |
| `MarkShotReady` | draft / needs_fix | `ShotMarkedReady` | 标记分镜为就绪状态 |
| `StartShotGeneration` | ready | `ShotGenerationStarted` | 冻结生成输入（当前构图/图层/文字/特效/动态、Prompt、模型与资产版本）并触发 AI 图片或视频生成 |
| `AttachGeneratedVideo` | generating | `ShotVideoCandidateAttached` | 附加生成的视频候选 |
| `AdoptVideoCandidate` | generating / ready / needs_fix | `VideoAdopted` | 采纳一个视频候选确切版本并冻结 AI 执行与表现快照来源 |
| `SubmitShotForReview` | ready | `ShotPresentationFrozen`, `ShotSubmittedForReview` | 同一聚合事务内生成不可变表现快照并提交审核 |
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
| `ShotGenerationStarted` | shotId, storyboardId, projectId, mediaType, generationInputSnapshotHash, dependencyRefs | AI任务调度（创建生成任务）、智能助手（DEP 登记输入） |
| `ShotImageCandidateAttached` | shotId, storyboardId, candidateId, parentCandidateId, mediaVersionId, taskId, executionSnapshotHash, generationIntentHash | 智能助手（候选树投影） |
| `ShotVideoCandidateAttached` | shotId, storyboardId, candidateId, parentCandidateId, mediaVersionId, taskId, executionSnapshotHash, generationIntentHash | 智能助手（候选树投影） |
| `ImageAdopted` | shotId, candidateId, mediaVersionId, previousCandidateId, taskId, executionSnapshotHash, generationInputSnapshotHash, adoptedBy, adoptedAt | 智能助手（DEP、候选树与审核失效投影） |
| `VideoAdopted` | shotId, candidateId, mediaVersionId, previousCandidateId, taskId, executionSnapshotHash, presentationSnapshotHash, adoptedBy, adoptedAt | 智能助手（DEP、候选树与审核失效投影） |
| `MediaCandidateArchived` | shotId, candidateId, mediaVersionId, archivedBy, reason | 智能助手（候选树投影） |
| `ShotAssetBound` | shotId, projectId, assetType, assetId, assetVersion | 资产库（引用计数 +1） |
| `ShotAssetUnbound` | shotId, projectId, assetType, assetId, assetVersion | 资产库（引用计数 -1） |
| `ShotPresentationFrozen` | shotId, snapshotId, snapshotHash, shotVersion, dependencyRefs[] | 审核质量、后期制作（只引用冻结快照）、智能助手（DEP 依赖投影） |
| `ShotSubmittedForReview` | shotId, storyboardId, projectId, snapshotId, snapshotHash | 审核质量（创建 Review 聚合） |
| `ShotApproved` | shotId, storyboardId, projectId, reviewId | 分镜导演（更新 Storyboard 派生状态）、智能助手 |
| `ShotRejected` | shotId, storyboardId, projectId, reviewId, reason | 智能助手（创建返工工作项） |
| `ShotFixRequested` | shotId, storyboardId | 智能助手 |
| `ShotArchived` | shotId, storyboardId | 分镜导演（从 shotIds 移除引用） |
| `ShotDeleted` | shotId, storyboardId | 智能助手 |

### 1.4 不变量

- 未具备生成结果的分镜不能送审。
- 送审前必须选择唯一的当前候选结果；审核对象记录候选版本，不得只引用可变 URL。
- 候选附加与候选采纳是两个动作；Provider 完成任务不得自动覆盖当前采纳版本。
- 被采纳候选必须记录不可变 `mediaVersionId`、AITask 执行快照哈希和生成输入/表现快照哈希。
- 同一生成意图候选数必须为 1～4；`parentCandidateId` 存在时必须指向本 Shot 同媒体类型的已有候选，且候选关系无环。
- 重新采纳必须递增 Shot 版本并保留 `previousCandidateId`；若当前存在审核/剪辑引用，发布影响事件使旧结论进入失效评估，不得静默继承。
- 被采纳、送审、剪辑或追溯引用的候选不可物理删除；归档只影响默认列表展示。
- 绑定资产必须属于同一项目且处于 published 状态。
- 生成时必须冻结 Prompt、模型配置、一致性包和资产版本。
- 生成输入快照还必须包含当前构图、画面层、文字叠层、漫画特效和 MotionCue；回调必须关联该输入哈希，过期回调不能覆盖新版本。
- `MarkShotReady` 前必须通过画幅安全区、文字越界/重叠、资产发布状态、特效 schema、MotionCue 冲突和时长校验。
- 对白气泡必须引用当前 Script 发布版本中的对白行和说话角色；剧本变更只产生差异提示，不静默覆盖人工排版。
- 拟声词可关联 SFX AudioAsset 版本；修改时间范围时必须同步更新或显式解除关联。
- MotionCue 的目标图层必须存在；同一图层同一属性的重叠区间必须有确定优先级，否则拒绝保存。
- 光敏风险特效超过项目策略阈值时阻止送审；人工豁免必须有权限、原因和 AuditRecord。
- 送审和渲染只能引用 `PresentationSnapshot`；快照不可变，任一依赖改变必须生成新快照并使旧审核结论失效。
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

> **聚合内引用规则**：Storyboard 通过 `shotIds: string[]` 引用 Shot 聚合（仅持有 ID，不持有对象），详见[依赖方向约束](../09-dependency-rules.md)。

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

### 2.4 Shot–Storyboard 事务边界

`Storyboard` 与 `Shot` 是两个聚合，但当前单体/SQLite 部署中的结构性命令必须通过同一 `UnitOfWork` 原子提交，禁止先写一个聚合再以“最终一致”掩盖用户可见半成品。

| 操作 | 同一事务内必须完成 | 失败处理 |
|---|---|---|
| `AddShot` | 校验 Storyboard 版本 → 创建 Shot → 追加 `shotIds`/更新计数 → 写 Shot/Storyboard 事件与 Outbox | 任一步失败全部回滚；同一 commandId 返回已提交结果 |
| `RemoveShot` | 校验两聚合版本 → 归档 Shot → 从有效 `shotIds` 移除 → 写事件与 Outbox | 任一步失败全部回滚；已送审/批准 Shot 必须先进入允许状态 |
| `ReorderShots` | 校验请求集合与现有有效 `shotIds` 完全一致 → 更新顺序/rank → 写事件与 Outbox | 版本冲突返回最新 Storyboard 版本，不做部分排序 |

事务规则：

- `UnitOfWork.commit` 同时持久化两个聚合和 Outbox；事件不得在数据库提交前对外发布。
- 同时按固定顺序加锁/校验：先 Storyboard，后 Shot，避免并发死锁语义不确定。
- `expectedStoryboardVersion` 与涉及的 `expectedShotVersion` 均为命令必填；冲突使用统一 `aggregate_version_conflict`。
- 重试使用 `commandId/idempotencyKey`；成功响应需持久化以便完全重放，不能重复创建 Shot。
- 未来拆服务时必须先设计 Saga、孤儿 Shot 补偿和可观测恢复，再允许取消本地原子事务。

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

## 4. 漫剧表现值对象与内部实体

```text
CompositionSpec
├── aspectRatio: "9:16" | "16:9" | string
├── safeAreaTemplateId: string | null
├── subjectAnchors: SubjectAnchor[]
├── depthPlan: string | null
└── visualFlow: left_to_right | right_to_left | center | custom

VisualLayer
├── id: string
├── type: background | character | prop | foreground | mask
├── zIndex: number
├── assetId: string | null
├── assetVersion: number | null
├── transform: { x, y, scaleX, scaleY, rotation, opacity }
├── visibleFromMs: number
└── visibleToMs: number

TextOverlay
├── id: string
├── type: dialogue_bubble | thought_bubble | narration_box | title | onomatopoeia
├── text: string
├── scriptLineId: string | null
├── speakerCharacterId: string | null
├── typography: TypographySpec
├── bounds: Rect
├── visibleFromMs: number
├── visibleToMs: number
├── sfxAudioAssetId: string | null
└── sfxAudioAssetVersion: number | null

ComicEffectCue
├── id: string
├── type: speed_lines | focus_lines | impact | flash | shake | color_tone | depth_blur | grain
├── schemaVersion: number
├── parameters: Record<string, scalar>
├── maskLayerId: string | null
├── startMs: number
└── endMs: number

MotionCue
├── id: string
├── targetLayerId: string
├── property: translate | scale | rotate | opacity | parallax | shake | loop | lip_sync
├── startMs: number
├── endMs: number
├── fromValue: scalar | vector
├── toValue: scalar | vector
├── easing: string
└── priority: number

MediaCandidate
├── id: string
├── mediaType: image | video
├── mediaVersionId: string
├── parentCandidateId: string | null
├── taskId: string
├── generationIntentHash: string
├── generationInputSnapshotHash: string
├── executionSnapshotHash: string
├── qcReportId: string | null
├── lifecycle: available | archived
├── attachedAt: string
└── archivedAt: string | null

PresentationSnapshot
├── id: string
├── hash: string
├── shotVersion: number
├── scriptVersion: number
├── assetVersions: { type, id, version }[]
├── audioVersions: { id, version }[]
├── fontLicenses: { fontId, licenseId }[]
├── promptAndModelSnapshot: object
├── compositionAndCueSnapshot: object
└── frozenAt: string
```

所有坐标使用归一化画布坐标，时间使用整数毫秒。`PresentationSnapshot.hash` 对规范化序列化结果计算，禁止把可变 URL 或非确定字段纳入哈希。
