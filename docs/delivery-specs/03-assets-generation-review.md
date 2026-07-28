# 资产、AI 生成与审核功能交付规格

> 共享规则见 [00-common-contract.md](00-common-contract.md)。本册覆盖 US-007～US-012。

## US-007 角色资产管理

### 页面交互规格

- 路由：`/projects/{projectId}/characters` 与 `/characters/{id}`；列表支持状态、标签、来源和名称筛选。
- 编辑字段：名称、别名、性别、年龄段、身份、外观、服装、性格、声音标签、Prompt、负向 Prompt；名称 1～100 字符。
- 多视图按景别/角度/表情/服装组织，可选主图；发布前必须有主图、核心描述和来源/授权信息。发布版本不可原地覆盖。
- 删除前展示 Shot/快照引用；已被快照引用的版本只可归档。

### API 契约

| 方法与路径 | 请求/响应 | 约束与错误 |
|---|---|---|
| `POST /api/v1/projects/{projectId}/characters` | `{commandId,name,profile,prompts,sourceRef?}`；201 Character | 幂等；项目内规范化名称唯一 |
| `PUT /api/v1/characters/{id}` | 完整草稿字段；返回 version | `If-Match` |
| `POST /api/v1/characters/{id}/images` | 媒体引用、viewType/shotType/angle/expression | 文件必须已完成安全扫描 |
| `POST /api/v1/characters/{id}/publish` | `{commandId}`；返回 publishedVersion | `asset_incomplete` |
| `POST /api/v1/characters/{id}/archive` | 原因 | 已发布版本保留引用 |

### 数据模型

- `characters(id,project_id,name,normalized_name,status,current_draft_json,current_published_version,version,...soft_delete)`。
- `character_versions(id,character_id,asset_version,snapshot_json,content_hash,published_at,published_by)` 不可变。
- `character_images(id,character_id,draft_version,media_id,view_type,shot_type,angle,expression,is_primary,source_json)`；每个发布版本只允许一张主图。

### 可执行验收用例

```gherkin
@US-007 @e2e @p0
Scenario: US-007-S01 发布角色版本并保持 Shot 引用稳定
  Given 角色阿青具有主图和完整描述
  When 美术发布版本2并随后编辑草稿
  Then 已绑定版本2的 Shot 仍引用相同 contentHash

Scenario: US-007-S02 阻止发布缺少主图的角色
  Given 角色草稿没有主图
  When 用户点击发布
  Then API 返回 409 asset_incomplete 且页面导航到图片区
```

## US-008 场景与道具资产管理

### 页面交互规格

- 路由：`/projects/{projectId}/scenes|props` 及详情；共享资产编辑模式，但字段 schema 分离。
- Scene 字段含地点、时段、天气、氛围、光照和区域；Prop 含类别、材质、尺寸、状态和持有人。均支持多视图、主图、Prompt、来源与授权。
- 发布前校验必填字段和主图；归档前显示在 Shot、连续性规则和快照中的引用。批量标签/归档返回逐项结果。

### API 契约

| 方法与路径 | 请求/响应 | 约束与错误 |
|---|---|---|
| `POST /api/v1/projects/{projectId}/scenes` | `{commandId,name,location,timeOfDay,weather,atmosphere,lighting,prompt}` | 幂等 |
| `POST /api/v1/projects/{projectId}/props` | `{commandId,name,category,material,size,state,prompt}` | 幂等 |
| `PUT /api/v1/scenes/{id}`、`PUT /api/v1/props/{id}` | 完整草稿 | `If-Match` |
| `POST /api/v1/{scenes|props}/{id}/publish` | 发布当前草稿 | `asset_incomplete` |
| `POST /api/v1/assets/batch` | 最多100项标签/归档命令 | 逐项结果，不跨项回滚 |

### 数据模型

- `scenes`/`scene_versions` 与 `props`/`prop_versions` 采用与 Character 相同版本模式，各自 JSON schema 独立。
- 多视图使用 `scene_images`、`prop_images` 并引用统一 `media_objects`；禁止把角色字段塞入共享无类型 `assets` JSON。
- 同项目规范化名称按资产类型唯一；已发布版本不可更新。

### 可执行验收用例

