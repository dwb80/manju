# 3.9 后期制作上下文 (Post Production)

> **所属上下文**：后期制作 (Post Production)
> **聚合根**：`EditProject` / `AudioAsset` / `SubtitleDocument` / `RenderJob`
> **对应页面**：音频中心、剪辑中心
> **配套规范**：[统一语言术语表](../03-glossary.md)｜[上下文映射](../04-context-map.md)｜[跨上下文协作契约](../05-contracts.md)
> **迁移规范**：历史 `Audio` / `project_clips` 的映射、双读核对、切换和回滚见[数据生命周期与迁移方案](../../requirements/product/07-data-lifecycle-and-migration.md)。新功能不得继续扩展旧模型。

**边界**：视频、配音、BGM、音效和字幕的多轨编辑；时间线版本管理；预览与最终渲染。成片发布仍属于发布交付上下文。

## 1. 聚合根：EditProject

```text
EditProject
├── id: string
├── projectId: string
├── episodeId: string
├── storyboardId: string
├── status: draft | rendering | ready | archived
├── timeline: Timeline
├── currentRevision: number
├── lastRenderedRevision: number | null
├── revisionHeadHash: string
├── editMode: insert | overwrite | ripple
├── version: number
├── createdAt: string
└── updatedAt: string

Timeline
├── timebase: Timebase               // fpsNumerator / fpsDenominator；所有帧对齐由服务端换算
├── durationMs: number               // 由全部可见内容的最大结束时间派生，不由客户端任意写入
├── videoTracks: VideoTrack[]
├── audioTracks: AudioTrack[]
├── subtitleTracks: SubtitleTrack[]
└── transitions: Transition[]

VideoTrack (Entity)
├── id: string
├── name: string
├── order: number
├── locked: boolean
├── muted: boolean
├── hidden: boolean
├── compositingMode: normal | multiply | screen | overlay
└── clips: VideoClip[]

VideoClip (Entity)
├── id: string
├── trackId: string
├── sourceType: shot_video | uploaded_video | rendered_video
├── sourceId: string                 // 外部媒体/Shot 视频 ID
├── sourceVersion: number            // 确切不可变来源版本
├── sourceContentHash: string         // 渲染与缺失媒体校验
├── presentationSnapshotId: string | null // Shot 来源时必填
├── sourceInMs: number
├── sourceOutMs: number
├── timelineStartMs: number
├── playbackRate: number             // > 0；默认 1
├── opacity: number                  // 0..1
├── transform: ClipTransform         // position/scale/rotation/anchor/crop
├── effects: EffectInstance[]
└── sortKey: string                  // 同轨同起点时的确定性层叠顺序

AudioTrack (Entity)
├── id: string
├── name: string
├── order: number
├── role: dialogue | bgm | sfx | ambience | custom
├── locked: boolean
├── muted: boolean
├── solo: boolean
├── gainDb: number
└── clips: AudioClip[]

AudioClip (Entity)
├── id: string
├── trackId: string
├── audioAssetId: string
├── sourceVersion: number            // 确切已发布 AudioAsset 版本
├── sourceContentHash: string
├── sourceInMs: number
├── sourceOutMs: number
├── timelineStartMs: number
├── playbackRate: number
├── gainDb: number
├── pan: number                      // -1..1
├── fadeInMs: number
├── fadeOutMs: number
├── channelMapping: string[]
└── effects: EffectInstance[]

SubtitleTrack (Entity)
├── id: string
├── name: string
├── order: number
├── language: string
├── locked: boolean
├── hidden: boolean
├── defaultStyle: SubtitleStyle
└── cues: TimelineSubtitleCue[]

TimelineSubtitleCue (Entity)
├── id: string
├── trackId: string
├── subtitleDocumentId: string | null
├── subtitleDocumentVersion: number | null
├── sourceCueId: string | null        // 引用 SubtitleDocument 时与上面两项同时必填
├── textSnapshot: string              // 时间线冻结的显示文本，不跟随来源静默变化
├── speakerId: string | null
├── startMs: number
├── endMs: number
├── styleOverride: Partial<SubtitleStyle> | null
└── positionOverride: NormalizedPoint | null

Transition (Entity)
├── id: string
├── trackId: string                  // 仅连接同一 VideoTrack 的相邻片段
├── fromClipId: string
├── toClipId: string
├── type: cut | dissolve | fade | wipe | custom
├── durationMs: number
├── implementationId: string
├── implementationVersion: string
└── parameters: Record<string, unknown>

EffectInstance (Value Object)
├── id: string
├── effectType: string
├── implementationId: string
├── implementationVersion: string
├── enabled: boolean
├── parameters: Record<string, unknown>
└── parameterSchemaVersion: number

Timebase (Value Object)
├── fpsNumerator: number
├── fpsDenominator: number
└── dropFrame: boolean

ClipTransform (Value Object)
├── position: NormalizedPoint
├── scale: { x: number, y: number }
├── rotationDegrees: number
├── anchor: NormalizedPoint
└── crop: { top: number, right: number, bottom: number, left: number }
```

