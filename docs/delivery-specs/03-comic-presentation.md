# 漫剧专业表现功能交付规格

> 共享规则见 [01-common-contract.md](01-common-contract.md)。本册覆盖 MANGA-001～MANGA-008；所有坐标采用相对画布的 0～1 规范化坐标，时间采用整数毫秒。

## MANGA-001 项目表现规格

### 页面交互规格

- 路由：`/projects/{projectId}/settings/presentation`；owner/admin 可修改，producer/director 可查看影响分析。
- 字段：画幅预设 9:16/16:9/custom、自定义宽高、播放方向、主体安全区、文字安全区、平台遮挡区模板；编辑器实时叠加预览。
- 保存前先运行影响分析，按 draft/送审/批准分类列出受影响 Shot。已送审或批准内容必须勾选“创建新版本”，禁止原地覆盖。

### API 契约

| 方法与路径 | 请求/响应 | 约束与错误 |
|---|---|---|
| `GET /api/v1/projects/{id}/presentation-spec` | 当前规格、version、来源模板 | 项目成员可读 |
| `POST /api/v1/projects/{id}/presentation-spec-impact` | 候选 spec；返回 `{counts,shots[],requiresNewVersions}` | 只读分析 |
| `PUT /api/v1/projects/{id}/presentation-spec` | `{commandId,spec,createNewShotVersions}`；返回新版本/eventId | `If-Match`；`snapshot_immutable` |

### 数据模型

- `project_presentation_specs(project_id,version,aspect_ratio_json,play_direction,safe_areas_json,platform_template_refs_json,schema_version,created_by,created_at)` 追加版本；Project 保存 current version。
- 安全区矩形必须位于画布内；自定义宽高 1～8192 且比例 0.25～4。

### 可执行验收用例

```gherkin
@MANGA-001 @e2e @p0
Scenario: MANGA-001-S01 变更画幅前展示影响并版本化
  Given 项目包含1个已批准 Shot 和2个草稿 Shot
  When 管理员把画幅从9:16改为16:9并确认创建新版本
  Then 影响页显示3项且已批准 Shot 保留旧快照并产生新草稿版本

Scenario: MANGA-001-S02 拒绝越界安全区
  Given 用户正在编辑项目表现规格
  When 提交右边界为1.1的文字安全区
  Then API 返回 validation_failed 且页面标出该边界
```

## MANGA-002 图层化构图

### 页面交互规格

- Shot 导演台包含画布、图层树和属性面板；支持背景、角色、道具、前景、遮罩，键盘可排序和变换。
- 每层展示锁定、可见、时间范围和资产版本；资产未发布/已归档不可绑定。模板应用先预览差异，应用后仍可编辑并保留模板版本来源。
- 多选变换作为一个撤销单元；保存冲突不得静默合并同一图层属性。

### API 契约

| 方法与路径 | 请求/响应 | 约束与错误 |
|---|---|---|
| `PUT /api/v1/shots/{id}/composition` | `{commandId,canvas,safeAreaVersion,visualFlow}` | `If-Match`；返回 Shot version |
| `POST /api/v1/shots/{id}/visual-layers` | `{commandId,layer:{type,assetRef?,transform,zIndex,opacity,timeRange}}` | 幂等；`asset_version_unavailable` |
| `PUT/DELETE /api/v1/shots/{id}/visual-layers/{layerId}` | 完整 layer/无响应体 | Shot `If-Match`，Shot 内原子保存 |
| `POST /api/v1/shots/{id}/composition-templates/{templateId}:apply` | `{commandId,templateVersion,bindings}` | 返回差异和新 version |

### 数据模型

- `shot_visual_layers(id,shot_id,type,asset_type,asset_id,asset_version,transform_json,z_index,opacity,start_ms,end_ms,template_id,template_version)`；唯一 `(shot_id,id)` 和 `(shot_id,z_index)`。
- 变换 schema 固定 `x,y,width,height,rotation,anchorX,anchorY`；时间范围必须在 Shot 时长内；所有子表随 Shot version 乐观锁提交。

### 可执行验收用例

