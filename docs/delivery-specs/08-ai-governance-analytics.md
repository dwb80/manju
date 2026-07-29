# AI 治理与数据统计功能交付规格

> 共享规则见 [01-common-contract.md](01-common-contract.md)。本册覆盖 US-PM-001、US-DS-001；模型中心、流水线模板和数据集的详细领域能力由 AI 任务调度上下文维护，不把“有页面”误判为已实现。

## US-PM-001 Prompt 模板管理

### 页面交互规格

- 路由：`/prompt-templates` 与 `/prompt-templates/{id}`；列表支持用途、模型能力、状态、创建者、标签和项目/系统作用域筛选。
- 编辑器包含模板正文、变量 schema、默认值、示例输入、兼容模型、输出 schema、安全规则和变更说明；实时解析预览不得调用真实模型。
- 草稿可编辑；发布生成不可变版本，归档不影响历史任务。测试执行必须显示解析后的非敏感 Prompt、模型、预算预估和结果，私密变量始终掩码。
- 回退通过“基于旧版本创建新版本”，不修改旧版本；删除仅限从未发布且无引用的草稿。

### API 契约

| 方法与路径 | 请求/响应 | 约束与错误 |
|---|---|---|
| `POST /api/v1/prompt-templates` | `{commandId,name,scope,projectId?,purpose,body,variableSchema,outputSchema?,compatibleCapabilities[],tags[]}`；201 draft | 幂等；作用域内名称唯一 |
| `PUT /api/v1/prompt-templates/{id}/draft` | 完整草稿和 changeNote | `If-Match`；只允许 draft |
| `POST /api/v1/prompt-templates/{id}/validate` | `{variables,modelCapability?}`；返回 resolvedPreview/redactions/issues | 不持久化私密值 |
| `POST /api/v1/prompt-templates/{id}/publish` | `{commandId,changeNote}`；返回 templateVersion/contentHash | 阻断问题归零 |
| `POST /api/v1/prompt-templates/{id}/test-runs` | `{commandId,templateVersion,variables,modelPolicyId,maxCost}`；202 AITask | 预算、权限、幂等 |
| `POST /api/v1/prompt-templates/{id}/archive` | `{commandId,reason}` | 不影响版本引用 |

### 数据模型

- `prompt_templates(id,scope_type,scope_id,name,normalized_name,purpose,status,current_draft_json,current_published_version,version,...soft_delete)`。
- `prompt_template_versions(id,template_id,template_version,body,variable_schema_json,output_schema_json,compatible_capabilities_json,content_hash,change_note,published_by,published_at)` 不可变。
- 变量 schema 标记 `sensitive`；执行快照保存密文引用或摘要，不保存可恢复的私密输入。AITask 引用 templateId+version+resolvedPromptDigest。

### 可执行验收用例

```gherkin
@US-PM-001 @e2e @p1
Scenario: US-PM-001-S01 发布模板后历史任务可复现
  Given 模板草稿包含变量 characterName 且校验通过
  When 管理员发布版本3并用它创建任务
  Then 任务保存 templateVersion=3 和 resolvedPromptDigest 且后续草稿编辑不改变任务

Scenario: US-PM-001-S02 私密变量不出现在预览和审计
  Given apiHint 变量被标记 sensitive
  When 用户校验并执行模板
  Then 页面和 AuditRecord 只显示掩码且日志不包含原值
```

## US-DS-001 数据统计

### 页面交互规格

- 路由：`/dashboard` 与 `/data-center/metrics`；默认展示当前用户有权项目的生产进度、任务量、成功率、耗时、Token、成本、返工、审核和发布指标。
- 筛选项目、剧集、日期、模型、任务类型和平台，URL 可分享但服务端重新裁剪数据范围。每张卡显示口径说明、时区、更新时间和数据完整性状态。
- 支持从汇总下钻到任务/Review/PublishRecord；投影延迟显示 watermark。导出异步生成，沿用当前筛选且不包含无权数据。
- 成本必须区分预估/预占/已结算/调整；百分比在分母为0时显示“—”，不得显示虚假 0%。

### API 契约

| 方法与路径 | 请求/响应 | 约束与错误 |
|---|---|---|
| `GET /api/v1/metrics/project-overview` | projectIds/dateFrom/dateTo/timezone；返回 totals、series、watermark、definitionsVersion | 按项目授权裁剪 |
| `GET /api/v1/metrics/ai-cost` | project/model/taskType/date；返回 estimated/reserved/settled/adjusted | 金额单位明确 |
| `GET /api/v1/metrics/production-efficiency` | 项目/剧集/阶段；返回 cycleTime、throughput、reworkRate、sampleSize | 空分母为 null |
| `GET /api/v1/metrics/review-quality` | stage/result/reason/date；返回 SLA、通过率、问题密度 | reviewer 隐私策略 |
| `POST /api/v1/metric-exports` | `{commandId,dataset,filters,format}`；202 job | 绑定申请人；审计 |

### 数据模型

- 统计只读投影：`daily_ai_cost_metrics`、`daily_production_metrics`、`daily_review_metrics`、`publish_metric_snapshots`；事实源仍为 AITask/CostRecord/Review/Render/PublishRecord。
- 每行包含 `metric_date,timezone,dimensions...,value/sample_count,source_watermark,definitions_version,rebuilt_at`；维度组合唯一。
- 投影可从事件/事实表重建；人工调整成本以 `cost_adjustments` 追加记录，不直接修改历史汇总。

### 可执行验收用例

```gherkin
@US-DS-001 @e2e @p1
Scenario: US-DS-001-S01 项目权限限制统计和导出
  Given 用户只可访问项目A且请求项目A和B
  When 打开仪表盘并导出
  Then 响应和导出仅包含A且记录有效数据范围

Scenario: US-DS-001-S02 成本对账后指标可重建
  Given 某任务预占100、结算80并调整加5
  When 成本投影重建
  Then 指标显示 reserved=100、settled=80、adjusted=5、actual=85且 sampleCount=1
```
