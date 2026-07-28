# 项目、剧本与分镜功能交付规格

> 共享规则见 [00-common-contract.md](00-common-contract.md)。本册覆盖 US-001～US-006。

## US-001 创建新项目

### 页面交互规格

- 路由：`/projects` 列表，`/projects/new` 创建页，成功后进入 `/projects/{projectId}/workspace`。
- 角色：已认证成员可创建；创建者成为 owner。表单字段为名称、类型、描述、默认画幅；名称/类型/描述必填，名称 1～100 字符。
- 提交时锁定主按钮并携带幂等键；成功展示初始化进度，项目、第 1 集和空分类全部投影后跳转。重复名在名称字段显示冲突，不清空输入。
- 列表支持关键词、状态、所有者筛选和软删除切换；删除入口仅对有权限用户显示。

### API 契约

| 方法与路径 | 请求/响应 | 约束与错误 |
|---|---|---|
| `POST /api/v1/projects` | 请求 `{commandId,name,type,description,presentationSpec}`；201 `{data:{id,name,status:"active",ownerId,episodeId,version,eventId}}` | `Idempotency-Key` 必填；`duplicate_project_name`、`validation_failed` |
| `GET /api/v1/projects` | `cursor,pageSize,q,status,ownerId,includeDeleted`；返回稳定分页摘要 | `includeDeleted` 需 `project.restore` |
| `GET /api/v1/projects/{id}` | 返回详情、权限能力和投影 watermark | 项目范围授权 |

### 数据模型

- `projects(id, owner_id, name, normalized_name, type, description, status, presentation_spec_json, presentation_spec_version, version, created_at, ...soft_delete)`；唯一 `(owner_id, normalized_name)` where 未删除。
- `project_members(project_id,user_id,role,allow_json,deny_json,version)`；创建事务写 owner。
- 同一事务创建 `episodes` 第 1 集、项目分类投影和 Outbox `ProjectCreated`；任一步失败整体回滚。

### 可执行验收用例

```gherkin
@US-001 @e2e @p0
Scenario: US-001-S01 创建项目且重复提交幂等
  Given 活跃用户具有 project.create 权限
  When 使用同一 Idempotency-Key 连续两次提交合法项目
  Then 两次响应返回同一 projectId 且数据库只有一个项目和一个第1集

Scenario: US-001-S02 拒绝同所有者重名项目
  Given 所有者已有规范化名称为“山海”的未删除项目
  When 创建名称为“ 山海 ”的项目
  Then API 返回 409 duplicate_project_name 且页面保留输入并聚焦名称
```

## US-002 创建剧集

### 页面交互规格

- 路由：`/projects/{projectId}/episodes`；owner/admin 可见“新建剧集”，其他角色只读。
- 抽屉字段：标题、可选序号、描述；序号为空时预览“自动取最大序号+1”。标题 1～100 字符，序号 1～999。
- 创建成功将新行插入正确序号位置并进入剧本入口；项目归档时所有写入口禁用并说明原因。
- 删除前显示依赖预检；存在分镜或成片时列出对象链接，不提供强制绕过。

### API 契约

| 方法与路径 | 请求/响应 | 约束与错误 |
|---|---|---|
| `POST /api/v1/projects/{projectId}/episodes` | `{commandId,title,episodeNumber?,description?}`；201 `{data:{id,episodeNumber,status,scriptId,storyboardId,version,eventId}}` | 幂等；`episode_number_conflict`、`project_archived` |
| `GET /api/v1/projects/{projectId}/episodes` | 稳定按 episodeNumber 排序 | 项目成员可读 |
| `POST /api/v1/episodes/{id}/deletion-precheck` | 返回 `{allowed,blockers[]}` | 不修改数据 |

### 数据模型

- `episodes(id,project_id,episode_number,title,description,status,version,...soft_delete)`；未删除唯一 `(project_id,episode_number)`。
- `scripts` 与 `storyboards` 在创建事务内初始化；资产分类为项目级读模型，不为每集复制事实源。
- 项目归档将剧集状态改为 archived；恢复项目不自动恢复剧集，避免越过人工判断。

### 可执行验收用例

```gherkin
@US-002 @e2e @p0
Scenario: US-002-S01 自动分配剧集序号并初始化子资源
  Given 项目已有第1集且操作者为 admin
  When 创建未指定 episodeNumber 的剧集
  Then 返回第2集并存在一个空 Script 和一个空 Storyboard

Scenario: US-002-S02 阻止删除有成片依赖的剧集
  Given 第2集关联一个 FinalVideo
  When 管理员执行删除预检
  Then allowed 为 false 且 blockers 包含可导航的 finalVideoId
```

## US-003 剧本文档管理

