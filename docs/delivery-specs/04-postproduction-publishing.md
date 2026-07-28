# 后期制作与发布功能交付规格

> 共享规则见 [00-common-contract.md](00-common-contract.md)。本册覆盖 US-013～US-017、US-021。

## US-013 音频管理

### 页面交互规格

- 路由：`/projects/{projectId}/audio`；按 dialogue/voiceover/music/sfx 分类，支持名称、状态、说话人、语言、标签筛选。
- 上传或 AI 配音均先创建候选；显示波形、时长、响度、采样率、授权和来源。发布前完成文件校验、病毒扫描、响度/削波检查。
- AudioClip 在时间轴引用精确 AudioAsset 版本；替换资产先显示受影响 Shot/Clip，已冻结快照不自动替换。

### API 契约

| 方法与路径 | 请求/响应 | 约束与错误 |
|---|---|---|
| `POST /api/v1/projects/{id}/audio-assets` | `{commandId,type,name,mediaId,language?,speakerRef?,licenseRef?,source}`；201 draft | 幂等；媒体已扫描 |
| `POST /api/v1/audio-generation-jobs` | `{commandId,projectId,type,text?,scriptLineRef?,voiceModelRef?,targetVersion,maxCost}`；202 AITask | 预算/授权校验 |
| `POST /api/v1/audio-assets/{id}/publish` | `{commandId}`；返回 publishedVersion | `audio_precheck_failed` |
| `GET /api/v1/projects/{id}/audio-assets` | 分类/状态/说话人/语言筛选 | 稳定分页 |

### 数据模型

- `audio_assets(id,project_id,type,name,status,current_published_version,version,...soft_delete)` 与不可变 `audio_asset_versions(id,audio_asset_id,asset_version,media_id,duration_ms,loudness_lufs,sample_rate,channels,language,speaker_ref,license_ref,source_json,content_hash)`。
- AI 音频任务仍属于 `ai_tasks`；禁止恢复旧 Audio 聚合或写 `/audios` 事实源。

### 可执行验收用例

```gherkin
@US-013 @e2e @p0
Scenario: US-013-S01 发布音效并绑定时间轴
  Given 已上传音效通过扫描和响度检查
  When 音频编辑发布版本1并加入 Shot 时间轴
  Then AudioClip 保存 audioAssetId 和 assetVersion=1

Scenario: US-013-S02 新音频版本不改写已冻结快照
  Given snapshot A 引用旁白版本2
  When 用户发布旁白版本3
  Then snapshot A 仍引用版本2且页面只提示可升级
```

## US-014 字幕管理

### 页面交互规格

- 字幕面板支持从剧本/语音识别生成、SRT/VTT 导入、逐 cue 编辑、波形对齐和双语轨道。
- 每条 cue 校验开始小于结束、在成片范围内、同轨重叠规则、阅读速度和安全区；错误定位到具体 cue。
- 发布创建不可变字幕版本；导入先预览编码、语言、时间偏移和冲突，不直接覆盖当前版本。

### API 契约

| 方法与路径 | 请求/响应 | 约束与错误 |
|---|---|---|
| `POST /api/v1/projects/{id}/subtitle-documents` | `{commandId,name,language,sourceType,sourceRef?}` | 幂等 |
| `POST /api/v1/subtitle-documents/{id}/imports` | multipart/媒体引用 + format/offsetMs；返回预检 | 不直接写 cue |
| `PUT /api/v1/subtitle-documents/{id}/cues` | `{commandId,cues[]}`；返回 version/issues | `If-Match`；最多5000 cue |
| `POST /api/v1/subtitle-documents/{id}/publish` | 发布并返回 documentVersion | 阻断错误必须归零 |

### 数据模型

- `subtitle_documents(id,project_id,name,language,status,version,...)`；`subtitle_cues(id,document_id,track,start_ms,end_ms,text,speaker_ref,style_json,sort_key)`。
- `subtitle_document_versions` 保存规范化完整 cue 快照、hash 和来源；发布版本不可变。

### 可执行验收用例

```gherkin
@US-014 @e2e @p0
Scenario: US-014-S01 导入预览后发布字幕
  Given 合法 UTF-8 SRT 和60秒成片
  When 用户预览、确认并发布
  Then 所有 cue 位于0至60秒且产生不可变字幕版本

Scenario: US-014-S02 阻止结束早于开始的 cue
  Given 用户编辑一个 cue
  When 提交 startMs=5000 endMs=4000
  Then API 返回 validation_failed 并包含 cueId 和字段路径
```

