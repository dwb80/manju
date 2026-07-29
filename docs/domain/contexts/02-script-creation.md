# 3.2 剧本创作上下文 (Script Creation)

> **所属上下文**：剧本创作 (Script Creation)
> **聚合根**：`Script`（含内部实体 `ScriptDocument` / `ScriptComment` / 值对象 `ScriptAnalysis`）、`ScriptCreationTask`（AI 辅助创作任务）
> **对应页面**：剧本中心
> **配套规范**：[DDD 治理规范](../02-governance.md)｜[统一语言术语表](../03-glossary.md)｜[上下文映射](../04-context-map.md)｜[跨上下文协作契约](../05-contracts.md)

**边界**：剧本的创建、编辑、版本管理、AI 分析（角色/场景/道具提取）、AI 辅助创作（生成/优化/改写/拆场景/拆分镜）。

> **事件表说明**：聚合的"领域事件"表仅列出有消费者的关键事件。命令表"产出事件"列是事件全量来源。

---

## 1. 聚合根：Script

```
Script (Aggregate Root)
├── id: string
├── projectId: string
├── episodeId: string
├── title: string
├── content: string               // 剧本正文
├── status: ScriptStatus          // draft | analyzing | analyzed | published
├── currentVersion: number
├── previousVersionId: string | null  // 上一版本 ID（版本链）
├── analyzedAt: string | null
├── analysisStatus: string | null  // stale | valid（分析结果新鲜度）
├── analysisRevision: number       // 当前分析结果版本号，每次重新分析 +1
├── version: number               // 乐观锁
├── createdAt: string
├── updatedAt: string
├── deletedAt: string | null
├── documents: ScriptDocument[]   // 版本快照
├── comments: ScriptComment[]     // 协作批注
└── analysis: ScriptAnalysis      // 分析结果（值对象）
```

### 1.1 状态机

```
                    analyze                   complete
┌────────┐ ──────────────────────▶ ┌───────────┐ ──────────▶ ┌──────────┐
│ draft  │                          │ analyzing │             │ analyzed │
└───┬────┘                          └─────┬─────┘             └────┬─────┘
    │                                     │ fail                   │
    │                                     ▼                        │ edit
    │                                ┌────────┐                    │ (auto-revert)
    │                                │ draft  │                    ▼
    │                                └────────┘               ┌────────┐
    ▲                                                        │ draft  │
    │                                                        └────────┘
    │  re-analyze (analysis 标记 stale)                          ▲
    └──────────────────────────────────────────────────────────┘
                          analyze
                       （从 analyzed 也可触发，
                        回到 analyzing，旧结果标记 stale）
```

### 1.2 命令

| 命令 | 前置状态 | 产出事件 | 说明 |
|------|---------|---------|------|
| `CreateScript` | 不存在 | `ScriptCreated` | 为剧集创建剧本 |
| `UpdateScript` | draft / analyzed | `ScriptUpdated` | 编辑剧本内容。在 `analyzed` 状态执行时自动回退到 `draft`，原分析结果标记为 `stale`（保留可追溯性） |
| `ImportScript` | 不存在 | `ScriptImported` | 从文件导入剧本 |
| `AnalyzeScript` | draft / analyzed | `ScriptAnalysisStarted` | 触发 AI 分析。在 `analyzed` 状态重新分析时 `analysisRevision + 1` 并将旧结果标记为 `stale` |
| `CompleteAnalysis` | analyzing | `ScriptAnalyzed` | 分析完成，产出角色/场景/道具草稿（payload 携带 `revision` 区分新旧分析结果） |
| `FailAnalysis` | analyzing | `ScriptAnalysisFailed` | 分析失败，回退到 `draft` |
| `PublishScript` | analyzed | `ScriptVersionPublished` | 发布版本，创建不可变 `ScriptDocument` 快照（仅当 `analysisStatus = valid` 时可执行） |
| `CreateNewVersion` | published | `ScriptNewVersionCreated` | 从已发布版本创建新草稿版本（版本号 +1），新版本引用 `previousVersionId` 形成版本链。已分镜引用的旧版本 `ScriptDocument` 保持不变 |
| `AddComment` | 任意非终态 | `ScriptCommentAdded` | 添加协作批注 |
| `ResolveComment` | 任意非终态 | `ScriptCommentResolved` | 解决批注 |
| `SoftDeleteScript` | draft / analyzed | `ScriptDeleted` | 软删除。`analyzing` 状态下不可删除（分析进行中可能正在写数据） |

