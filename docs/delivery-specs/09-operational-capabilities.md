# 运营与治理补充能力交付规格

> 首轮反向 Review 从页面/聚合发现以下能力缺少独立需求编号，现定义 CAP-001～CAP-008。共享规则见 [01-common-contract.md](01-common-contract.md)。

## CAP-001 项目成员与权限管理

### 页面交互规格

- 项目设置成员页支持添加组织成员、修改项目角色、设置 allow/deny 覆盖、移除和转移 owner；页面实时展示最终权限来源，deny 优先。
- 不能直接添加第二个 owner；转移所有权需要双方状态有效、重新认证和确认。移除前展示未完成任务/审核责任并要求转派或明确保留历史身份。

### API 契约

| 方法与路径 | 请求/响应 | 约束与错误 |
|---|---|---|
| `POST /api/v1/projects/{id}/members` | `{commandId,userId,role,overrides?}` | 组织成员、幂等 |
| `PUT /api/v1/projects/{id}/members/{userId}` | role/allow/deny | `If-Match`；`deny` 优先 |
| `DELETE /api/v1/projects/{id}/members/{userId}` | reason/reassignTo? | owner 不可删除 |
| `POST /api/v1/projects/{id}/ownership-transfers` | `{commandId,toUserId,reauthToken}` | 事务保持唯一 owner |

### 数据模型

- `project_members(project_id,user_id,role,allow_json,deny_json,version,joined_at,removed_at)`；活动成员唯一，Project 始终恰好一个 owner。
- 权限计算为 system guard + project role + allow - deny；高风险系统限制不能被 allow 提升。

### 可执行验收用例

```gherkin
@CAP-001 @security @p0
Scenario: CAP-001-S01 deny 覆盖角色默认权限
  Given producer 角色默认允许 publish.execute 但该成员 deny 包含此权限
  When 成员尝试执行发布
  Then API 返回 permission_denied 且权限解释显示 deny 来源

Scenario: CAP-001-S02 转移所有权保持唯一 owner
  Given 项目甲的 owner 为用户A且用户B为active成员
  When A把所有权转移给B
  Then 同一事务后B为owner、A降为admin且始终不存在两个owner
```

## CAP-002 模型配置与路由

### 页面交互规格

- 模型中心按 provider、能力、状态和项目可见性筛选；编辑名称、端点引用、模型标识、能力标签、限制、计价、优先级和默认场景。
- 密钥只通过凭据引用选择，不回显；激活前执行连接、能力和计价校验。同一场景只能有一个默认模型，切换需显示影响。

### API 契约

| 方法与路径 | 请求/响应 | 约束与错误 |
|---|---|---|
| `POST /api/v1/model-configs` | `{commandId,name,provider,modelId,credentialRef,capabilities,limits,pricing,priority}` | ai_admin |
| `PUT /api/v1/model-configs/{id}` | 完整配置 | `If-Match`，敏感值三态 |
| `POST /api/v1/model-configs/{id}/connection-tests` | 202 test job | 不持久化响应内容 |
| `POST /api/v1/model-configs/{id}/activate` | 场景默认映射? | 校验通过；审计 |

### 数据模型

- `model_configs(id,name,provider,model_id,credential_ref,status,capabilities_json,limits_json,pricing_json,priority,version)`；provider+规范化名称唯一。
- `model_route_defaults(scene_tag,model_config_id,version)` 唯一 scene_tag；执行任务保存完整 model snapshot。

### 可执行验收用例

```gherkin
@CAP-002 @integration @p0
Scenario: CAP-002-S01 激活模型并切换默认路由
  Given 模型通过连接和能力测试
  When ai_admin 把它设为 image.storyboard 默认
  Then 旧默认取消且新任务解析到新配置版本

Scenario: CAP-002-S02 凭据不经 API 回显
  Given 模型配置引用有效凭据
  When 管理员读取或导出配置
  Then 响应只含 credentialRef 和掩码且无密钥内容
```

## CAP-003 流水线模板管理

### 页面交互规格

