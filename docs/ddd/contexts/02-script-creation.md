# 3.2 剧本创作上下文 (Script Creation)

> **所属上下文**：剧本创作 (Script Creation)
> **聚合根**：`Script`（含内部实体 `ScriptDocument` / `ScriptComment` / 值对象 `ScriptAnalysis`）
> **对应页面**：剧本中心
> **配套规范**：[DDD 治理规范](../governance.md)｜[统一语言术语表](../glossary.md)｜[上下文映射](../context-map.md)｜[跨上下文协作契约](../contracts.md)

**边界**：剧本的创建、编辑、版本管理、AI 分析（角色/场景/道具提取）。

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
| `ScriptVersionPublished` | scriptId, projectId, version, documentId, revision | 分镜导演（允许创建分镜板） |
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

ScriptAnalysis (Value Object)
├── id: string                    // 分析结果唯一标识
├── scriptId: string              // 所属剧本 ID
├── documentId: string            // 所属剧本文档 ID
├── projectId: string             // 所属项目 ID
├── analysisType: string          // 分析类型：character | scene | prop | full
├── characters: ScriptAnalyzedCharacter[]  // 提取的角色列表
├── scenes: ScriptAnalyzedScene[]         // 提取的场景列表
├── props: ScriptAnalyzedProp[]           // 提取的道具列表
├── relations: Relation[]         // 角色/场景/道具之间的关系
├── status: string                // 分析状态：pending | completed | failed
├── createdAt: string             // 创建时间
└── updatedAt: string             // 更新时间

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

ScriptAnalysis (Value Object)
├── revision: number
├── status: stale | valid
├── characters: AnalysisCandidate[]
├── scenes: AnalysisCandidate[]
├── props: AnalysisCandidate[]
├── modelSnapshot: ModelExecutionSnapshot
└── completedAt: string
```

剧本编辑锁由应用层 `ScriptEditLease` 管理，字段为 `scriptId/userId/leaseId/expiresAt/lastHeartbeatAt`。它不是 Script 聚合状态；强制释放必须校验 admin/owner 权限并写审计日志。