### 1.3 不变量

- 已发布版本的 `content` 不可修改，只能通过 `CreateNewVersion` 创建新版本。
- `published` 不是终态，而是基线快照——允许 `CreateNewVersion` 创建可编辑的新版本。
- 新版本引用 `previousVersionId`，形成版本链。
- 已分镜引用的旧版本 `ScriptDocument` 保持不变，分镜继续引用旧版本。
- 分析进行中（`analyzing`）时不可编辑内容，也不可删除。
- 发布前必须完成至少一次有效分析（`analysisStatus = valid`）。
- 每次发布创建一个不可变的 `ScriptDocument` 版本快照。
- AI 分析产出的角色/场景/道具草稿不直接创建资产，需人工确认后通过命令进入资产库上下文。
- 在 `analyzed` 状态编辑内容后回退到 `draft`，原分析结果标记为 `stale`（不删除，保留可追溯性）。
- `analysisRevision` 单调递增，发布时记录当前 revision 用于追溯。
- 项目归档后（收到 `ProjectArchived` 事件），本上下文所有剧本资源标记为只读，拒绝执行 `UpdateScript` / `PublishScript` / `CreateNewVersion` / `AnalyzeScript` / `SoftDeleteScript` 等写命令；项目恢复后（`ProjectRestored`）解除只读。

### 1.4 领域事件

| 事件 | Payload | 消费者 |
|------|---------|-------|
| `ScriptCreated` | scriptId, projectId, episodeId | 智能助手 |
| `ScriptUpdated` | scriptId, projectId | 智能助手（刷新内容缓存） |
| `ScriptAnalyzed` | scriptId, projectId, characters[], scenes[], props[], revision | 资产库（创建资产草稿，待人工确认入库） |
| `ScriptAnalysisFailed` | scriptId, projectId, errorMessage | 通知（告警编剧/项目负责人） |
| `ScriptVersionPublished` | scriptId, projectId, version, documentId, documentHash, previousDocumentId, revision, changeSummary | 分镜导演（允许创建分镜板）、智能助手（DEP 影响评估） |
| `ScriptNewVersionCreated` | scriptId, projectId, previousVersionId, newVersion | 智能助手（更新版本列表） |
| `ScriptDeleted` | scriptId, projectId | 智能助手 |

### 1.5 值对象 / 内部实体