```gherkin
@US-008 @e2e @p0
Scenario: US-008-S01 创建并发布夜景码头
  Given 美术具有 asset.scene.write 权限
  When 填写地点、夜晚、雨天、光照并设置主图后发布
  Then Scene 产生不可变版本1且可被 Shot 选择

Scenario: US-008-S02 批量归档保留失败明细
  Given 3个道具中1个被活动生成任务锁定
  When 批量归档这3个道具
  Then 2项成功、1项返回 asset_in_use 且页面保留逐项结果
```

## US-009 AI 图片生成

### 页面交互规格

- 入口位于 Shot、资产详情和创意工作室；表单显示目标对象/版本、Prompt 解析预览、负向 Prompt、模型策略、尺寸、数量、种子和成本上限。
- 提交前进行预算与输入预检；任务进入统一队列，可查看 queued/running/completed/failed/cancelled/timed_out。结果默认是候选，不自动替换主资产或 Shot。
- 支持选择结果、放大查看元数据、标记采用/拒绝和基于结果再生成；失败只允许在输入快照未过期时重试。

### API 契约

| 方法与路径 | 请求/响应 | 约束与错误 |
|---|---|---|
| `POST /api/v1/image-generation-jobs` | `{commandId,target,targetVersion,promptTemplateRef?,promptVariables?,resolvedPromptDigest,negativePrompt,modelPolicyId,width,height,count,seed?,maxCost}`；202 AITask | 幂等；`budget_exceeded`、`target_version_stale` |
| `GET /api/v1/ai-tasks/{id}` | 状态、进度、结果媒体、成本和 executionSnapshot | 仅项目成员 |
| `POST /api/v1/ai-tasks/{id}/cancel` | `{commandId}` | running/queued；Provider 不支持时标记 cancel_requested |
| `POST /api/v1/generated-images/{id}/adopt` | `{commandId,target,targetVersion,usage}` | 绑定而非覆盖事实源 |

### 数据模型

- `ai_tasks` 保存 type=image、target、input_hash、execution_snapshot、budget_reservation_id、状态、deadline、attempt、cost。
- `generated_images(id,task_id,media_id,seed,provider_metadata_json,safety_json,status)`；采用关系独立记录 `generated_asset_adoptions`。
- Prompt 私密变量不进入通知/审计，执行快照保存允许审计的规范化摘要和加密引用。

### 可执行验收用例

```gherkin
@US-009 @e2e @p0
Scenario: US-009-S01 生成候选图片并人工采用
  Given Shot 版本5通过预算预检
  When 用户生成2张图片并采用第2张
  Then 任务完成、成本结算且 Shot 只绑定第2张媒体版本

Scenario: US-009-S02 重复提交不重复扣费
  Given 客户端因超时重放相同 Idempotency-Key
  When 服务端接收第二次生成请求
  Then 返回原 taskId 且只有一个 BudgetReservation
```

## US-010 图片审核

### 页面交互规格

- 审核中心默认显示分配给本人且最早到期项；支持项目、目标类型、状态、严重度筛选。
- 详情显示图片、目标快照、生成参数摘要、QC 问题和历史意见；操作为通过、要求修改，必须选择/填写结构化原因。
- 审核自己的提交时决策按钮禁用并解释职责分离；提交后不可编辑，纠正通过追加决定。

### API 契约

| 方法与路径 | 请求/响应 | 约束与错误 |
|---|---|---|
| `POST /api/v1/reviews` | `{commandId,targetType:"image",targetId,targetVersion,targetSnapshotHash,assigneeId?}`；201 Review | 幂等；目标不可变 |
| `GET /api/v1/reviews` | cursor/assignee/project/status/targetType/dueBefore | 稳定分页 |
| `POST /api/v1/reviews/{id}/decisions` | `{commandId,decision:"approve"|"request_changes",reasonCode,comment?}`；201 decision | `If-Match`；`self_review_forbidden` |

### 数据模型

- `reviews(id,project_id,target_type,target_id,target_version,target_snapshot_hash,stage,status,submitter_id,assignee_id,due_at,version)`。
- `review_decisions(id,review_id,decision,reason_code,comment,actor_id,created_at)` 追加写；Review 状态由决定推进。
- 相同 target/version/stage 只允许一个活动 Review。

### 可执行验收用例

