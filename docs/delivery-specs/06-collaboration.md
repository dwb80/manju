# 项目协作功能交付规格

> 共享规则见 [01-common-contract.md](01-common-contract.md)。本册覆盖 US-018～US-020；任务、问题和里程碑统一建模为 WorkItem 的不同类型，但页面行为按类型区分。

## US-018 项目任务管理

### 页面交互规格

- 路由：`/work-items?type=task` 与项目工作台任务区；看板/列表共享 URL 筛选。支持负责人、状态、优先级、截止时间、标签和逾期筛选。
- 创建字段：标题、描述、负责人、协作者、优先级、截止时间、关联对象；状态 `open/in_progress/blocked/completed/closed`。
- 拖拽状态必须通过合法状态机；完成需填写结果摘要。指派、临期、逾期和阻塞触发 Notification，重复事件去重。

### API 契约

| 方法与路径 | 请求/响应 | 约束与错误 |
|---|---|---|
| `POST /api/v1/projects/{id}/work-items` | `{commandId,type:"task",title,description?,assigneeId?,collaboratorIds[],priority,dueAt?,targetRef?}` | 幂等；成员范围校验 |
| `GET /api/v1/projects/{id}/work-items` | type/status/assignee/priority/dueBefore/q | 稳定分页 |
| `POST /api/v1/work-items/{id}/transitions` | `{commandId,toStatus,resultSummary?}` | `If-Match`；状态机校验 |
| `PUT /api/v1/work-items/{id}` | 可编辑字段 | `If-Match` |

### 数据模型

- `work_items(id,project_id,type,title,description,status,priority,assignee_id,due_at,target_type,target_id,source_event_id,version,...soft_delete)`。
- `work_item_collaborators`、`work_item_labels`；自动任务按 `source_event_id+rule_id` 唯一，避免重复。

### 可执行验收用例

```gherkin
@US-018 @e2e @p0
Scenario: US-018-S01 指派任务并通知负责人
  Given 项目成员甲可管理任务且成员乙可被指派
  When 甲创建高优先级任务并指派乙
  Then WorkItem 为 open 且乙收到一条可跳转的去重通知

Scenario: US-018-S02 阻止指派项目外用户
  Given 用户丙不是项目成员
  When 创建任务并把 assigneeId 设置为丙
  Then API 返回 assignee_not_project_member 且不创建任务
```

## US-019 项目问题管理

### 页面交互规格

- 问题列表按 severity、来源、状态、负责人和目标对象筛选；问题详情显示复现步骤、证据、影响、关联 QC/Review 和解决记录。
- 状态 `open/triaged/in_progress/resolved/verified/closed`；报告人不能单独完成 verified（除非具有验证权限且非解决人）。
- 支持从 Review/QC 自动创建；相同 sourceEvent+issueKey 去重。关闭前必须有 resolution 和验证证据。

### API 契约

| 方法与路径 | 请求/响应 | 约束与错误 |
|---|---|---|
| `POST /api/v1/projects/{id}/work-items` | type=`issue`，含 severity/reproduction/evidence/targetRef | 幂等 |
| `POST /api/v1/work-items/{id}/transitions` | toStatus、resolution?、verificationEvidence? | 职责分离和状态校验 |
| `POST /api/v1/work-items/{id}/links` | 关联 Review/QC/Shot/任务 | 禁止跨项目引用 |

### 数据模型

- WorkItem type=issue 时 `issue_json` 包含 severity、reproduction、expected、actual、resolution、verifiedBy；结构由 schema 版本校验。
- `work_item_links(work_item_id,target_type,target_id,relation)`；服务端校验同项目，唯一组合防重复。

### 可执行验收用例

```gherkin
@US-019 @e2e @p1
Scenario: US-019-S01 从审核意见创建可追踪问题
  Given Review 有1.0至1.5秒的闪烁评论
  When reviewer 创建问题
  Then 问题包含 Review、Shot 和时间段链接且可从两端导航

Scenario: US-019-S02 解决人不能验证本人修复
  Given 用户甲把问题标记为 resolved
  When 甲尝试标记 verified
  Then API 返回 verification_separation_required
```

## US-020 项目里程碑管理

### 页面交互规格

- 项目工作台时间线显示名称、目标日期、负责人、状态、完成条件和关联任务；支持计划/进行中/达成/未达成/取消。
- 创建/修改日期时显示与前后里程碑的顺序冲突；是否允许重叠由项目策略决定。完成率来自关联任务读模型，不允许手工伪造。
- 达成需满足 mandatory 条件或由 owner 带原因强制确认并审计；临期/逾期通知按规则升级。

### API 契约

| 方法与路径 | 请求/响应 | 约束与错误 |
|---|---|---|
| `POST /api/v1/projects/{id}/work-items` | type=`milestone`，含 targetDate/ownerId/completionCriteria/linkedTaskIds | 幂等 |
| `GET /api/v1/projects/{id}/milestones` | 状态/日期范围；返回计算完成率 | 稳定排序 targetDate,id |
| `POST /api/v1/work-items/{id}/transitions` | 达成时 `{criteriaEvidence[],overrideReason?}` | override 仅 owner 且审计 |

### 数据模型

- WorkItem type=milestone 时 `milestone_json(target_date,completion_criteria_json,achieved_at,override_reason)`；任务关系在 `work_item_links`。
- `milestone_progress` 为 CQRS 投影，不可作为手工写事实；按 linked tasks 事件重建。

### 可执行验收用例

```gherkin
@US-020 @e2e @p1
Scenario: US-020-S01 任务完成驱动里程碑进度
  Given 里程碑关联4个任务且已有3个完成
  When 第4个任务完成
  Then 里程碑完成率最终一致为100%并允许负责人确认达成

Scenario: US-020-S02 普通成员不能强制达成未满足里程碑
  Given mandatory 条件仍有1项未满足
  When member 提交 achieved 和 overrideReason
  Then API 返回 permission_denied 且状态不变
```