```gherkin
@MANGA-002 @e2e @p0
Scenario: MANGA-002-S01 创建可复现角色图层
  Given Character char_1 的版本3已发布
  When 导演把该版本加入 Shot 并设置位置、层级和时间范围
  Then 图层保存 assetId=char_1、assetVersion=3 且刷新后变换一致

Scenario: MANGA-002-S02 阻止绑定未发布资产
  Given Character char_2 仍为 draft
  When 用户把它拖入画布
  Then API 返回 409 asset_version_unavailable 且 Shot version 不变
```

## MANGA-003 对白气泡与旁白

### 页面交互规格

- 文字工具提供 dialogue_bubble、thought_bubble、narration_box、title；对白必须从剧本行选择说话人，旁白可无角色。
- 属性面板控制字体授权、字号、字重、颜色、描边、背景、尾巴、位置、宽度和入退场；实时显示越界、遮挡和重叠问题。
- 剧本行变化显示源文本/当前排版差异，可选择同步文本或保留并登记例外，禁止静默覆盖。

### API 契约

| 方法与路径 | 请求/响应 | 约束与错误 |
|---|---|---|
| `POST /api/v1/shots/{id}/text-overlays` | `{commandId,type,scriptLineRef?,speakerRef?,text,typography,box,tail,timeRange,fontLicenseRef}` | Shot `If-Match` |
| `PUT/DELETE /api/v1/shots/{id}/text-overlays/{overlayId}` | 完整对象/204 | `text_source_stale`、`font_unlicensed` |
| `POST /api/v1/shots/{id}/text-layout-precheck` | 返回越界、主体遮挡、重叠和字体问题及定位 | 不改变 Shot |

### 数据模型

- `shot_text_overlays(id,shot_id,type,script_document_id,script_line_id,source_text_hash,speaker_asset_id,text,typography_json,box_json,tail_json,start_ms,end_ms,font_license_id,exception_id)`。
- dialogue/thought 必须有 script_line_id 和 speaker；字体授权记录不可只保存自由文本 URL。

### 可执行验收用例

```gherkin
@MANGA-003 @e2e @p0
Scenario: MANGA-003-S01 对白气泡绑定剧本行并通过预检
  Given 已发布剧本行由角色阿青说“快走”且字体已授权
  When 导演创建对白气泡并放在文字安全区内
  Then overlay 保存剧本行、说话人和字体版本且预检无阻断项

Scenario: MANGA-003-S02 剧本变化不覆盖人工排版
  Given 气泡引用的对白源文本已变化
  When 用户重新打开 Shot
  Then 页面显示差异且数据库中的排版文本在用户确认前不变
```

## MANGA-004 拟声词管理

### 页面交互规格

- 拟声词可从受控词库搜索或自定义；编辑文本、语言、强度、字形、方向、透视、位置、层级、动画和时间范围。
- 可关联已发布 SFX AudioAsset 版本；移动/裁剪时间时弹出“同步音效/仅调整文字”，记住本次选择但不改变全局默认。
- 词库项显示语气、默认样式、推荐音效标签；自定义词不自动进入全局词库。

### API 契约

| 方法与路径 | 请求/响应 | 约束与错误 |
|---|---|---|
| `GET /api/v1/onomatopoeia-lexicon` | q/language/tone；返回词和默认样式 | 稳定分页 |
| `POST /api/v1/shots/{id}/text-overlays` | type=`onomatopoeia`，含 glyph/perspective/intensity/sfxRef | Shot `If-Match` |
| `PUT /api/v1/shots/{id}/text-overlays/{id}/timing` | `{commandId,startMs,endMs,syncSfx}` | 音效冲突返回 `audio_timing_conflict` |

### 数据模型

- 拟声词复用 `shot_text_overlays`，`type=onomatopoeia` 时 `onomatopoeia_json` 必填，允许 `audio_asset_id/audio_asset_version/audio_clip_id`。
- `onomatopoeia_lexicon(id,language,text,tone,default_style_json,recommended_sfx_tags_json,status,version)`；规范化 `(language,text,tone)` 唯一。

### 可执行验收用例

```gherkin
@MANGA-004 @e2e @p0
Scenario: MANGA-004-S01 同步调整拟声词和音效
  Given 拟声词“砰”关联2至3秒的已发布音效
  When 用户把拟声词移动到4至5秒并选择同步音效
  Then overlay 与 AudioClip 都为4至5秒且快照引用同一音频版本

Scenario: MANGA-004-S02 自定义词不污染受控词库
  Given 普通导演无词库管理权限
  When 创建自定义拟声词“咻啪”
  Then Shot 保存该 overlay 但全局词库无新增记录
```