- 模板中心提供节点画布、依赖边、条件、输入/输出 schema、超时、重试、人工门和预算策略；发布前进行环检测、可达性和契约兼容校验。
- 草稿可编辑，发布版本不可变；运行实例固定 templateVersion。停用只阻止新运行，不中断现有运行。

### API 契约

| 方法与路径 | 请求/响应 | 约束与错误 |
|---|---|---|
| `POST /api/v1/pipeline-templates` | `{commandId,name,purpose,nodes,edges,inputSchema,outputSchema}` | ai_admin |
| `PUT /api/v1/pipeline-templates/{id}/draft` | 完整图 | `If-Match` |
| `POST /api/v1/pipeline-templates/{id}/validate` | 返回图/schema/预算问题 | 只读 |
| `POST /api/v1/pipeline-templates/{id}/publish` | 返回 templateVersion/hash | 无 blocker |

### 数据模型

- `pipeline_templates(id,name,status,current_draft_json,current_published_version,version)`；`pipeline_template_versions` 保存不可变规范化图和 hash。
- 节点 ID 在版本内唯一，图必须无非法环且所有必需输出可达；PipelineRun 保存 template id+version。

### 可执行验收用例

```gherkin
@CAP-003 @integration @p1
Scenario: CAP-003-S01 发布后运行固定模板版本
  Given 模板版本2已发布
  When 创建运行后管理员发布版本3
  Then 既有运行仍执行版本2且新运行使用版本3

Scenario: CAP-003-S02 拒绝非法循环依赖
  Given 草稿节点A依赖B且B依赖A
  When 执行模板校验
  Then 返回 pipeline_cycle_detected 且禁止发布
```

## CAP-004 数据集管理

### 页面交互规格

- 数据中心数据集页支持创建、上传/引用、扫描、字段映射、版本、权限、导出和归档；显示来源、授权、样本数、大小和质量报告。
- 导入先进入 staging，不合格文件不进入可用集；版本发布不可变。归档不影响已执行任务的引用，敏感集禁止普通导出。

### API 契约

| 方法与路径 | 请求/响应 | 约束与错误 |
|---|---|---|
| `POST /api/v1/datasets` | `{commandId,name,purpose,scope,license,classification}` | 名称唯一 |
| `POST /api/v1/datasets/{id}/imports` | uploadId/mapping/schemaVersion | 202 扫描任务 |
| `POST /api/v1/datasets/{id}/versions/{v}/publish` | 质量 digest | 权限/授权校验 |
| `POST /api/v1/dataset-exports` | dataset/version/format | 敏感级别策略 |

### 数据模型

- `datasets(id,name,purpose,scope,classification,status,current_version,version)`；`dataset_versions(id,dataset_id,dataset_version,manifest_json,manifest_hash,sample_count,size_bytes,quality_report_id,license_json)` 不可变。
- `dataset_items` 引用媒体/结构化内容哈希；导入映射和失败项保留报告，不污染发布版本。

### 可执行验收用例

```gherkin
@CAP-004 @integration @p1
Scenario: CAP-004-S01 导入通过扫描后发布版本
  Given staging 文件授权完整且质量检查通过
  When 管理员确认导入并发布
  Then 产生不可变 DatasetVersion 且 manifestHash 可核对

Scenario: CAP-004-S02 阻止导出受限数据集
  Given Dataset classification=restricted 且用户无 export_sensitive 权限
  When 请求导出
  Then API 返回 permission_denied 且不创建文件
```

## CAP-005 AI 对话与创意工作室

### 页面交互规格

- `/chat` 管理项目会话和消息；`/studio` 以会话承载问答、图片/视频生成和收藏，但生成仍创建 AITask，不把消息当生成事实源。
- SSE 显示流式内容、停止和重新生成；刷新后从服务器恢复消息。失败消息保留输入和 traceId；重新生成创建 sibling，不覆盖原回复。
- 会话必须绑定允许的项目范围；附件扫描后才可引用，删除会话不删除已正式采用的资产。

### API 契约

