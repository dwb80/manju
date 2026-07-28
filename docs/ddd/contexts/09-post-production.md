# 3.9 后期制作上下文 (Post Production)

> **所属上下文**：后期制作 (Post Production)
> **聚合根**：`EditProject` / `AudioAsset` / `SubtitleDocument` / `RenderJob`
> **对应页面**：音频中心、剪辑中心
> **配套规范**：[统一语言术语表](../glossary.md)｜[上下文映射](../context-map.md)｜[跨上下文协作契约](../contracts.md)
> **迁移规范**：历史 `Audio` / `project_clips` 的映射、双读核对、切换和回滚见[数据生命周期与迁移方案](../../product/data-lifecycle-and-migration.md)。新功能不得继续扩展旧模型。

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
├── version: number
├── createdAt: string
└── updatedAt: string

Timeline
├── durationMs: number
├── videoTracks: VideoTrack[]
├── audioTracks: AudioTrack[]
└── subtitleTracks: SubtitleTrack[]
```

`VideoClip`、`AudioClip`、`SubtitleCue` 均为聚合内实体，只持有来源资产 ID 和来源版本，不持有外部聚合对象。

### 1.1 命令

| 命令 | 前置状态 | 产出事件 | 说明 |
|---|---|---|---|
| `CreateEditProject` | 不存在 | `EditProjectCreated` | 从 Storyboard 创建剪辑工程 |
| `AddVideoClip` | draft / ready | `VideoClipAdded` | 添加已生成分镜视频；修改后状态回到 draft |
| `AddAudioClip` | draft / ready | `AudioClipAdded` | 添加配音、BGM 或音效 |
| `AddSubtitleCue` | draft / ready | `SubtitleCueAdded` | 添加字幕条目 |
| `UpdateClipTiming` | draft / ready | `ClipTimingUpdated` | 裁剪、移动、时长和转场调整 |
| `UpdateAudioMix` | draft / ready | `AudioMixUpdated` | 音量、淡入淡出和声道调整 |
| `UpdateSubtitleStyle` | draft / ready | `SubtitleStyleUpdated` | 更新字幕样式和位置 |
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

| 事件 | 消费者 | 消费动作 |
|---|---|---|
| `EditProjectCreated` | 智能助手 | 更新项目工作台 |
| `EditRenderRequested` | 后期渲染器 | 创建并调度 RenderJob |
| `RenderCompleted` | 发布交付、智能助手 | 创建成片草稿、更新导出状态 |
| `RenderFailed` | 智能助手、通知 | 创建告警工作项并通知责任人 |
| `AudioGenerationRequested` | AI 任务调度 | 创建 `AITask(type=audio)` |
| `AudioAssetPublished` | 后期制作 | 允许在时间线引用 |
| `SubtitleDocumentPublished` | 发布交付 | 纳入发布预检 |
