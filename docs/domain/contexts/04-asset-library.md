# 3.4 资产库上下文 (Asset Library)

> **所属上下文**：资产库 (Asset Library)
> **聚合根**：`Character` / `Scene` / `Prop` / `StyleAsset`
> **对应页面**：角色工厂、场景工厂、道具工厂、风格库、资产中心、资产编辑页
> **配套规范**：[DDD 治理规范](../02-governance.md)｜[统一语言术语表](../03-glossary.md)｜[上下文映射](../04-context-map.md)｜[跨上下文协作契约](../05-contracts.md)

**边界**：角色、场景、道具、风格资产的创建、编辑、项目内版本、一致性包、权利元数据、跨项目复制来源、发布和归档。音频资产已迁移到后期制作上下文。跨项目复用只创建独立副本，不维护可变引用或自动同步。

> **事件表说明**：聚合的"领域事件"表仅列出有消费者的关键事件。命令表"产出事件"列是事件全量来源。

> **页面路由映射**（前端 Next.js App Router）：
> | 页面 | 路由 | 说明 |
> |------|------|------|
> | 角色工厂 | `/characters` | 角色列表与 CRUD |
> | 场景工厂 | `/scenes` | 场景列表与 CRUD |
> | 道具工厂 | `/props` | 道具列表与 CRUD |
> | 风格库 | `/styles` | 项目风格资产、参考图、Prompt 片段和适用范围 |
> | 角色编辑页 | `/characters/[id]/edit` | 独立标签页，竖屏 9:16 生图 |
> | 场景编辑页 | `/scenes/[id]/edit` | 独立标签页，横屏 16:9 生图 |
> | 道具编辑页 | `/props/[id]/edit` | 独立标签页，方形 1:1 生图 |
> | 一致性包 | `/{characters,scenes,props}/[id]/consistency-pack` | 三厂共用一致性包管理 |
>
> 资产编辑页（`/edit`）由对应工厂卡片「编辑」按钮以新标签页打开，采用独占式全屏生图布局（不显示侧边栏），字段规范见 [需求文档 §3.7 角色编辑器字段](../../requirements/02-requirements-and-acceptance.md#37-角色编辑器字段) 与 [§3.8 场景编辑器字段](../../requirements/02-requirements-and-acceptance.md#38-场景编辑器字段)。

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

> **`published` 语义说明（资产已发布）**：本上下文中的 `published` 表示**资产已发布**——即资产完成发布、进入**可被分镜引用**的生命周期阶段。它是资产生命周期 `draft → ready → published → archived` 的中间态（非终态），关注的是"可引用性"而非"外发"。此语义与[发布交付上下文](07-publish-delivery.md)中成片的 `published`（成片已发布到外部平台、属发布流程终态）**含义不同**，详见 [03-glossary.md "已发布"语义区分说明](../03-glossary.md)。

### 1.2 命令

| 命令 | 前置状态 | 产出事件 | 说明 |
|------|---------|---------|------|
| `CreateCharacter` | 不存在 | `CharacterCreated` | 创建角色 |
| `UpdateCharacter` | draft / ready | `CharacterUpdated` | 编辑角色信息 |
| `MarkCharacterReady` | draft | `CharacterMarkedReady` | 标记角色信息填写完毕、立绘已上传、一致性包已配置 |
| `PublishCharacter` | ready | `CharacterPublished`, `CharacterVersionPublished` | 发布角色并冻结确切版本证据；不得绕过完整性校验 |
| `UnpublishCharacter` | published | `CharacterUnpublished` | 取消发布，回退到 ready |
| `ArchiveCharacter` | published | `CharacterArchived` | 归档角色 |
| `RestoreCharacter` | archived | `CharacterRestored` | 恢复归档角色到 published |
| `AddImage` | draft / ready | `CharacterImageAdded` | 添加立绘 |
| `RemoveImage` | draft / ready | `CharacterImageRemoved` | 移除立绘 |
| `UpdateConsistencyPack` | draft / ready | `ConsistencyPackUpdated` | 更新一致性包 |
| `UpdateCharacterRights` | draft / ready | `RightsMetadataChanged` | 更新权利元数据并保留前后哈希 |
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
| `CharacterPublished` | characterId, projectId, version, versionHash | 分镜导演（可引用提示） |
| `CharacterVersionPublished` | characterId, projectId, versionId, version, versionHash, previousVersionId, rightsSnapshotHash | 智能助手（DEP 依赖投影） |
| `CharacterUnpublished` | characterId, projectId | 分镜导演（引用失效提醒） |
| `CharacterArchived` | characterId, projectId | 分镜导演（引用失效提醒） |
| `CharacterRestored` | characterId, projectId | 分镜导演（引用恢复提示） |
| `ConsistencyPackUpdated` | characterId, packVersion | AI任务调度（影响生成参数） |
| `CharacterImageAdded` | characterId, imageId | — |
| `CharacterImageRemoved` | characterId, imageId | — |
| `CharacterDeleted` | characterId, projectId | 智能助手 |
| `RightsMetadataChanged` | assetType, assetId, projectId, previousRightsHash, currentRightsHash, validity, changedFields | 智能助手（DEP 影响评估）、发布交付（预检） |

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
| `PublishScene` | ready | `ScenePublished`, `SceneVersionPublished` | 发布场景并冻结确切版本证据；不得绕过完整性校验 |
| `UnpublishScene` | published | `SceneUnpublished` | 取消发布，回退到 ready |
| `ArchiveScene` | published | `SceneArchived` | 归档场景 |
| `RestoreScene` | archived | `SceneRestored` | 恢复归档场景到 published |
| `UpdateSceneRights` | draft / ready | `RightsMetadataChanged` | 更新权利元数据并保留前后哈希 |
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
| `ScenePublished` | sceneId, projectId, version, versionHash | 分镜导演（可引用提示） |
| `SceneVersionPublished` | sceneId, projectId, versionId, version, versionHash, previousVersionId, rightsSnapshotHash | 智能助手（DEP 依赖投影） |
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
| `PublishProp` | ready | `PropPublished`, `PropVersionPublished` | 发布道具并冻结确切版本证据；不得绕过完整性校验 |
| `UnpublishProp` | published | `PropUnpublished` | 取消发布，回退到 ready |
| `ArchiveProp` | published | `PropArchived` | 归档道具 |
| `RestoreProp` | archived | `PropRestored` | 恢复归档道具到 published |
| `UpdatePropRights` | draft / ready | `RightsMetadataChanged` | 更新权利元数据并保留前后哈希 |
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
| `PropPublished` | propId, projectId, version, versionHash | 分镜导演（可引用提示） |
| `PropVersionPublished` | propId, projectId, versionId, version, versionHash, previousVersionId, rightsSnapshotHash | 智能助手（DEP 依赖投影） |
| `PropUnpublished` | propId, projectId | 分镜导演（引用失效提醒） |
| `PropArchived` | propId, projectId | 分镜导演（引用失效提醒） |
| `PropRestored` | propId, projectId | 分镜导演（引用恢复提示） |
| `PropDeleted` | propId, projectId | 智能助手 |

---

## 4. 聚合根：StyleAsset

```text
StyleAsset (Aggregate Root)
├── id: string
├── projectId: string
├── name: string
├── description: string
├── status: AssetStatus
├── referenceImageIds: string[]
├── positivePromptFragment: string
├── negativePromptFragment: string
├── palette: string[]
├── applicableScopes: string[]       // character | scene | prop | shot | project
├── rightsMetadata: RightsMetadata
├── copiedFrom: AssetOrigin | null
├── version: number
├── createdAt / updatedAt
├── deletedAt: string | null
└── usageCount: number
```

StyleAsset 与 Character 使用相同生命周期。`PublishStyleAsset` 只接受 `ready`，发布时冻结版本内容、参考媒体版本和权利快照；已发布版本不可原地修改。

### 4.1 命令

| 命令 | 前置状态 | 产出事件 | 说明 |
|---|---|---|---|
| `CreateStyleAsset` | 不存在 | `StyleAssetCreated` | 创建项目内风格资产 |
| `UpdateStyleAsset` | draft / ready | `StyleAssetUpdated` | 编辑风格描述、Prompt 片段、色板与适用范围 |
| `MarkStyleAssetReady` | draft | `StyleAssetMarkedReady` | 完整性与权利校验通过 |
| `PublishStyleAsset` | ready | `StyleAssetPublished`, `StyleAssetVersionPublished` | 发布并冻结确切版本证据 |
| `UnpublishStyleAsset` | published | `StyleAssetUnpublished` | 回退到 ready 后才可编辑 |
| `ArchiveStyleAsset` | published | `StyleAssetArchived` | 停止新引用，不覆盖历史快照 |
| `RestoreStyleAsset` | archived | `StyleAssetRestored` | 恢复为 published |
| `UpdateStyleAssetRights` | draft / ready | `RightsMetadataChanged` | 更新权利元数据并保留前后哈希 |
| `SoftDeleteStyleAsset` | draft / ready（usageCount = 0） | `StyleAssetDeleted` | 软删除 |

### 4.2 不变量

- `referenceImageIds` 必须引用本项目可用且通过权利校验的媒体版本。
- `published` 不可编辑；任何内容变化形成新版本，旧分镜快照继续引用旧版本。
- 名称在同一项目内唯一；被引用时不可删除。
- 生成任务只保存 StyleAsset 确切版本或发布快照，不引用可变当前值。

### 4.3 领域事件

| 事件 | Payload | 消费者 |
|---|---|---|
| `StyleAssetCreated` / `StyleAssetUpdated` / `StyleAssetMarkedReady` | styleAssetId, projectId, version | 智能助手 |
| `StyleAssetPublished` | styleAssetId, projectId, version, versionHash | 分镜导演（可引用提示） |
| `StyleAssetVersionPublished` | styleAssetId, projectId, versionId, version, versionHash, previousVersionId, rightsSnapshotHash | 智能助手（DEP 依赖投影） |
| `StyleAssetUnpublished` / `StyleAssetArchived` / `StyleAssetRestored` | styleAssetId, projectId, version | 分镜导演（引用可用性提示） |
| `StyleAssetDeleted` | styleAssetId, projectId | 智能助手 |

---

## 5. 领域服务：跨项目资产复制

`CopyPublishedAssetToProject` 读取源资产已发布版本与权利快照，在目标项目创建新的 `draft` 聚合，并记录 `copiedFrom = { sourceProjectId, sourceAssetType, sourceAssetId, sourceVersionId, sourceVersionHash, copiedAt }`。复制完成发布 `AssetCopiedToProject`，供审计和 DEP 登记来源证据使用。

- 复制后源、目标拥有独立 ID、版本、生命周期和权限；源更新不通知、不覆盖、不提供“一键同步”。
- 复制前必须校验用户同时具有源读取与目标创建权限，且权利范围允许目标项目用途。
- 目标发布前仍执行完整性和权利校验；复制来源不是发布授权。

---

## 6. 历史模型：Audio（已废弃）

旧 `Audio` 不再是本上下文的聚合、命令、状态机或事件契约。所有新音频资产、音轨、字幕、口型与渲染编排统一归属[后期制作上下文](09-post-production.md)的 `AudioAsset` / `EditProject` / `RenderJob`。

历史字段映射、文件核验、双读、切换与回滚只在[数据生命周期与迁移方案](../../requirements/product/07-data-lifecycle-and-migration.md)维护。代码中的旧 `Audio` 路由和仓储只能作为迁移兼容层，禁止新增能力；切换稳定后按 Contract 阶段删除。

---

## 7. 值对象

| 值对象 | 字段 | 说明 |
|-------|------|------|
| `ConsistencyPack` | `referenceImages: string[]`, `styleDescription: string`, `negativePrompts: string[]` | 角色一致性包，用于生成时约束 |
| `CharacterImageRef` | `imageId: string`, `type: "main" \| "alternative"`, `sortOrder: number` | 角色立绘引用 |
| `RightsMetadata` | `source`, `licenseType`, `owner`, `allowedUses`, `expiresAt`, `evidenceFileId` | 资产权利来源和使用范围；发布预检必须校验 |
| `AssetOrigin` | `sourceProjectId`, `sourceAssetType`, `sourceAssetId`, `sourceVersionId`, `sourceVersionHash`, `copiedAt` | 跨项目复制的不可变来源证据，不代表可变引用 |