| 方法与路径 | 请求/响应 | 约束与错误 |
|---|---|---|
| `POST /api/v1/conversations` | `{commandId,projectId?,title}` | 幂等 |
| `GET /api/v1/conversations/{id}/messages` | cursor | 会话成员范围 |
| `POST /api/v1/conversations/{id}/messages` | `{commandId,content,attachmentRefs[],mode}`；SSE | 内容/附件校验 |
| `POST /api/v1/messages/{id}/stop` | 停止流 | owner only |
| `POST /api/v1/messages/{id}/regenerations` | 新 sibling response | 保留原消息 |

### 数据模型

- `conversations(id,project_id,owner_id,title,status,version,...soft_delete)`；`messages(id,conversation_id,parent_id,role,content_json,status,model_snapshot_json,usage_json,created_at)` 追加写。
- Studio 生成消息保存 taskId 引用；收藏保存目标类型/id/version，不复制媒体事实。

### 可执行验收用例

```gherkin
@CAP-005 @e2e @p1
Scenario: CAP-005-S01 停止流式回答并刷新恢复
  Given 助手正在流式生成回复
  When 用户停止并刷新页面
  Then 消息状态为 stopped 且已接收内容完整恢复

Scenario: CAP-005-S02 重新生成不覆盖原回复
  Given 一条 completed 助手回复
  When 用户点击重新生成
  Then 创建 sibling 回复且原回复内容和模型快照不变
```

## CAP-006 AI 任务队列运维

### 页面交互规格

- `/ai-tasks` 按项目、类型、Provider、状态、优先级、耗时和错误筛选；显示队列时间、attempt、预算、目标和执行快照摘要。
- 取消仅对 queued/running，重试仅对 retryable 终态；批量操作逐项返回。管理员可人工接管 stuck/unknown_result，但必须填写原因。

### API 契约

| 方法与路径 | 请求/响应 | 约束与错误 |
|---|---|---|
| `GET /api/v1/ai-tasks` | cursor/project/type/provider/status/duration/errorCode | 数据范围 |
| `POST /api/v1/ai-tasks/{id}/cancel` | `{commandId,reason}` | 幂等状态机 |
| `POST /api/v1/ai-tasks/{id}/retry` | `{commandId,fromNode?}` | 新 attempt，输入快照不变 |
| `POST /api/v1/ai-tasks/{id}/manual-resolutions` | `{commandId,resolution,evidence,reason}` | ai_admin；审计 |

### 数据模型

- 复用 `ai_tasks/ai_task_attempts`；attempt 追加写并保存 providerRequestId、deadline、heartbeat、errorClass、cost。
- 当前任务状态由 attempt 收敛，手工解决保存独立 resolution record，不修改历史 attempt。

### 可执行验收用例

```gherkin
@CAP-006 @e2e @p0
Scenario: CAP-006-S01 仅重试可重试失败
  Given 任务因临时限流失败且 retryable=true
  When 操作员重试
  Then 新建 attempt=2、输入哈希不变且不重复创建业务目标

Scenario: CAP-006-S02 不重试永久安全失败
  Given 任务因内容安全拒绝且 retryable=false
  When 调用重试 API
  Then 返回 task_not_retryable 且 attempt 数不变
```

## CAP-007 项目预算治理

### 页面交互规格

- 项目设置预算页供 owner/admin/producer 查看，只有有权限者修改币种、周期、软阈值、硬上限和分类限额；展示预估、预占、已结算、释放和调整。
- 修改前预览对 queued/running 任务影响；硬上限阻断新任务但不伪造取消已运行任务。对账异常显示责任人和处理入口。

### API 契约

| 方法与路径 | 请求/响应 | 约束与错误 |
|---|---|---|
| `GET /api/v1/projects/{id}/budget` | policy、usage、reservations、version | 成本脱敏权限 |
| `PUT /api/v1/projects/{id}/budget` | `{commandId,currency,period,softThreshold,hardCap,categoryCaps}` | `If-Match`；金额非负 |
| `GET /api/v1/projects/{id}/budget/reconciliation` | 差异和 watermark | admin/producer |
| `POST /api/v1/projects/{id}/budget/reconciliation-runs` | 202 | 幂等 |