## MANGA-005 漫画特效

### 页面交互规格

- 特效面板首批提供速度线、集中线、冲击、闪白、震屏、色调、景深、颗粒；每种特效只显示其 schema 定义的参数。
- 时间轴可调开始/结束、强度、层级和遮罩。未知/过期 schema 可只读查看，不能进入最终渲染。
- 光敏风险实时提示；项目禁用时对应特效入口不可用，已有特效显示阻断状态。

### API 契约

| 方法与路径 | 请求/响应 | 约束与错误 |
|---|---|---|
| `GET /api/v1/comic-effect-types` | 返回 type/schemaVersion/parameterSchema/riskRules | 可缓存，带 ETag |
| `POST /api/v1/shots/{id}/comic-effects` | `{commandId,type,schemaVersion,parameters,mask,zIndex,timeRange,intensity}` | `effect_schema_invalid` |
| `PUT/DELETE /api/v1/shots/{id}/comic-effects/{effectId}` | 完整对象/204 | Shot `If-Match` |
| `POST /api/v1/shots/{id}/effect-safety-precheck` | 风险等级、规则版本、定位和阻断标志 | 不修改数据 |

### 数据模型

- `shot_comic_effects(id,shot_id,type,schema_version,parameters_json,mask_json,z_index,start_ms,end_ms,intensity,risk_class)`。
- `comic_effect_schemas(type,schema_version,json_schema,risk_rules_json,status,published_at)` 不可覆盖已发布版本；快照保存精确版本。

### 可执行验收用例

```gherkin
@MANGA-005 @integration @p0
Scenario: MANGA-005-S01 按 schema 保存受控特效
  Given 速度线 schema v2 要求 direction 和 density
  When 用户提交合法参数
  Then 特效保存 schemaVersion=2 且预览与渲染读取同一参数

Scenario: MANGA-005-S02 光敏风险阻断发布预检
  Given 项目禁用高频闪烁且 Shot 含超阈值闪白
  When 执行发布预检
  Then 返回 photic_risk_blocked 并定位到 effectId 和时间段
```

## MANGA-006 有限动态编排

### 页面交互规格

- 时间轴支持推、拉、摇、移、缩放、淡入淡出、视差、震动、循环；选择 cue 后显示目标图层、属性、起止值、缓动和优先级。
- 同一图层同一属性的重叠 cue 在保存前高亮；无明确优先级时阻止保存。预览可降分辨率但时间和变换必须与渲染一致。
- 口型/表情驱动必须选择对白或 AudioAsset 版本，显示模型来源和可撤销的生成结果。

### API 契约

| 方法与路径 | 请求/响应 | 约束与错误 |
|---|---|---|
| `POST /api/v1/shots/{id}/motion-cues` | `{commandId,type,targetLayerId,property,from,to,easing,startMs,endMs,priority,driverRef?}` | `motion_overlap_conflict` |
| `PUT/DELETE /api/v1/shots/{id}/motion-cues/{cueId}` | 完整 cue/204 | Shot `If-Match` |
| `POST /api/v1/shots/{id}/previews` | `{commandId,presentationVersion,quality:"proxy"}`；202 render job | 输入哈希幂等 |

### 数据模型

- `shot_motion_cues(id,shot_id,type,target_layer_id,property,from_json,to_json,easing,start_ms,end_ms,priority,driver_type,driver_id,driver_version,model_snapshot_json)`。
- targetLayer 必须属于同一 Shot；时间位于 Shot 时长；相同 target/property/time 重叠需唯一优先级。

### 可执行验收用例

```gherkin
@MANGA-006 @e2e @p0
Scenario: MANGA-006-S01 代理预览与最终参数一致
  Given Shot 有0至2秒的缩放 cue
  When 分别生成代理预览和最终渲染
  Then 两者输入快照中的 cue 规范化 JSON 和时间完全相同

Scenario: MANGA-006-S02 阻止无优先级的重叠动作
  Given 同一图层 x 属性已有0至2秒动作
  When 新增1至3秒且无优先级的 x 动作
  Then API 返回 409 motion_overlap_conflict 且给出冲突 cueId
```