### 页面交互规格

- 路由：`/projects/{projectId}/scripts/{scriptId}`；左侧结构树、中间编辑器、右侧批注/版本面板。
- 进入编辑先申请 30 分钟租约；他人持锁时显示操作者和到期时间，只读打开。admin 强制释放必须填写原因。
- 自动保存草稿但发布必须显式确认；未保存离开保护。版本对比可选择任意两个快照，回退实际创建新草稿版本。
- 发布后当前快照只读；继续编辑通过“基于此版本新建”。

### API 契约

| 方法与路径 | 请求/响应 | 约束与错误 |
|---|---|---|
| `POST /api/v1/episodes/{episodeId}/scripts` | `{commandId,title,sourceVersionId?}`；201 Script | 幂等，单集允许的活动剧本规则由服务端校验 |
| `POST /api/v1/scripts/{id}/edit-lock` | `{commandId,leaseSeconds:1800}`；返回 lockToken/expiresAt | `script_locked` 返回持锁人脱敏信息 |
| `PUT /api/v1/scripts/{id}/draft` | `{commandId,lockToken,content,structure}`；返回 version | `If-Match`；`edit_lock_lost` |
| `POST /api/v1/scripts/{id}/publish` | `{commandId,lockToken}`；201 `{snapshotId,scriptVersion,eventId}` | 幂等；内容校验 |
| `GET /api/v1/scripts/{id}/versions/{a}/diff?to={b}` | 结构化行级差异 | 只读 |

### 数据模型

- `scripts(id,episode_id,title,status,current_draft_json,analysis_status,version,...)` 为聚合事实源。
- `script_documents(id,script_id,script_version,content_json,content_hash,previous_version_id,published_at,published_by)` 不可变，唯一 `(script_id,script_version)`。
- `script_edit_locks(script_id,holder_id,lock_token_hash,expires_at,heartbeat_at)`；过期可回收。批注引用稳定 blockId，不以内存行号作为事实。

### 可执行验收用例

```gherkin
@US-003 @e2e @p0
Scenario: US-003-S01 发布不可变剧本版本
  Given 编剧持有有效编辑锁并保存了合法草稿
  When 编剧发布剧本
  Then 产生不可变 ScriptDocument 且后续编辑不改变其 contentHash

Scenario: US-003-S02 编辑锁冲突安全降级为只读
  Given 用户甲持有未过期编辑锁
  When 用户乙打开同一剧本并尝试保存
  Then 页面为只读且保存 API 返回 409 script_locked
```

## US-004 AI 辅助剧本分析

### 页面交互规格

- 分析面板显示当前剧本版本、队列位置、阶段、耗时和成本预估；仅 draft/analyzed 可发起。
- 结果按角色、场景、道具和关系分组；每项可勾选后转为资产草稿，默认不自动发布。
- 原文变化使旧分析显示 stale 标记；用户可查看但不能无提示应用。失败展示可重试原因，最多 3 次并保留历史。

### API 契约

| 方法与路径 | 请求/响应 | 约束与错误 |
|---|---|---|
| `POST /api/v1/scripts/{id}/analysis-jobs` | `{commandId,scriptDocumentId,modelPolicyId?}`；202 `{jobId,status:"queued",eventId}` | 幂等；`script_version_not_published`、`budget_exceeded` |
| `GET /api/v1/scripts/{id}/analysis-jobs/{jobId}` | 状态、进度、attempt、结果摘要、成本 | 60s 单次超时；最多3次 |
| `POST /api/v1/scripts/{id}/analysis-jobs/{jobId}/apply` | `{commandId,itemIds[]}`；返回创建的资产草稿映射 | stale 时 `analysis_stale` |

### 数据模型

- `script_analyses(id,script_id,script_document_id,status,result_json,result_schema_version,input_hash,model_snapshot_json,cost_json,attempt,stale_at,version)`。
- 任务由 `ai_tasks` 承载并引用 target `{type:script,id,version}`；应用结果写资产草稿及来源引用，使用唯一 `(analysis_id,item_external_key)` 防重复。

### 可执行验收用例

```gherkin
@US-004 @integration @p1
Scenario: US-004-S01 分析并选择性创建资产草稿
  Given 已发布剧本版本包含角色阿青和场景码头
  When 分析完成并只应用角色项
  Then 仅创建阿青的 Character 草稿且保留 sourceAnalysisId

Scenario: US-004-S02 阻止应用过期分析
  Given 分析完成后剧本发布了新版本
  When 用户应用旧分析项
  Then API 返回 409 analysis_stale 且不创建资产
```

## US-005 创建与编排分镜

### 页面交互规格