`VideoTrack`、`AudioTrack`、`SubtitleTrack`、`VideoClip`、`AudioClip`、`TimelineSubtitleCue`、`Transition` 均为 `EditProject` 聚合内实体，只持有来源 ID、确切版本与内容哈希，不持有外部聚合对象。`TimelineSubtitleCue` 是时间线内实体；`SubtitleDocument.cues` 是字幕文档内部实体，两者通过版本化引用关联，不共享生命周期。

### 1.1 命令

| 命令 | 前置状态 | 产出事件 | 说明 |
|---|---|---|---|
| `CreateEditProject` | 不存在 | `EditProjectCreated` | 从 Storyboard 创建剪辑工程 |
| `AddVideoClip` | draft / ready | `VideoClipAdded` | 添加已生成分镜视频；修改后状态回到 draft |
| `AddAudioClip` | draft / ready | `AudioClipAdded` | 添加配音、BGM 或音效 |
| `AddSubtitleCue` | draft / ready | `SubtitleCueAdded` | 添加字幕条目 |
| `UpdateClipTiming` | draft / ready | `ClipTimingUpdated` | 裁剪、移动、时长和转场调整 |
| `SplitClip` | draft / ready | `ClipSplit` | 在有效时间点分割 Clip，来源版本不变 |
| `SetTrackState` | draft / ready | `TrackStateChanged` | 设置锁定、静音或独奏；锁定轨禁止编辑 |
| `SetEditMode` | draft / ready | `EditModeChanged` | 明确 insert/overwrite/ripple 语义 |
| `UpdateAudioMix` | draft / ready | `AudioMixUpdated` | 音量、淡入淡出和声道调整 |
| `UpdateSubtitleStyle` | draft / ready | `SubtitleStyleUpdated` | 更新字幕样式和位置 |
| `CreateEditProjectRevision` | draft / ready | `EditProjectVersionCreated` | 以规范化 Timeline 哈希创建不可变修订，用于保存点/冲突恢复 |
| `RestoreEditProjectRevision` | draft / ready | `EditProjectVersionCreated` | 从历史修订创建新的 head，不改写旧修订 |
| `ExportInterchangePackage` | draft / ready | `InterchangeExportRequested` | 导出标准交换包供外部专业工具继续处理 |
| `StartRender` | draft / ready | `EditRenderRequested` | 创建 RenderJob；冻结当前 revision |
| `MarkRenderReady` | rendering | `EditRenderReady` | RenderJob 完成后进入 ready |
| `ArchiveEditProject` | draft / ready | `EditProjectArchived` | 归档剪辑工程 |

### 1.2 不变量

- 所有 clip 的时间范围必须位于 `[0, timeline.durationMs]`。
- 视频 clip 必须引用本剧集 Storyboard 中存在且未归档的 Shot 视频版本及其 `PresentationSnapshot`；不得只引用可变 URL。
- 音频和字幕必须引用已发布或当前项目可用的资产版本。
- `StartRender` 必须冻结 Timeline、Prompt、模型、资产和字幕版本，确保可追溯和可复现。
- 渲染期间不得修改被冻结的 revision；用户修改时创建新 revision，不覆盖运行中的渲染输入。
- `ready` 后再次编辑必须回到 `draft`，且不得把旧渲染结果当作当前 revision 的成片。
- 所有时间为整数毫秒；裁切/分割后片段时长必须大于 0，轨道锁定时任何修改命令均被拒绝。
- insert/overwrite/ripple 模式必须在命令中显式携带；响应列出所有受影响 Clip，禁止由客户端自行推算后分别提交。
- 每次持久化编辑必须携带 `expectedVersion`；冲突返回最新 revision/headHash，不做最后写入者覆盖。
- 撤销/重做是编辑会话能力；跨保存点恢复必须通过 `RestoreEditProjectRevision` 创建新 revision。
- 自动保存失败不得产生 `EditProjectVersionCreated`；本地恢复草稿不是领域事实，重新提交前必须校验权限、租约和 expectedVersion。
- 交换包必须带 manifest、时间基准、来源媒体版本、内容哈希、缺失/替代报告；导出不改变 EditProject 状态。
- Track ID 在 Timeline 内唯一，`order` 必须非负且在同类轨道内唯一；Clip/Cue ID 在 EditProject 内唯一，且其 `trackId` 必须指向类型匹配的现存轨道。
- Clip 的播放时长为 `(sourceOutMs - sourceInMs) / playbackRate`；`sourceInMs >= 0`、`sourceOutMs > sourceInMs`、`playbackRate > 0`，计算结果及起止位置必须落在整数毫秒和合法帧边界。
- 同一 VideoTrack 的片段默认不得时间重叠；只有 Transition 覆盖的相邻片段可在 `durationMs` 范围内重叠。Transition 必须连接同轨相邻 Clip，时长不得超过任一侧可用媒体范围。
- AudioClip 可重叠混音；`fadeInMs + fadeOutMs` 不得超过片段播放时长，`pan` 取值 `[-1,1]`。solo 存在时仅渲染未 muted 的 solo 音轨。
- `TimelineSubtitleCue.startMs < endMs`，同一字幕轨不得存在不可读重叠；引用 SubtitleDocument 时必须同时固定 documentId、version、sourceCueId 和 `textSnapshot`。
- 所有 Effect/Transition 必须冻结实现 ID、实现版本、参数 schema 版本和参数；找不到相同实现版本时渲染预检必须阻断，不能静默使用最新版。
- Timeline 规范化哈希必须包含 timebase、轨道顺序/状态、全部实体字段、来源版本/哈希、Transition 与 Effect 参数；不得包含 UI 选区、缩放比例、播放头等编辑会话状态。