## MANGA-007 一致性检查

### 页面交互规格

- 质检中心可按项目/剧集/Shot/严重度/规则筛选；问题卡片直接导航到图层和时间点。
- 报告固定规则集版本；用户可重跑产生新报告，不覆盖旧报告。人工豁免必须填写原因、范围和到期条件。
- queued/running/timed_out/failed 均有明确状态；超时提供有上限重试和人工接管。

### API 契约

| 方法与路径 | 请求/响应 | 约束与错误 |
|---|---|---|
| `POST /api/v1/qc-reports` | `{commandId,targetType,targetId,targetVersion,ruleSetId,ruleSetVersion}`；202 report | 幂等输入哈希 |
| `GET /api/v1/qc-reports/{id}` | 状态、deadlineAt、issues、summary、规则版本 | 项目范围 |
| `POST /api/v1/qc-reports/{id}/waivers` | `{commandId,issueIds[],reason,scope,expiresAt?}` | `quality.waive` 权限；审计 |
| `POST /api/v1/qc-reports/{id}/retry` | 新 reportId，引用 previousReportId | 终态才允许 |

### 数据模型

- `qc_reports(id,target_type,target_id,target_version,input_hash,rule_set_id,rule_set_version,status,deadline_at,attempt,previous_report_id,summary_json,...)`。
- `qc_issues(id,report_id,rule_id,severity,shot_id,layer_id,start_ms,end_ms,message,evidence_json)`；`qc_waivers` 追加写并记录 actor/reason/scope。

### 可执行验收用例

```gherkin
@MANGA-007 @e2e @p0
Scenario: MANGA-007-S01 质检问题定位到具体图层
  Given 相邻 Shot 的同一角色服装版本不一致
  When 一致性检查完成
  Then 报告包含两个 Shot 和角色图层 ID 且点击可打开对应时间点

Scenario: MANGA-007-S02 豁免必须留痕且不删除原问题
  Given reviewer 看到一个 warning 问题
  When 具有 waive 权限的用户填写原因并豁免
  Then 原 issue 保留、状态显示 waived 且存在 AuditRecord
```

## MANGA-008 可复现快照与交付

### 页面交互规格

- “送审”前显示快照清单：资产、剧本、构图、文字、特效、动态、音频、字体、模型和预检结论；阻断项必须归零。
- 确认后生成不可变快照并进入审核；后续任何编辑创建新 Shot version，旧审核结论只绑定旧 snapshotHash。
- 快照详情支持查看依赖版本和差异，但不允许编辑；相同输入重复提交返回同一结果。

### API 契约

| 方法与路径 | 请求/响应 | 约束与错误 |
|---|---|---|
| `POST /api/v1/shots/{id}/presentation-precheck` | `{shotVersion}`；返回 blockers/warnings/inputDigest | 只读 |
| `POST /api/v1/shots/{id}/review-submissions` | `{commandId,shotVersion,expectedPrecheckDigest}`；201 `{snapshotId,snapshotHash,reviewId,eventId}` | 幂等；`precheck_changed` |
| `GET /api/v1/presentation-snapshots/{id}` | 规范化快照、hash、依赖和来源 | 不可变、按权限脱敏 Prompt 私密变量 |

### 数据模型

- `presentation_snapshots(id,shot_id,shot_version,schema_version,canonical_json,snapshot_hash,created_by,created_at)`；唯一 `(shot_id,shot_version,snapshot_hash)`，不可更新/删除。
- `presentation_snapshot_dependencies(snapshot_id,dependency_type,dependency_id,dependency_version,digest)`；Review/RenderJob 均保存 snapshot_id+snapshot_hash。
- 哈希算法和规范化版本显式保存；相同规范化输入必须得到相同哈希。

### 可执行验收用例

```gherkin
@MANGA-008 @integration @p0
Scenario: MANGA-008-S01 重复送审相同输入保持幂等
  Given Shot 版本12通过表现预检
  When 使用同一输入和幂等键提交两次送审
  Then 返回同一 snapshotId、snapshotHash 和 reviewId

Scenario: MANGA-008-S02 新版本不继承旧审核结论
  Given snapshot A 已批准
  When 用户修改气泡并提交 snapshot B
  Then B 创建新的 Review 且 A 的批准状态保持不变但不适用于 B
```