- 路由：`/projects/{projectId}/storyboards/{storyboardId}` 分镜板及 `/shots/{shotId}` 导演台。
- 新建字段：描述、对白、景别、角度、运镜、时长；时长 1～300 秒。新 Shot 为 draft，创建后按 Storyboard 顺序编号。
- 卡片支持键盘/拖拽排序；批量调时长最多 100 项。角色/道具多选、场景单选，只可绑定已发布资产版本。
- approved Shot 删除入口不可用；返工后创建新版本。排序冲突时保留本地顺序草稿并提供加载最新/重新应用。

### API 契约

| 方法与路径 | 请求/响应 | 约束与错误 |
|---|---|---|
| `POST /api/v1/storyboards/{id}/shots` | `{commandId,description,dialogue,shotType,angle,cameraMove,durationSeconds,assetRefs[]}`；201 Shot | 同一 UoW 创建 Shot、追加 shotIds、Outbox |
| `PUT /api/v1/storyboards/{id}/shot-order` | `{commandId,shotIds[]}`；返回 storyboardVersion | `If-Match`；集合必须完整且无重复 |
| `PATCH /api/v1/shots/batch-duration` | `{commandId,items:[{shotId,expectedVersion,durationSeconds}]}`；逐项结果 | 最多100项，不静默部分失败 |
| `DELETE /api/v1/storyboards/{id}/shots/{shotId}` | 204 | approved 返回 `approved_shot_delete_forbidden` |

### 数据模型

- `storyboards(id,episode_id,shot_ids_json,version,...)`；顺序事实源唯一，或采用 rank 时仍由 Storyboard 维护成员集合版本。
- `shots(id,storyboard_id,shot_number,description,dialogue,shot_type,angle,camera_move,duration_ms,status,prompt_versions_json,version,...soft_delete)`。
- `shot_asset_bindings(shot_id,asset_type,asset_id,asset_version,role)`；唯一 `(shot_id,asset_type,asset_id,role)`。

### 可执行验收用例

```gherkin
@US-005 @e2e @p0
Scenario: US-005-S01 原子创建并排序 Shot
  Given 空 Storyboard 版本为1
  When 导演创建一个时长5秒的近景 Shot
  Then Shot 与 Storyboard 引用同时存在且编号为 SCENE-001

Scenario: US-005-S02 并发排序不覆盖
  Given 两个客户端都读取 Storyboard 版本7
  When 客户端甲排序成功后客户端乙提交不同顺序
  Then 客户端乙收到 409 version_conflict 且服务端保留甲的完整顺序
```

## US-006 AI 分镜建议

### 页面交互规格

- 入口位于分镜板“AI 拆镜”；必须选择有效剧本分析版本，显示模型、预算估算和覆盖范围。
- 建议进入独立待确认区，不直接改 Storyboard；支持逐条/批量采纳、忽略、合并和拆分，并显示来源对白。
- 120 秒后任务标为 timed_out；若存在部分结果仍可查看和选择，但必须明确“不完整”。采纳操作预览将新增/重排的 Shot。

### API 契约

| 方法与路径 | 请求/响应 | 约束与错误 |
|---|---|---|
| `POST /api/v1/storyboards/{id}/shot-suggestion-jobs` | `{commandId,scriptAnalysisId,range?,modelPolicyId?}`；202 job | `analysis_invalid`、`budget_exceeded` |
| `GET /api/v1/storyboards/{id}/shot-suggestion-jobs/{jobId}` | 状态、进度、suggestions、partial、成本 | 异步终态完整 |
| `POST /api/v1/storyboards/{id}/shot-suggestions/apply` | `{commandId,jobId,operations[],expectedStoryboardVersion}`；返回 shots/order/version | 整批事务；幂等 |

### 数据模型

- `shot_suggestion_jobs(id,storyboard_id,script_analysis_id,status,input_hash,model_snapshot_json,progress,partial,attempt,cost_json,...)`。
- `shot_suggestions(id,job_id,source_scene_id,dialogue_indexes_json,suggestion_json,content_hash,status)`；相同 job 内 content_hash 唯一。
- 应用时不修改建议内容，只追加 applied/ignored 决策和生成 Shot 映射。

### 可执行验收用例

```gherkin
@US-006 @e2e @p1
Scenario: US-006-S01 部分采纳建议且不覆盖已有 Shot
  Given Storyboard 已有2个 Shot 且任务返回3条建议
  When 用户采纳第1和第3条
  Then Storyboard 共有4个 Shot 且原有 Shot 内容未被修改

Scenario: US-006-S02 超时后保留部分结果
  Given Provider 在120秒内只返回2条建议
  When 任务达到截止时间
  Then 状态为 timed_out、partial 为 true 且页面允许查看但明确标记不完整
```