```
ScriptDocument (Entity)
├── id: string                    // 文档唯一标识
├── scriptId: string              // 所属剧本 ID
├── projectId: string             // 所属项目 ID
├── title: string                 // 剧本标题
├── author: string                // 作者
├── version: number               // 版本号
├── content: string               // 剧本正文快照（发布后不可变）
├── editorJson: string            // Tiptap 编辑器 JSON
├── format: string                // 文本格式：plain | markdown | json
├── genre: string                 // 剧本类型/题材：ancient | modern | scifi | fantasy | suspense | comedy | romance | 其他
├── words: number                 // 字数（从 editorJson 自动计算，可手填覆盖）
├── chapters: number              // 章节/剧集数（从 script_episodes 自动计算，可手填覆盖）
├── status: string                // 状态：draft | active | review | completed | archived
├── changeLog: string             // 版本变更说明
├── baseVersionId: string | null  // 基线版本 ID（版本链，指向上一已发布文档）
├── isCurrent: boolean            // 是否为当前活动版本
├── tags: string[]                // 标签
├── aiRawData: string             // 完整 AI 原始数据（JSON 字符串，仅剧本导入流程写入）
├── createdAt: string             // 创建时间
├── updatedAt: string             // 更新时间
└── deletedAt: string | null      // 软删除时间戳

ScriptEpisodeProjection (Compatibility Projection, not aggregate/entity truth)
├── id: string                    // 兼容 script_episodes 标识
├── projectEpisodeId: string      // 必填，指向 Project.Episode
├── documentId: string            // 所属 ScriptDocument
├── episodeNumber: number         // 从 Project.Episode 投影，不独立分配
├── title/synopsis: string        // 文档结构视图，可随文档版本变化
└── status: string                // 投影新鲜度/文档编辑状态，不承载业务 Episode 生命周期

ScriptAnalysis (Value Object)
├── revision: number              // 分析结果版本；在同一 Script 内单调递增
├── sourceDocumentId: string      // 本次分析所依据的确切 ScriptDocument；草稿分析时为临时快照 ID
├── analysisType: character | scene | prop | full
├── freshness: stale | valid      // 相对当前剧本内容的新鲜度；编辑后只能由 valid 变为 stale
├── characters: ScriptAnalyzedCharacter[]  // 提取的角色列表
├── scenes: ScriptAnalyzedScene[]         // 提取的场景列表
├── props: ScriptAnalyzedProp[]           // 提取的道具列表
├── relations: Relation[]         // 角色/场景/道具之间的关系
├── modelSnapshot: ModelExecutionSnapshot // 模型、Prompt、参数及输入哈希的不可变执行快照
└── completedAt: string           // 分析完成时间

ScriptAnalyzedCharacter (Value Object)
├── id: string                    // 角色 ID
├── documentId: string            // 所属剧本文档 ID
├── projectId: string             // 所属项目 ID
├── name: string                  // 角色名称
├── role: string                  // 角色定位（主角/配角/龙套）
├── gender: string                // 性别
├── age: string                   // 年龄
├── description: string           // 角色描述
├── appearance: string            // 外貌描述
├── personality: string           // 性格特征
├── traits: string[]              // 特征标签
├── tags: string[] | null         // 工厂标签（与 factory Character.tags 对齐）
├── factoryCharacterId: string | null  // 流转到角色工厂后的资产 ID
├── status: string                // 状态：extracted | confirmed | transferred
├── identity: string | null       // 角色身份（如剑客、公主、侦探）
├── face: string | null           // 面部特征
├── hair: string | null           // 发型、发色、长度
├── body: string | null           // 身材体型
├── temperament: string | null    // 气质（如优雅、粗犷、冷峻）
├── costumeName: string | null    // 服装名称
├── costumeDescription: string | null  // 服装详细描述
├── costumeColor: string | null   // 服装主色调
├── costumeMaterial: string | null // 服装材质
├── costumeStyle: string | null   // 服装风格
├── accessories: string[] | null  // 配饰列表（如玉佩、耳环、腰带）
├── emotionStates: string | null  // 情绪状态（JSON 数组字符串）
├── actionAssets: string | null   // 动作资产（JSON 数组字符串）
├── relationships: string | null  // 人物关系（JSON 数组字符串）
├── firstAppearance: string | null // 首次出现场次（如 EP01-Scene01）
├── dialogueCount: number | null  // 对白数量
├── generationPrompt: string | null // AI 生图标准化提示词
├── confidence: string | null     // 推断可信度：confirmed | inferred
├── createdAt: string             // 创建时间
└── updatedAt: string             // 更新时间

ScriptAnalyzedScene (Value Object)
├── id: string                    // 场景 ID
├── documentId: string            // 所属剧本文档 ID
├── projectId: string             // 所属项目 ID
├── name: string                  // 场景名称
├── type: string | null           // 场景类型：indoor | outdoor | virtual
├── description: string           // 场景描述
├── lighting: string              // 光照
├── timeOfDay: string             // 时间段
├── weather: string               // 天气
├── tags: string[] | null         // 工厂标签
├── factorySceneId: string | null // 流转到场景工厂后的资产 ID
├── status: string                // 状态：extracted | confirmed | transferred
├── category: string | null       // 场景分类（如古代建筑/现代都市/自然景观）
├── indoorOutdoor: string | null  // 室内/室外/混合
├── location: string | null       // 具体地点描述
├── architecture: string | null   // 建筑结构
├── terrain: string | null        // 地形特征
├── plants: string | null         // 植物元素
├── objects: string | null        // 场景中固定物件
├── period: string | null         // 时间段
├── tone: string | null           // 整体色调
├── visualStyle: string | null    // 视觉风格
├── atmosphereEmotion: string | null // 情感氛围
├── suitableShots: string | null  // 适合镜头（JSON 数组字符串）
├── reusableElements: string | null // 可复用元素（JSON 数组字符串）
├── generationPrompt: string | null // AI 生图标准化提示词
├── firstAppearance: string | null // 首次出现场次
├── confidence: string | null     // 推断可信度：confirmed | inferred
├── createdAt: string             // 创建时间
└── updatedAt: string             // 更新时间

ScriptAnalyzedProp (Value Object)
├── id: string                    // 道具 ID
├── documentId: string            // 所属剧本文档 ID
├── projectId: string             // 所属项目 ID
├── name: string                  // 道具名称
├── category: string              // 道具分类
├── description: string           // 道具描述
├── appearance: string | null     // 外观造型描述
├── material: string              // 材质
├── size: string | null           // 尺寸
├── color: string                 // 颜色
├── tags: string[] | null         // 工厂标签
├── factoryPropId: string | null  // 流转到道具工厂后的资产 ID
├── status: string                // 状态：extracted | confirmed | transferred
├── importanceLevel: string | null // 道具重要性：核心道具 | 普通道具 | 背景道具
├── owner: string | null          // 归属角色名
├── shape: string | null          // 形状/形态
├── texture: string | null        // 表面质感
├── storyFunction: string | null  // 剧情作用
├── visualFeatures: string | null // 视觉特征（JSON 数组字符串）
├── cameraUsage: string | null    // 镜头用法（JSON 数组字符串）
├── generationPrompt: string | null // AI 生图标准化提示词
├── firstAppearance: string | null // 首次出现场次
├── confidence: string | null     // 推断可信度：confirmed | inferred
├── createdAt: string             // 创建时间
└── updatedAt: string             // 更新时间
```