## 2. 聚合根：AudioAsset

```text
AudioAsset
├── id: string
├── projectId: string
├── type: voice | bgm | sfx
├── sourceType: upload | recording | ai_generated | library
├── status: draft | ready | published | archived
├── fileUrl: string
├── durationMs: number
├── format: mp3 | wav
├── voiceProfileId: string | null
├── rightsMetadata: RightsMetadata
├── version: number
└── createdAt: string
```

关键命令：`CreateAudioAsset`、`AttachAudioFile`、`MarkAudioReady`、`PublishAudioAsset`、`ArchiveAudioAsset`。发布只允许从 `ready` 进入。

## 3. 聚合根：SubtitleDocument

```text
SubtitleDocument
├── id: string
├── projectId: string
├── episodeId: string
├── language: string
├── status: draft | ready | published | archived
├── cues: SubtitleCue[]
├── style: SubtitleStyle
├── sourceType: manual | script | asr | import
├── version: number
└── updatedAt: string
```

关键命令：`CreateSubtitleDocument`、`ImportSubtitle`、`GenerateSubtitleFromScript`、`UpdateSubtitleCue`、`MarkSubtitleReady`、`PublishSubtitleDocument`。

## 4. 聚合根：RenderJob

状态机：`queued → running → completed | failed | cancelled`，失败可在最大次数内 `failed → queued`。

渲染成功发布 `RenderCompleted`，由发布交付上下文创建 `FinalVideo(status=draft)`；失败发布 `RenderFailed`，由智能助手创建告警工作项，并由通知上下文投递给剪辑/制片责任人。

## 5. 领域事件

| 事件 | Payload | 消费者 / 消费动作 |
|---|---|---|
| `EditProjectCreated` | editProjectId, projectId, episodeId, revision | 智能助手：更新项目工作台 |
| `EditProjectVersionCreated` | editProjectId, projectId, revision, timelineHash, dependencyRefs[] | 智能助手：登记 DEP 剪辑依赖 |
| `ClipSplit` / `TrackStateChanged` / `EditModeChanged` | editProjectId, revision, affectedTrackIds, affectedClipIds | 后期制作读模型：刷新时间线 |
| `EditRenderRequested` | renderJobId, editProjectId, revision, renderSnapshotHash | 后期渲染器：创建并调度 RenderJob |
| `RenderCompleted` | renderJobId, projectId, editProjectId, editProjectRevision, renderArtifactId, artifactHash, renderSnapshotHash, dependencyRefs[] | 发布交付：创建成片草稿；智能助手：更新导出与 DEP 制品链 |
| `RenderFailed` | renderJobId, projectId, errorCategory, errorMessage | 智能助手、通知：创建告警工作项并通知责任人 |
| `AudioGenerationRequested` | projectId, editProjectId, generationInputSnapshot | AI 任务调度：创建 `AITask(type=audio)` |
| `AudioAssetPublished` | audioAssetId, projectId, version, contentHash, sourceRefs[] | 后期制作：允许在时间线引用；智能助手：登记 DEP 音频证据 |
| `SubtitleDocumentPublished` | subtitleDocumentId, projectId, version, contentHash, sourceRefs[] | 发布交付：纳入发布预检；智能助手：登记 DEP 字幕证据 |
| `InterchangeExportRequested` | exportJobId, editProjectId, revision, format, manifestHash | 智能助手：显示后台导出任务 |
| `InterchangeExportCompleted` | exportJobId, editProjectId, revision, packageFileId, packageHash, warnings[] | 智能助手：交付下载与审计 |
