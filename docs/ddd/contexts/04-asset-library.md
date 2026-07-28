# 3.4 资产库上下文 (Asset Library)

> **所属上下文**：资产库 (Asset Library)
> **聚合根**：`Character` / `Scene` / `Prop`
> **对应页面**：角色工厂、场景工厂、道具工厂、资产中心、资产编辑页（角色编辑页 / 场景编辑页 / 道具编辑页）
> **配套规范**：[DDD 治理规范](../governance.md)｜[统一语言术语表](../glossary.md)｜[上下文映射](../context-map.md)｜[跨上下文协作契约](../contracts.md)

**边界**：角色、场景、道具资产的创建、编辑、一致性包管理、版本历史、发布和归档。音频资产已迁移到后期制作上下文。

> **事件表说明**：聚合的"领域事件"表仅列出有消费者的关键事件。命令表"产出事件"列是事件全量来源。

> **页面路由映射**（前端 Next.js App Router）：
> | 页面 | 路由 | 说明 |
> |------|------|------|
> | 角色工厂 | `/characters` | 角色列表与 CRUD |
> | 场景工厂 | `/scenes` | 场景列表与 CRUD |
> | 道具工厂 | `/props` | 道具列表与 CRUD |
> | 角色编辑页 | `/characters/[id]/edit` | 独立标签页，竖屏 9:16 生图 |
> | 场景编辑页 | `/scenes/[id]/edit` | 独立标签页，横屏 16:9 生图 |
> | 道具编辑页 | `/props/[id]/edit` | 独立标签页，方形 1:1 生图 |
> | 一致性包 | `/{characters,scenes,props}/[id]/consistency-pack` | 三厂共用一致性包管理 |
>
> 资产编辑页（`/edit`）由对应工厂卡片「编辑」按钮以新标签页打开，采用独占式全屏生图布局（不显示侧边栏），字段规范见 [需求文档 §3.7 角色编辑器字段](../../requirements-and-acceptance.md#37-角色编辑器字段) 与 [§3.8 场景编辑器字段](../../requirements-and-acceptance.md#38-场景编辑器字段)。

---

## 1. 聚合根：Character

```
Character (Aggregate Root)
├── id: string
├── projectId: string
├── name: string
├── description: string
├── status: AssetStatus            // draft | ready | published | archived
├── appearance: string             // 外貌描述
├── personality: string            // 性格描述
├── costumeDescription: string     // 服装描述
├── consistencyPack: ConsistencyPack  // 一致性包（值对象）
├── imageIds: string[]             // 立绘引用 ID 列表（仅持有 ID）
├── sourceScriptId: string | null  // 来源剧本分析
├── sourceRevision: number | null  // 来源分析结果 revision
├── rightsMetadata: RightsMetadata // 来源、授权范围、到期时间
├── version: number
├── createdAt: string
├── updatedAt: string
├── deletedAt: string | null
└── usageCount: number             // 被分镜引用次数
```

### 1.1 状态机

```
┌────────┐  markReady  ┌────────┐  publish  ┌───────────┐  archive  ┌──────────┐
│ draft  │────────────▶│ ready  │─────────▶│ published │──────────▶│ archived │
└────────┘             └────────┘          └─────┬─────┘           └────┬─────┘
    │  publish                ▲ unpublish         │ unpublish            │ restore
    │  (直接发布)              │                   ▼                       ▼
    │                         │              ┌────────┐           ┌───────────┐
    └─────────────────────────┴──────────────│ ready  │           │ published │
                                              └────────┘           └───────────┘
    ▲ edit (draft)        ▲ edit (ready)
    │                     │
    └─────────▶ draft      └─────────▶ ready
```

> **状态转换说明**：`ready` 是强制发布门禁。`PublishCharacter` 只接受 `ready`，禁止 `draft → published`。

> **`published` 语义说明（资产已发布）**：本上下文中的 `published` 表示**资产已发布**——即资产完成发布、进入**可被分镜引用**的生命周期阶段。它是资产生命周期 `draft → ready → published → archived` 的中间态（非终态），关注的是"可引用性"而非"外发"。此语义与[发布交付上下文](07-publish-delivery.md)中成片的 `published`（成片已发布到外部平台、属发布流程终态）**含义不同**，详见 [glossary.md "已发布"语义区分说明](../glossary.md)。

### 1.2 命令

| 命令 | 前置状态 | 产出事件 | 说明 |
|------|---------|---------|------|
| `CreateCharacter` | 不存在 | `CharacterCreated` | 创建角色 |
| `UpdateCharacter` | draft / ready | `CharacterUpdated` | 编辑角色信息 |
| `MarkCharacterReady` | draft | `CharacterMarkedReady` | 标记角色信息填写完毕、立绘已上传、一致性包已配置 |
| `PublishCharacter` | ready | `CharacterPublished` | 发布角色；不得绕过完整性校验 |
| `UnpublishCharacter` | published | `CharacterUnpublished` | 取消发布，回退到 ready |
| `ArchiveCharacter` | published | `CharacterArchived` | 归档角色 |
| `RestoreCharacter` | archived | `CharacterRestored` | 恢复归档角色到 published |
| `AddImage` | draft / ready | `CharacterImageAdded` | 添加立绘 |
| `RemoveImage` | draft / ready | `CharacterImageRemoved` | 移除立绘 |
| `UpdateConsistencyPack` | draft / ready | `ConsistencyPackUpdated` | 更新一致性包 |
| `SoftDeleteCharacter` | draft / ready（usageCount = 0） | `CharacterDeleted` | 软删除 |

### 1.3 不变量

- 被分镜引用的角色不可删除（`usageCount > 0` 时禁止 `SoftDeleteCharacter`）。
- 一致性包引用的图片必须属于该角色的 `imageIds` 列表。
- `published` 状态下不可修改任何字段，需先 `UnpublishCharacter` 回退到 `ready`。
- `archived` 状态可通过 `RestoreCharacter` 恢复到 `published`。
- `version` 每次变更只递增一次。
- 名称在同一 `projectId` 内不可重复。
- `usageCount` 只能由 `ShotAssetBound` / `ShotAssetUnbound` 事件投影维护，不允许客户端直接写入。

### 1.4 领域事件

| 事件 | Payload | 消费者 |
|------|---------|-------|
| `CharacterCreated` | characterId, projectId, name, sourceScriptId, sourceRevision | 智能助手 |
| `CharacterUpdated` | characterId, projectId | 智能助手 |
| `CharacterMarkedReady` | characterId, projectId | 智能助手 |
| `CharacterPublished` | characterId, projectId | 分镜导演（可引用提示） |
| `CharacterUnpublished` | characterId, projectId | 分镜导演（引用失效提醒） |
| `CharacterArchived` | characterId, projectId | 分镜导演（引用失效提醒） |
| `CharacterRestored` | characterId, projectId | 分镜导演（引用恢复提示） |
| `ConsistencyPackUpdated` | characterId, packVersion | AI任务调度（影响生成参数） |
| `CharacterImageAdded` | characterId, imageId | — |
| `CharacterImageRemoved` | characterId, imageId | — |
| `CharacterDeleted` | characterId, projectId | 智能助手 |

---

## 2. 聚合根：Scene

```
Scene (Aggregate Root)
├── id: string
├── projectId: string
├── name: string
├── description: string
├── status: AssetStatus            // draft | ready | published | archived
├── locationType: string           // indoor | outdoor | fantasy
├── atmosphere: string             // 氛围描述
├── timeOfDay: string              // morning | afternoon | night
├── weather: string                // 晴 | 阴 | 雨 | 雪 | 雾
├── lighting: string               // 光照描述（影响生成 Prompt）
├── backgroundImageId: string | null  // 背景图 ID
├── sourceScriptId: string | null  // 来源剧本分析
├── sourceRevision: number | null
├── rightsMetadata: RightsMetadata
├── version: number
├── createdAt: string
├── updatedAt: string
├── deletedAt: string | null
└── usageCount: number             // 被分镜引用次数
```

### 2.1 状态机

与 Character 同构（draft → ready → published → archived，含 unpublish / restore）。`PublishScene` 只接受 `ready`。

### 2.2 命令

| 命令 | 前置状态 | 产出事件 | 说明 |
|------|---------|---------|------|
| `CreateScene` | 不存在 | `SceneCreated` | 创建场景 |
| `UpdateScene` | draft / ready | `SceneUpdated` | 编辑场景信息 |
| `MarkSceneReady` | draft | `SceneMarkedReady` | 标记场景信息填写完毕、背景图已上传 |
| `PublishScene` | ready | `ScenePublished` | 发布场景；不得绕过完整性校验 |
| `UnpublishScene` | published | `SceneUnpublished` | 取消发布，回退到 ready |
| `ArchiveScene` | published | `SceneArchived` | 归档场景 |
| `RestoreScene` | archived | `SceneRestored` | 恢复归档场景到 published |
| `SoftDeleteScene` | draft / ready（usageCount = 0） | `SceneDeleted` | 软删除 |

### 2.3 不变量

- 被分镜引用的场景不可删除。
- 删除背景图前需从所有引用分镜中移除该引用。
- `published` 状态下不可修改任何字段，需先 `UnpublishScene`。
- 名称在同一 `projectId` 内不可重复。
- `usageCount` 只能由分镜资产绑定事件投影维护。

### 2.4 领域事件

| 事件 | Payload | 消费者 |
|------|---------|-------|
| `SceneCreated` | sceneId, projectId, name, sourceScriptId, sourceRevision | 智能助手 |
| `SceneUpdated` | sceneId, projectId | 智能助手 |
| `SceneMarkedReady` | sceneId, projectId | 智能助手 |
| `ScenePublished` | sceneId, projectId | 分镜导演（可引用提示） |
| `SceneUnpublished` | sceneId, projectId | 分镜导演（引用失效提醒） |
| `SceneArchived` | sceneId, projectId | 分镜导演（引用失效提醒） |
| `SceneRestored` | sceneId, projectId | 分镜导演（引用恢复提示） |
| `SceneDeleted` | sceneId, projectId | 智能助手 |

---

## 3. 聚合根：Prop

```
Prop (Aggregate Root)
├── id: string
├── projectId: string
├── name: string
├── description: string
├── status: AssetStatus            // draft | ready | published | archived
├── category: string               // weapon | tool | clothing | food | other
├── color: string
├── material: string
├── imageId: string | null         // 道具图片 ID
├── sourceScriptId: string | null  // 来源剧本分析
├── sourceRevision: number | null
├── rightsMetadata: RightsMetadata
├── version: number
├── createdAt: string
├── updatedAt: string
├── deletedAt: string | null
└── usageCount: number             // 被分镜引用次数
```

### 3.1 状态机

与 Character 同构。`PublishProp` 只接受 `ready`。

### 3.2 命令

| 命令 | 前置状态 | 产出事件 | 说明 |
|------|---------|---------|------|
| `CreateProp` | 不存在 | `PropCreated` | 创建道具 |
| `UpdateProp` | draft / ready | `PropUpdated` | 编辑道具信息 |
| `MarkPropReady` | draft | `PropMarkedReady` | 标记道具信息填写完毕、图片已上传 |
| `PublishProp` | ready | `PropPublished` | 发布道具；不得绕过完整性校验 |
| `UnpublishProp` | published | `PropUnpublished` | 取消发布，回退到 ready |
| `ArchiveProp` | published | `PropArchived` | 归档道具 |
| `RestoreProp` | archived | `PropRestored` | 恢复归档道具到 published |
| `SoftDeleteProp` | draft / ready（usageCount = 0） | `PropDeleted` | 软删除 |

### 3.3 不变量

- 被分镜引用的道具不可删除。
- `published` 状态下不可修改任何字段，需先 `UnpublishProp`。
- 名称在同一 `projectId` 内不可重复。
- `usageCount` 只能由分镜资产绑定事件投影维护。

### 3.4 领域事件

| 事件 | Payload | 消费者 |
|------|---------|-------|
| `PropCreated` | propId, projectId, name, sourceScriptId, sourceRevision | 智能助手 |
| `PropUpdated` | propId, projectId | 智能助手 |
| `PropMarkedReady` | propId, projectId | 智能助手 |
| `PropPublished` | propId, projectId | 分镜导演（可引用提示） |
| `PropUnpublished` | propId, projectId | 分镜导演（引用失效提醒） |
| `PropArchived` | propId, projectId | 分镜导演（引用失效提醒） |
| `PropRestored` | propId, projectId | 分镜导演（引用恢复提示） |
| `PropDeleted` | propId, projectId | 智能助手 |

---

## 4. 历史模型：Audio（已废弃）

旧 `Audio` 不再是本上下文的聚合、命令、状态机或事件契约。所有新音频资产、音轨、字幕、口型与渲染编排统一归属[后期制作上下文](09-post-production.md)的 `AudioAsset` / `EditProject` / `RenderJob`。

历史字段映射、文件核验、双读、切换与回滚只在[数据生命周期与迁移方案](../../product/data-lifecycle-and-migration.md)维护。代码中的旧 `Audio` 路由和仓储只能作为迁移兼容层，禁止新增能力；切换稳定后按 Contract 阶段删除。

---

## 5. 值对象

| 值对象 | 字段 | 说明 |
|-------|------|------|
| `ConsistencyPack` | `referenceImages: string[]`, `styleDescription: string`, `negativePrompts: string[]` | 角色一致性包，用于生成时约束 |
| `CharacterImageRef` | `imageId: string`, `type: "main" \| "alternative"`, `sortOrder: number` | 角色立绘引用 |
| `RightsMetadata` | `source`, `licenseType`, `owner`, `allowedUses`, `expiresAt`, `evidenceFileId` | 资产权利来源和使用范围；发布预检必须校验 |