### 数据模型

- `project_budgets(project_id,currency,period,soft_threshold,hard_cap,category_caps_json,version)`；`budget_reservations` 状态 reserved/settled/released/expired。
- `cost_records` 与 `cost_adjustments` 追加写；余额计算不得只依赖可修改汇总。

### 可执行验收用例

```gherkin
@CAP-007 @integration @p0
Scenario: CAP-007-S01 并发任务通过预占防止超额
  Given 剩余额度100且两个任务各需80
  When 两个任务并发预占
  Then 仅一个成功且另一个返回 budget_exceeded

Scenario: CAP-007-S02 失败任务释放预占
  Given 任务已预占80后在Provider调用前失败
  When 失败处理完成
  Then reservation 为 released 且可用余额恢复
```

## CAP-008 质量规则配置

### 页面交互规格

- 质检中心规则页支持按目标类型维护规则草稿、严重度、参数、阻断性和适用范围；发布前用样本运行并展示命中差异。
- 发布版本不可变；项目可选择已发布规则集版本，送检后固定。停用不改变历史 QCReport，豁免权限独立控制。

### API 契约

| 方法与路径 | 请求/响应 | 约束与错误 |
|---|---|---|
| `POST /api/v1/quality-rule-sets` | `{commandId,name,targetTypes,rules[]}` | quality_admin |
| `PUT /api/v1/quality-rule-sets/{id}/draft` | 完整规则草稿 | `If-Match` |
| `POST /api/v1/quality-rule-sets/{id}/sample-runs` | sampleRefs；202 QC job | 不发布 |
| `POST /api/v1/quality-rule-sets/{id}/publish` | changeNote；返回 version/hash | schema/样本校验 |
| `PUT /api/v1/projects/{id}/quality-policy` | ruleSetId/version/overrides | 项目 admin，必需规则不可关闭 |

### 数据模型

- `quality_rule_sets(id,name,status,current_draft_json,current_published_version,version)`；`quality_rule_set_versions` 不可变且保存规则 schema/hash。
- `project_quality_policies(project_id,rule_set_id,rule_set_version,overrides_json,version)`；QCReport 固定精确版本。

### 可执行验收用例

```gherkin
@CAP-008 @integration @p0
Scenario: CAP-008-S01 QC 固定规则版本
  Given 项目规则集版本4且 QC 开始运行
  When 管理员发布版本5
  Then 既有报告仍使用版本4且新报告使用版本5

Scenario: CAP-008-S02 项目不能关闭系统必需规则
  Given 字体授权检查被标记 mandatory
  When 项目管理员在覆盖中禁用它
  Then API 返回 mandatory_quality_rule 且策略不变
```

## CAP-009 生产依赖影响与修复计划

### 页面交互规格

- 项目工作台和所有版本化写入口显示 `current / stale / blocked / unknown`，并可展开直接及递归下游、审核失效范围、预计任务数、成本和不可自动项。
- 保存前先请求影响预评估；用户确认后才创建版本和修复计划。页面不得直接编辑 DEP 新鲜度，也不得用“全部清除”隐藏无关告警。
- 受影响对象支持按 Episode、类型、严重度和责任人筛选；每项可打开确切来源版本、目标版本和证据边。

### API 契约

| 方法与路径 | 请求/响应 | 约束与错误 |
|---|---|---|
| `GET /api/v1/projects/{id}/dependency-impacts` | 返回 projectionWatermark、items、counts | 支持 freshness/type/episode/cursor 筛选；只读 |
| `POST /api/v1/projects/{id}/dependency-impact-assessments` | `{commandId,sourceType,sourceId,sourceVersion,proposedChange}`；返回 blockers、warnings、affectedRefs、estimatedTasks、estimatedCost | 只读计划；结果带 TTL 和 inputHash |
| `POST /api/v1/projects/{id}/dependency-repair-plans` | `{commandId,assessmentId,inputHash,selectedActions}`；202 返回 planId 和逐项状态 | 权限/预算/审核/权利逐项校验；幂等 |