---

## 2. 读模型

- 剧本列表：按项目/剧集分组，显示状态和版本号。
- 剧本编辑器：含富文本编辑、批注面板、版本对比。
- 分析结果面板：角色/场景/道具提取结果，可逐条确认或忽略。

---

## 3. 内部实体与值对象

```text
ScriptDocument (Entity)
├── id: string
├── scriptId: string
├── versionNumber: number
├── contentSnapshot: string
├── analysisRevision: number
├── createdBy: string
├── createdAt: string
└── checksum: string

ScriptComment (Entity)
├── id: string
├── authorId: string
├── anchor: TextAnchor
├── content: string
├── status: open | resolved
├── resolvedBy: string | null
└── createdAt: string

```

`ScriptAnalysis` 仅以 [§1.5](#15-值对象--内部实体) 的定义为准。本节不重复声明；`Script.analysisStatus` 是该值对象 `freshness` 的聚合级投影。分析任务的 `pending / running / failed` 属于命令执行生命周期，不写入已完成的 `ScriptAnalysis` 值对象。

剧本编辑锁由应用层 `ScriptEditLease` 管理，字段为 `scriptId/userId/leaseId/expiresAt/lastHeartbeatAt`。它不是 Script 聚合状态；强制释放必须校验 admin/owner 权限并写审计日志。

---

## 4. 聚合根：ScriptCreationTask

AI 辅助剧本创作任务，覆盖剧本生成、优化/改写、场景生成、对话生成、剧本拆场景和自动拆 Shot 六种创作能力。任务结果始终为**候选**，不直接覆盖原文，需用户显式采纳。

```
ScriptCreationTask (Aggregate Root)
├── id: string                         // 任务唯一标识
├── scriptId: string                   // 关联剧本 ID
├── projectId: string                  // 所属项目 ID
├── episodeId: string                  // 所属剧集 ID
├── userId: string                     // 发起者用户 ID
├── taskType: CreationTaskType         // 任务类型（见 §4.0）
├── inputScope: InputScope             // 输入范围：full | selection | scene | dialogue
├── inputSnapshot: string              // 输入文本快照（不可变，用于 AI 调用和 stale 检测）
├── inputRange: TextRange | null       // 选区范围 { offset, length }，仅 selection/dialogue 时存在
├── instruction: string                // 用户附加指令（如"增加悬念"、"简化对白"）
├── status: CreationTaskStatus         // pending | generating | completed | failed | cancelled | adopted | rejected | expired
├── result: CreationCandidate | null   // 生成结果候选
├── promptSnapshot: PromptSnapshot     // Prompt 模板 ID + 渲染结果 + 参数
├── modelSnapshot: ModelExecutionSnapshot  // 模型 / Token / 耗时 / 成本
├── sourceScriptVersion: number        // 发起时剧本 currentVersion（用于 stale 检测）
├── sourceAnalysisRevision: number | null  // 发起时 analysisRevision（split_shots 需要）
├── stale: boolean                     // 剧本已变更，候选可能过期
├── adoptedAt: string | null           // 采纳时间
├── expiredAt: string | null           // 过期时间（默认创建后 24h）
├── errorMessage: string | null        // 失败原因
├── retryCount: number                 // 已重试次数（最多 3 次）
├── version: number                    // 乐观锁
├── createdAt: string
├── updatedAt: string
└── deletedAt: string | null           // 软删除
```

### 4.0 任务类型枚举

| taskType | 中文名 | 输入范围约束 | 剧本状态约束 | 说明 |
|----------|--------|-------------|-------------|------|
| `generate` | AI 剧本生成 | full | draft | 根据指令生成全新剧本内容 |
| `optimize` | AI 剧本优化 | full / selection | draft / analyzed | 优化或改写现有内容 |
| `scene_generate` | AI 场景生成 | full / scene | draft / analyzed | 根据剧本上下文生成场景描述 |
| `dialogue_generate` | AI 对话生成 | scene / dialogue | draft / analyzed | 为指定场景生成角色对白 |
| `split_scenes` | AI 剧本拆场景 | full | draft / analyzed | 将剧本拆分为结构化场景列表 |
| `split_shots` | 自动拆 Shot | full | analyzed | 基于已分析剧本生成分镜建议 |

### 4.1 状态机

```
┌─────────┐  create   ┌───────────┐  complete   ┌───────────┐  adopt   ┌─────────┐
│ pending │ ────────▶ │ generating│ ──────────▶ │ completed │ ────────▶│ adopted │
└────┬────┘           └─────┬─────┘             └─────┬─────┘          └─────────┘
     │                      │ fail                    │ reject             ▲
     │ cancel               ▼                         ▼                    │
     ▼                 ┌─────────┐               ┌──────────┐              │
┌──────────┐           │ failed  │               │ rejected │              │
│ cancelled│           └────┬────┘               └──────────┘              │
└──────────┘                │ retry                                        │
                            └──────────────────────────────────────────────┘
                                              expire（24h 超时）
                                     completed ──▶ expired
```

**状态值**：`pending` | `generating` | `completed` | `failed` | `cancelled` | `adopted` | `rejected` | `expired`

**状态转换说明**：
- `pending → generating`：AI 任务调度上下文接收任务后回调确认开始执行
- `generating → completed`：AI 生成完成，产出候选结果
- `generating → failed`：AI 生成失败（超时/模型错误/限流等）
- `failed → generating`：用户重试，`retryCount + 1`，最多 3 次
- `pending/generating → cancelled`：用户取消任务
- `completed → adopted`：用户采纳候选，候选内容应用到剧本
- `completed → rejected`：用户拒绝候选
- `completed → expired`：超过 24h 未处理，自动过期

### 4.2 命令

| 命令 | 前置状态 | 产出事件 | 说明 |
|------|---------|---------|------|
| `CreateScriptCreationTask` | 不存在 | `ScriptCreationTaskCreated` | 创建创作任务。校验 taskType 的输入范围和剧本状态约束；记录 sourceScriptVersion 和 sourceAnalysisRevision；同一 scriptId + taskType + inputScope 的 pending/generating 任务不可重复创建 |
| `StartCreationTask` | pending | `ScriptCreationTaskStarted` | AI 任务调度上下文确认开始执行，状态转为 generating |
| `CompleteCreationTask` | generating | `ScriptCreationTaskCompleted` | AI 生成完成，写入 CreationCandidate 结果。检测 sourceScriptVersion 与当前剧本版本差异，若不一致则标记 `stale = true` |
| `FailCreationTask` | generating | `ScriptCreationTaskFailed` | AI 生成失败，记录 errorMessage 和错误分类 |
| `CancelCreationTask` | pending / generating | `ScriptCreationTaskCancelled` | 用户取消任务。已 completed 的任务不可取消 |
| `RetryCreationTask` | failed | `ScriptCreationTaskRetryStarted` | 重试失败任务。`retryCount + 1`，最多 3 次，超过后进入 failed 终态 |
| `AdoptCreationCandidate` | completed | `CreationCandidateAdopted` | 采纳候选结果。若 `stale = true` 需用户二次确认；采纳后触发 Script 的 `UpdateScript` 或 `UpdateScriptSelection` 命令更新剧本内容 |
| `RejectCreationCandidate` | completed | `CreationCandidateRejected` | 拒绝候选结果，任务终结 |
| `ExpireCreationCandidate` | completed | `CreationCandidateExpired` | 超时自动过期，由定时任务触发 |

### 4.3 不变量

- **候选不覆盖原则**：AI 生成结果始终为候选（CreationCandidate），不直接修改 Script.content；必须通过 `AdoptCreationCandidate` 命令由用户显式采纳后才应用。
- **Stale 检测**：任务完成时对比 `sourceScriptVersion` 与 Script 当前 `currentVersion`，不一致则标记 `stale = true`；采纳 stale 候选需用户二次确认。
- **输入快照不可变**：`inputSnapshot` 在创建时冻结，保证 AI 调用的输入可追溯，不随后续编辑变化。
- **类型约束**：`taskType` 决定 `inputScope` 和剧本状态的合法组合（见 §4.0）；`split_shots` 要求剧本处于 `analyzed` 状态且有有效分析结果。
- **并发控制**：同一 `scriptId + taskType + inputScope` 的 `pending` / `generating` 状态任务不可重复创建，避免重复生成。
- **重试上限**：`retryCount` 最多 3 次，指数退避（10s / 30s / 60s），超过后进入 `failed` 终态。
- **过期策略**：`completed` 状态任务超过 24h 未处理自动转为 `expired`。
- **幂等性**：`AdoptCreationCandidate` 幂等——已 adopted 的任务重复采纳返回原结果引用。
- **采纳后剧本状态联动**：若剧本处于 `analyzed` 状态，采纳候选更新内容后自动回退到 `draft`，原分析结果标记 `stale`（与 `UpdateScript` 行为一致）。
- **split_shots 结果流转**：`split_shots` 类型的候选被采纳后，产出 `ShotSuggestionsGenerated` 事件，由分镜导演上下文消费创建 Shot 草稿（类似 US-006 AI 分镜建议的流转路径）。
- **项目归档联动**：项目归档后拒绝创建新任务和采纳候选；进行中的任务标记为 `cancelled`。

### 4.4 领域事件

| 事件 | Payload | 消费者 |
|------|---------|-------|
| `ScriptCreationTaskCreated` | taskId, scriptId, projectId, taskType, inputScope, inputSnapshot, instruction, promptSnapshot | AI 任务调度（创建 AITask 执行 AI 调用） |
| `ScriptCreationTaskCompleted` | taskId, scriptId, projectId, taskType, result（候选内容摘要）, stale, modelSnapshot | 通知（通知用户预览候选） |
| `ScriptCreationTaskFailed` | taskId, scriptId, projectId, errorMessage, errorCategory | 通知（告警用户失败） |
| `CreationCandidateAdopted` | taskId, scriptId, projectId, taskType, appliedRange, scriptNewVersion | 智能助手（DEP 影响评估、更新版本列表） |
| `CreationCandidateRejected` | taskId, scriptId, projectId | — |
| `CreationCandidateExpired` | taskId, scriptId, projectId | — |
| `ShotSuggestionsGenerated` | taskId, scriptId, projectId, suggestions[] | 分镜导演（创建 Shot 草稿，待人工确认） |

### 4.5 值对象

```
CreationCandidate (Value Object)
├── content: string                    // 生成的候选内容（全文或片段）
├── diff: DiffResult                   // 与原文的差异（新增/删除/修改行）
├── summary: string                    // 生成内容摘要
├── confidenceScore: number | null     // AI 置信度（0-1）
├── alternativeResults: string[]       // 备选结果（可选，最多 3 个）
└── generatedAt: string                // 生成时间

PromptSnapshot (Value Object)
├── promptTemplateId: string | null    // 使用的 Prompt 模板 ID
├── promptTemplateVersion: number | null  // 模板版本号
├── renderedPrompt: string             // 渲染后的最终 Prompt
├── parameters: Record<string, any>    // 模板参数
└── systemPrompt: string | null        // 系统提示词

ModelExecutionSnapshot (Value Object)
├── modelConfigId: string              // 模型配置 ID
├── modelName: string                  // 模型名称
├── provider: string                   // 供应商
├── inputTokens: number                // 输入 Token 数
├── outputTokens: number               // 输出 Token 数
├── duration: number                   // 耗时（毫秒）
├── cost: number                       // 成本估算（分）
└── requestId: string                  // AI 供应商请求 ID

TextRange (Value Object)
├── offset: number                     // 起始偏移量
└── length: number                     // 长度

DiffResult (Value Object)
├── added: DiffLine[]                  // 新增行
├── removed: DiffLine[]                // 删除行
├── modified: DiffLine[]               // 修改行
└── summary: string                    // 差异摘要

DiffLine (Value Object)
├── lineNumber: number                 // 行号
├── content: string                    // 内容
└── type: string                       // add | remove | modify
```

### 4.6 读模型

- **创作任务列表**：按剧本分组，显示任务类型、状态、创建时间、候选摘要。
- **候选预览面板**：左右对比展示原文与候选内容，高亮差异行，显示 stale 标记和置信度。
- **创作历史**：按时间线展示某剧本的全部创作任务，含采纳/拒绝/过期状态。
- **成本统计**：按剧本/项目汇总创作任务的 Token 消耗和成本。