## US-015 视频剪辑与渲染

### 页面交互规格

- 剪辑中心包含视频、音频、字幕多轨时间轴和预览；Clip 拖拽、裁剪、分割、转场、音量调整均支持撤销/重做。
- 每个 VideoClip 必须引用生成视频版本和 PresentationSnapshot；缺失媒体显示占位和修复入口，不静默移除。
- 保存采用工程版本；渲染前执行引用、时长、字幕、响度、画幅、QC 和预算预检。渲染任务可取消/重试并显示日志摘要。

### API 契约

| 方法与路径 | 请求/响应 | 约束与错误 |
|---|---|---|
| `GET /api/v1/edit-projects/{id}` | 工程、轨道、clips、version、媒体可用性 | 项目范围 |
| `PUT /api/v1/edit-projects/{id}/timeline` | `{commandId,tracks,clips,transitions,durationMs}` | `If-Match`；原子替换当前版本 |
| `POST /api/v1/edit-projects/{id}/render-precheck` | 返回 blockers/warnings/inputHash | 只读 |
| `POST /api/v1/edit-projects/{id}/render-jobs` | `{commandId,projectVersion,precheckDigest,renderProfileId}`；202 | 幂等输入哈希 |
| `GET /api/v1/render-jobs/{id}` | 状态/进度/output/error/deadline | 完整终态 |

### 数据模型

- `edit_projects(id,project_id,episode_id,status,current_version,version)`；`edit_project_versions(id,edit_project_id,edit_version,timeline_json,input_hash,created_at)`。
- 规范化时使用 `edit_tracks`、`edit_clips` 作为当前草稿事实源；Clip 含 sourceType/sourceId/sourceVersion/snapshotId/in/out/timelineStart/effects。
- `render_jobs` 保存 edit_version、input_hash、profile_version、output_media_id、状态和 attempt。

### 可执行验收用例

```gherkin
@US-015 @e2e @p0
Scenario: US-015-S01 从冻结工程版本渲染
  Given 工程版本8所有媒体可用且预检通过
  When 用户发起正式渲染后继续编辑工程
  Then RenderJob 仍使用版本8且新编辑成为版本9

Scenario: US-015-S02 并发保存时间轴不丢失
  Given 两个剪辑师都打开版本6
  When 甲保存版本7后乙保存
  Then 乙收到 version_conflict 并可比较本地修改与版本7
```

## US-016 成片两级审核

### 页面交互规格

- 成片提交页显示 RenderJob、QC、字幕/音频/画幅预检、版本和发布候选信息；存在 blocker 不可提交。
- first 与 second 两级依次进行，审核人不得是提交人，二审不得与一审为同一人。任何 request_changes 终止当前链并创建返工项。
- 决策详情不可编辑；重新渲染必须创建新的审核链，旧链保留。

### API 契约

| 方法与路径 | 请求/响应 | 约束与错误 |
|---|---|---|
| `POST /api/v1/final-videos` | `{commandId,renderJobId,mediaId,mediaDigest,editProjectVersion}`；201 FinalVideo | 只接受成功 RenderJob |
| `POST /api/v1/final-videos/{id}/review-submissions` | `{commandId,finalVideoVersion,precheckDigest}`；返回 first Review | 幂等 |
| `POST /api/v1/reviews/{id}/decisions` | 决策；first approve 自动创建/激活 second | `reviewer_separation_required` |
| `GET /api/v1/final-videos/{id}/review-chain` | 两级状态、决定和时间 | 项目范围 |

### 数据模型

- `final_videos(id,project_id,episode_id,current_version,status,version)`；`final_video_versions(id,final_video_id,video_version,media_id,media_digest,edit_project_version,qc_report_id,created_at)`。
- Review `stage=first|second`；唯一 `(target_id,target_version,stage)`；数据库/服务同时校验 submitter、firstReviewer、secondReviewer 不相等。

### 可执行验收用例

```gherkin
@US-016 @e2e @p0
Scenario: US-016-S01 两名审核人依次批准成片
  Given 成片由剪辑师提交并通过QC
  When 审核人甲通过初审且审核人乙通过复审
  Then FinalVideo 状态为 approved 且审核链保留两条独立决定

Scenario: US-016-S02 阻止同一人完成两级审核
  Given 审核人甲已完成初审
  When 甲尝试提交复审决定
  Then API 返回 reviewer_separation_required 且复审保持 pending
```