```gherkin
@US-010 @e2e @p0
Scenario: US-010-S01 审核通过冻结图片版本
  Given reviewer 被分配一个非本人提交的图片 Review
  When 选择通过并提交
  Then Review 为 approved、产生 ReviewApproved 且决定记录不可编辑

Scenario: US-010-S02 阻止自审
  Given 图片提交人也是当前 reviewer
  When 尝试调用决策 API
  Then 返回 403 self_review_forbidden 且无 decision 记录
```

## US-011 AI 视频生成

### 页面交互规格

- 视频生产线按 PipelineRun 展示 Shot、输入 PresentationSnapshot、模型、时长、分辨率、帧率、音频驱动和预算。
- 只能从通过所需图片审核和表现预检的快照发起；提交后显示节点级进度和 Provider requestId。结果未知时显示“对账中”，不能直接重复生成。
- 失败可查看分类、重试范围和成本处理；输入变化后旧任务标记 stale，结果仍可追溯但不能自动采用。

### API 契约

| 方法与路径 | 请求/响应 | 约束与错误 |
|---|---|---|
| `POST /api/v1/video-generation-jobs` | `{commandId,presentationSnapshotId,imageVersionIds[],audioVersionId?,modelPolicyId,durationMs,resolution,fps,maxCost}`；202 `{taskId,pipelineRunId}` | 幂等输入哈希；`review_required` |
| `GET /api/v1/pipeline-runs/{id}` | 节点、状态、进度、deadline、成本 | 项目范围 |
| `POST /api/v1/ai-tasks/{id}/retry` | `{commandId,retryFromNode?}` | 只允许 retryable 失败；保留前次 attempt |
| `POST /api/v1/generated-videos/{id}/adopt` | 绑定目标 Shot 和快照 | `target_snapshot_mismatch` |

### 数据模型

- `pipeline_runs(id,project_id,template_id,template_version,input_snapshot_hash,status,current_node_id,budget_reservation_id,version)`。
- `ai_tasks` type=video；`generated_videos(id,task_id,media_id,duration_ms,width,height,fps,provider_request_id,input_snapshot_hash,safety_json)`。
- Provider callback 唯一 `(provider,provider_request_id)`，回调携带 input hash，不匹配进入隔离而非更新新版本。

### 可执行验收用例

```gherkin
@US-011 @integration @p0
Scenario: US-011-S01 从冻结快照生成并绑定视频
  Given PresentationSnapshot 已通过图片审核和预算预检
  When 视频任务成功回调且 inputHash 匹配
  Then 视频绑定该 snapshotHash、预算结算且 Pipeline 节点完成

Scenario: US-011-S02 隔离迟到的旧版本回调
  Given Shot 已从快照A返工为快照B
  When 快照A任务的回调迟到
  Then 结果归档到A且不得更新B的当前视频
```

## US-012 视频审核

### 页面交互规格

- 审核详情提供逐帧/倍速播放、时间码评论、输入快照、QC、音画同步和安全区叠加。
- 单 Shot 视频采用单级审核；通过或要求修改均需结构化原因，要求修改可创建返工 WorkItem 并定位时间段。
- 播放失败时不允许盲审，显示媒体诊断与重试；审核决定绑定精确视频版本。

### API 契约

| 方法与路径 | 请求/响应 | 约束与错误 |
|---|---|---|
| `POST /api/v1/reviews` | targetType=`video`、videoVersion、snapshotHash | 目标媒体可读且校验完成 |
| `POST /api/v1/reviews/{id}/comments` | `{commandId,startMs,endMs?,body,severity}` | 时间在媒体范围内 |
| `POST /api/v1/reviews/{id}/decisions` | approve/request_changes + reason | 自审禁止、`If-Match` |

### 数据模型

- 复用 `reviews/review_decisions`；`review_comments(id,review_id,start_ms,end_ms,body,severity,actor_id,created_at,resolved_at)`。
- Review 保存 media digest 与 PresentationSnapshot hash；媒体文件变化必须创建新版本和新 Review。

### 可执行验收用例

```gherkin
@US-012 @e2e @p0
Scenario: US-012-S01 带时间码要求修改并创建返工项
  Given reviewer 在视频1.2秒发现角色闪烁
  When 添加1.0至1.5秒评论并选择要求修改
  Then Review 为 changes_requested 且 WorkItem 链接到该评论和 Shot

Scenario: US-012-S02 媒体不可播放时禁止决策
  Given 视频完整性校验失败
  When reviewer 打开审核详情
  Then 页面显示媒体错误且决策 API 返回 media_not_reviewable
```