### 数据模型

- `production_dependency_projections(project_id,source_ref,target_ref,dependency_type,freshness,evidence_hash,watermark)` 为事件投影，不接受页面直接写入。
- `dependency_impact_assessments(id,project_id,input_hash,expires_at,result_json,created_by,created_at)`；`dependency_repair_plans` 与 item 结果追加写。

### 可执行验收用例

```gherkin
@CAP-009 @integration @p0
Scenario: CAP-009-S01 上游版本变化显示递归影响
  Given 角色版本3被12个Shot和2个已审核快照引用
  When 用户预评估发布角色版本4
  Then 页面显示直接和递归下游、审核失效范围、预计任务与成本且尚未修改事实

Scenario: CAP-009-S02 只沿已修复依赖链恢复新鲜度
  Given 同一项目存在两条无关 stale 链
  When 第一条链重生成、重审并完成修复计划
  Then 仅第一条链恢复 current 且第二条链保持 stale

Scenario: CAP-009-S03 投影落后不显示虚假当前状态
  Given DEP 投影水位落后于最新领域事件
  When 用户打开项目影响面板
  Then 页面显示 unknown 和水位说明而不是显示 current
```

## CAP-010 编辑租约、在线协作与冲突解决

### 页面交互规格

- Script、Shot、资产和 EditProject 详情显示查看者、编辑租约持有人、租约到期和最后心跳；在线状态不作为权限或审计依据。
- 写操作同时校验命令权限、有效租约和 `expectedVersion`。冲突页面保留本地草稿并展示基础版、服务端版和本地版差异。
- owner/admin 强制接管必须展示未保存风险、填写原因、通知原持有人并生成 AuditRecord；代理到期或角色变化立即重算动作权限。

### API 契约

| 方法与路径 | 请求/响应 | 约束与错误 |
|---|---|---|
| `GET /api/v1/collaboration-states` | 返回 target、viewers、lease、effectivePermissions、version | targetType/targetId 必填；个人信息脱敏 |
| `POST /api/v1/edit-leases` | `{commandId,targetType,targetId,leaseSeconds}`；201 lease | 权限、幂等；已占用返回 `edit_lease_held` |
| `POST /api/v1/edit-leases/{id}/heartbeats` | `{commandId,leaseToken,expectedVersion}`；返回新 expiresAt | token 仅回显一次且不得写日志 |
| `DELETE /api/v1/edit-leases/{id}` | `{commandId,leaseToken,reason}`；204 | 持有人或授权接管者 |
| `POST /api/v1/edit-leases/{id}/takeovers` | `{commandId,reason,expectedVersion}`；返回新 lease | owner/admin；通知和审计 |
| `POST /api/v1/conflict-resolutions` | `{commandId,targetType,targetId,baseVersion,serverVersion,resolution,localPatch}`；返回新版本或需人工字段 | 禁止自动合并顺序/时间线/删除冲突 |

### 数据模型

- `edit_leases(id,target_type,target_id,holder_id,token_hash,status,expires_at,last_heartbeat_at,version)`；同一 target 仅一个 active lease。
- `presence_projections` 为短期读模型；`conflict_resolutions` 保存版本、选择、差异摘要和操作者，不保存未脱敏秘密。

### 可执行验收用例

```gherkin
@CAP-010 @e2e @p0
Scenario: CAP-010-S01 编辑租约阻止并发覆盖
  Given 用户甲持有Shot租约且用户乙只有查看权限
  When 乙尝试保存同一Shot
  Then 页面显示持有人和到期时间、API返回edit_lease_held且甲的数据不变

Scenario: CAP-010-S02 版本冲突保留本地草稿
  Given 两名剪辑师从EditProject版本8开始编辑
  When 甲保存版本9后乙提交本地修改
  Then 乙看到三方差异并可另存修订，服务端不执行最后写入者覆盖

Scenario: CAP-010-S03 强制接管完整留痕
  Given 原持有人离线但租约仍有效
  When owner填写原因并强制接管
  Then 原持有人收到通知、产生AuditRecord且新租约只有owner持有
```