## US-017 发布管理

### 页面交互规格

- 发布准备页以成片版本为中心；每个平台独立选择账号引用、标题、简介、封面、标签、可见性和计划时间，并实时显示平台限制。
- 批量发布只是多个独立 PublishPlan 的 app batch；单平台失败不回滚已成功平台。预检展示审核、版权、画幅、时长、凭据和限流问题。
- 状态 `unknown_result` 必须先对账，禁止直接重试；记录 providerRequestId、远端 URL、失败分类和指标同步状态。

### API 契约

| 方法与路径 | 请求/响应 | 约束与错误 |
|---|---|---|
| `POST /api/v1/publish-plans` | `{commandId,finalVideoId,videoVersion,platform,credentialRef,metadata,scheduleAt?,batchId?}`；201 plan | 每平台独立；幂等 |
| `POST /api/v1/publish-plans/{id}/precheck` | adapterVersion、blockers、warnings | 不泄露凭据 |
| `POST /api/v1/publish-plans/{id}/execute` | `{commandId,precheckDigest}`；202 record | `publish_precheck_failed` |
| `POST /api/v1/publish-records/{id}/reconcile` | 查询远端并收敛结果 | unknown_result only |
| `GET /api/v1/publish-records/{id}/metrics` | 版本化指标快照 | 平台支持时 |

### 数据模型

- `publish_plans(id,project_id,final_video_id,video_version,platform,credential_ref,adapter_version,metadata_json,schedule_at,status,batch_id,version)`。
- `publish_records(id,plan_id,attempt,provider_request_id,status,remote_id,remote_url,error_class,error_code,started_at,completed_at)` 追加写。
- `publish_metric_snapshots(id,record_id,captured_at,metrics_json,adapter_version)`；唯一 `(record_id,captured_at)`。

### 可执行验收用例

```gherkin
@US-017 @integration @p0
Scenario: US-017-S01 多平台发布保持结果隔离
  Given 同一成片创建B站和抖音两个计划
  When B站成功而抖音返回不可重试版权错误
  Then B站记录为 succeeded、抖音为 failed 且成功记录不回滚

Scenario: US-017-S02 未知结果先对账再决定重试
  Given Provider 接收请求后网络断开且记录为 unknown_result
  When 用户点击重试
  Then 系统先执行 reconcile 且在确认远端不存在前不创建新发布请求
```

## US-021 剪辑片段管理

### 页面交互规格

- Clip 是剪辑工程内实体，不提供与 EditProject 脱离的独立事实页；在时间轴和素材栏创建、复制、分割、裁剪、删除。
- 属性面板显示源媒体版本、快照、源入出点、时间线位置、速度、音量和效果；所有修改进入工程撤销栈。
- 删除只移除工程引用，不删除源媒体；引用不可用时显示修复/替换，替换必须预览时长变化。

### API 契约

| 方法与路径 | 请求/响应 | 约束与错误 |
|---|---|---|
| `POST /api/v1/edit-projects/{id}/clips` | `{commandId,trackId,sourceRef,sourceInMs,sourceOutMs,timelineStartMs,properties}` | EditProject `If-Match` |
| `PUT/DELETE /api/v1/edit-projects/{id}/clips/{clipId}` | 完整 Clip/204 | 同一 UoW 更新工程版本 |
| `POST /api/v1/edit-projects/{id}/clips/{clipId}:split` | `{commandId,atSourceMs}`；返回两个 Clip | 边界内且幂等 |

### 数据模型

- `edit_clips(id,edit_project_id,track_id,source_type,source_id,source_version,snapshot_id,source_in_ms,source_out_ms,timeline_start_ms,properties_json,sort_key)`；Clip 生命周期从属于 EditProject。
- 禁止继续以项目级 `/clips` 写第二份事实；兼容路由只转发到 EditProject 命令并返回 deprecation header。

### 可执行验收用例

```gherkin
@US-021 @e2e @p0
Scenario: US-021-S01 分割片段保持连续源范围
  Given Clip 源范围0至10秒位于时间线5秒
  When 在源4秒处分割
  Then 两个 Clip 源范围分别0至4秒和4至10秒且时间线连续

Scenario: US-021-S02 删除 Clip 不删除源媒体
  Given 两个工程引用同一视频版本
  When 在其中一个工程删除 Clip
  Then 另一工程引用和源媒体仍可用
```

