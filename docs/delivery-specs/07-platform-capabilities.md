# 平台基础能力交付规格

> 共享规则见 [01-common-contract.md](01-common-contract.md)。本册覆盖 US-022～US-029；部署基线为单组织，不引入未决的多租户计费语义。

## US-022 用户与成员管理

### 页面交互规格

- 路由：`/admin/users`；platform_admin 可创建、邀请、启停、改系统角色、重置密码和撤销会话。列表支持状态、来源、系统角色和项目关系筛选。
- 邀请仅展示一次性状态，不展示明文临时密码；停用前显示当前会话、项目职责和是否最后一名管理员。
- 用户详情保留历史作品/审核署名；敏感邮箱和安全信息按权限脱敏。高风险操作要求重新认证和原因。

### API 契约

| 方法与路径 | 请求/响应 | 约束与错误 |
|---|---|---|
| `POST /api/v1/admin/users` | `{commandId,username,email,systemRoles[],activationMode}`；201 user | 幂等；规范化用户名/邮箱唯一 |
| `POST /api/v1/admin/invitations` | `{commandId,email,systemRoles[],expiresInHours}` | 不返回密钥，只返回 invitationId/status |
| `PATCH /api/v1/admin/users/{id}/status` | `{commandId,status,reason}` | `If-Match`；`last_platform_admin` |
| `PUT /api/v1/admin/users/{id}/roles` | `{commandId,systemRoles[]}` | 重新认证、审计 |
| `POST /api/v1/admin/users/{id}/revoke-sessions` | `{commandId,reason}` | 幂等 |

### 数据模型

- `users(id,username,normalized_username,email,normalized_email,status,source,version,...)`；邮箱/用户名唯一。
- `user_system_roles(user_id,role,granted_by,granted_at)`；`invitations(id,email_hash,status,token_hash,expires_at,accepted_at)`；Token 只存哈希。
- disabled/locked 状态变更同事务写 session revocation marker 和 Outbox；历史 actor 引用不级联删除。

### 可执行验收用例

```gherkin
@US-022 @e2e @p0
Scenario: US-022-S01 停用用户立即撤销会话
  Given 活跃用户拥有两个会话且不是最后一名管理员
  When platform_admin 停用该用户
  Then 两个会话均不可继续访问且历史审核署名仍显示

Scenario: US-022-S02 阻止停用最后一名平台管理员
  Given 组织只有一名 active platform_admin
  When 尝试停用该用户
  Then API 返回 409 last_platform_admin 且用户状态不变
```

## US-023 认证与会话安全

### 页面交互规格

- 路由：`/login`、`/account/security`；登录页只显示启用的密码/SSO 方式，不泄露账号是否存在。
- 安全页显示当前及其他会话的设备摘要、IP 粗粒度、创建和最后活动时间；可撤销其他会话。改密后按策略撤销其他会话。
- 连续失败显示通用错误和下一次可尝试时间；SSO 回跳仅允许预登记目标，异常登录触发不可关闭的安全通知。

### API 契约

| 方法与路径 | 请求/响应 | 约束与错误 |
|---|---|---|
| `POST /api/v1/auth/login` | `{usernameOrEmail,password,csrfContext}`；200 设置安全 Cookie | `invalid_credentials` 使用统一消息；限流 |
| `POST /api/v1/auth/sso/{provider}/start` | `{returnTo}`；返回一次性授权 URL | returnTo allowlist |
| `GET /api/v1/auth/sso/{provider}/callback` | code/state；建立会话后安全跳转 | state/code 一次性、短 TTL |
| `GET /api/v1/auth/sessions` | 当前用户会话摘要 | 不返回 Token |
| `DELETE /api/v1/auth/sessions/{id}` | 204 | 只能本人或管理员 |
| `POST /api/v1/auth/change-password` | `{commandId,currentPassword,newPassword,revokeOthers:true}` | 密码策略/历史复用 |

### 数据模型

- `sessions(id,user_id,token_hash,csrf_secret_hash,created_at,last_seen_at,expires_at,revoked_at,device_digest,ip_prefix)`。
- `auth_attempts(id,principal_hash,result,reason,ip_prefix,occurred_at)`；`sso_states(id,state_hash,provider,return_to,expires_at,consumed_at)`。
- 密码使用当前安全 KDF 与参数版本；不得存可逆密码或把 Token 写日志。

### 可执行验收用例

```gherkin
@US-023 @security @p0
Scenario: US-023-S01 改密撤销其他会话
  Given 用户在浏览器A和B登录
  When 用户在A改密并选择撤销其他会话
  Then A保持有效、B下次请求返回401且产生审计记录

Scenario: US-023-S02 SSO state 不可重放
  Given 一个 SSO state 已成功消费
  When 攻击者再次使用相同 state 回调
  Then API 拒绝且不创建新会话并生成安全审计
```

## US-024 通知中心

### 页面交互规格

- 路由：`/notifications` 与 `/account/notification-preferences`；顶部栏显示未读数，SSE 断线后以 cursor 补拉。
- 支持类别、项目、优先级、未读筛选，单条/批量已读、归档和安全跳转；无权访问目标时仍可读通知摘要但不泄露目标内容。
- 偏好按类别配置站内/邮件和免打扰；P0 安全/数据事故渠道不可全部关闭。邮件失败不把站内通知显示为失败。

### API 契约

| 方法与路径 | 请求/响应 | 约束与错误 |
|---|---|---|
| `GET /api/v1/notifications` | cursor/category/project/priority/read/archived | 按 recipient 隔离 |
| `GET /api/v1/notifications/stream` | SSE：notification/unread_count/heartbeat，支持 Last-Event-ID | 断线补拉 |
| `POST /api/v1/notifications/read-batch` | `{commandId,notificationIds[]}` | 最多100，幂等 |
| `POST /api/v1/notifications/{id}/archive` | 204 | recipient only |
| `GET/PUT /api/v1/notification-preferences` | 类别渠道、quietHours、version | `If-Match`；强制渠道校验 |

### 数据模型

- `notifications(id,event_id,event_type,template_id,template_version,recipient_id,project_id,target_json,priority,dedupe_key,payload_json,status,read_at,archived_at,created_at)`；唯一 `(recipient_id,dedupe_key)`。
- `notification_preferences(user_id,category,in_app,email,quiet_hours_json,version)`；`notification_delivery_attempts` 追加写；模板版本不可变。

### 可执行验收用例

```gherkin
@US-024 @e2e @p0
Scenario: US-024-S01 SSE 断线后无丢失且无重复
  Given 用户已收到游标100并断线
  When 游标101和102产生后用户重连
  Then 页面补拉两条且 dedupeKey 不产生重复通知

Scenario: US-024-S02 禁止关闭全部安全通知渠道
  Given security 类别要求站内必开
  When 用户关闭站内和邮件
  Then API 返回 mandatory_notification_channel 且偏好不变
```

## US-025 统一回收站与数据恢复

### 页面交互规格

- 路由：`/projects/{projectId}/recycle-bin` 和管理员全局视图；显示类型、名称、删除人、时间、到期、父对象、依赖和法务冻结。
- 恢复必须先生成 RestorePlan，逐项展示名称冲突、父对象缺失和引用影响；批量执行按计划原子组/逐项返回。
- 永久删除要求输入对象名、原因、重新认证；有法务冻结、已发布制品或保留策略阻断时不显示可绕过入口。

### API 契约

| 方法与路径 | 请求/响应 | 约束与错误 |
|---|---|---|
| `GET /api/v1/recycle-bin` | projectId/type/deletedBy/expiresBefore/hold | 数据范围授权 |
| `POST /api/v1/recycle-bin/restore-plans` | `{commandId,itemIds[],conflictPolicy}`；返回 plan/blockers/groups | 只读计划有 TTL |
| `POST /api/v1/recycle-bin/restores` | `{commandId,planId,planDigest}`；逐项结果 | plan 过期/变化则拒绝 |
| `POST /api/v1/recycle-bin/permanent-deletions` | `{commandId,itemIds[],reason,reauthToken}`；202 cleanup batch | `retention_hold_active` |

### 数据模型

- 各聚合软删字段为事实源；`recovery_plans(id,actor_id,input_json,plan_json,plan_digest,expires_at,status)`。
- `retention_holds(id,target_type,target_id,reason,starts_at,ends_at?,released_by?)`；`cleanup_batches` 与 item 结果追加写。
- 永久删除先写 tombstone/audit，再清理文件与数据库；失败可重试且不显示为成功。

### 可执行验收用例

```gherkin
@US-025 @e2e @p0
Scenario: US-025-S01 恢复项目及依赖组
  Given 已删除项目和其剧集仍在保留期且无名称冲突
  When owner 生成计划并按相同 digest 执行
  Then 项目和依赖组恢复且所有引用核对通过

Scenario: US-025-S02 法务冻结阻止永久删除
  Given Shot 存在活动 retention hold
  When 管理员提交永久删除
  Then API 返回 retention_hold_active 且文件和记录均保留
```

## US-026 配置中心

### 页面交互规格

- 路由：`/admin/settings`、`/projects/{id}/settings`、`/account/preferences`；按 system/project/user 作用域分栏，显示生效值和来源。
- 字段由 schema 渲染，修改前显示影响和是否热更新；敏感值默认掩码，编辑时“保持/替换/清空”三态明确。
- 恢复默认只删除当前作用域覆盖并预览继承结果；关键配置版本可回滚，凭据差异不回显。

### API 契约

| 方法与路径 | 请求/响应 | 约束与错误 |
|---|---|---|
| `GET /api/v1/settings/effective` | `scopeContext,keys[]`；返回 value/source/schemaVersion，敏感值掩码 | 权限过滤 |
| `GET /api/v1/settings/{scope}/{key}` | 当前覆盖/version | scope 权限 |
| `PUT /api/v1/settings/{scope}/{key}` | `{commandId,valueAction,value?}`，valueAction 为 keep、replace 或 clear | `If-Match`；schema 校验 |
| `DELETE /api/v1/settings/{scope}/{key}` | 删除覆盖并返回新生效来源 | `If-Match` |
| `POST /api/v1/settings/{scope}/{key}/rollbacks` | `{commandId,toVersion}` | 敏感值使用密钥版本引用 |

### 数据模型

- `setting_definitions(key,schema_version,json_schema,default_json,allowed_scopes,sensitive,hot_reload,status)`。
- `typed_settings(id,scope_type,scope_id,key,value_ciphertext_or_json,definition_version,version,...)`；唯一 `(scope_type,scope_id,key)`。
- `setting_versions` 追加写摘要；预算、质量、表现、发布凭据仍走专用模型/API，只在有效值查询中聚合展示。

### 可执行验收用例

```gherkin
@US-026 @e2e @p0
Scenario: US-026-S01 正确解析三层配置
  Given system=A、project=B、当前用户无覆盖
  When 用户读取生效值
  Then 返回B且 source=project；删除项目覆盖后返回A

Scenario: US-026-S02 敏感值保持原值不被掩码覆盖
  Given 页面读取凭据只得到掩码
  When 用户更新其他字段并对凭据提交 valueAction=keep
  Then 密文摘要不变且响应不包含明文
```

## US-027 操作审计

### 页面交互规格

- 路由：`/admin/audit`；项目 owner/admin 可切到项目范围，普通用户只看策略允许的本人记录。
- 支持时间、操作者、动作、对象、项目、结果、correlationId 筛选；详情显示脱敏 metadata 和 before/after digest，不提供编辑/删除。
- 大范围导出为异步任务，预估数量后确认；下载短期有效，导出行为本身进入审计。

### API 契约

| 方法与路径 | 请求/响应 | 约束与错误 |
|---|---|---|
| `GET /api/v1/audit-records` | 时间/actor/action/target/project/result/correlationId/cursor | 稳定 occurredAt desc,id desc |
| `GET /api/v1/audit-records/{id}` | 统一 envelope、脱敏 metadata | 数据范围 |
| `POST /api/v1/audit-record-exports` | `{commandId,filters,format}`；202 job | 高风险、审计自身 |
| `GET /api/v1/audit-record-exports/{id}` | 状态、count、expiresAt、downloadRef | 绑定申请人 |

### 数据模型

- `audit_records(id,occurred_at,actor_id,impersonator_id,action,target_type,target_id,project_id,correlation_id,result,ip_prefix,user_agent_digest,before_digest,after_digest,metadata_json)` 追加写。
- `audit_export_jobs` 保存过滤摘要、申请人、状态、文件哈希；记录默认至少365天。运行日志不得写入本表冒充业务审计。

### 可执行验收用例

```gherkin
@US-027 @security @p0
Scenario: US-027-S01 高风险命令在审计不可用时失败关闭
  Given 审计持久化不可用且用户尝试永久删除
  When 命令执行
  Then 返回 audit_unavailable、对象未删除且产生运维告警

Scenario: US-027-S02 项目管理员无法查询其他项目
  Given 用户仅为项目A admin
  When 过滤 projectId=项目B
  Then API 返回 permission_denied 且不泄露记录数量
```

## US-028 版本化数据导入导出

### 页面交互规格

- 项目设置提供导出；导入向导依次为上传、扫描、解析、冲突预检、映射确认、执行、核对报告。
- 导出显示包含/排除项、schemaVersion 和文件估算；敏感凭据、会话、审计和密钥默认且不可取消排除。
- merge 冲突逐项展示 ID/名称/版本/引用方案；执行失败不暴露半成品，允许从 staging 恢复或整体回滚。

### API 契约

| 方法与路径 | 请求/响应 | 约束与错误 |
|---|---|---|
| `POST /api/v1/project-exports` | `{commandId,projectId,includeMedia,format:"manju-project"}`；202 job | 幂等 |
| `GET /api/v1/project-exports/{id}` | status/schemaVersion/hash/downloadRef/expiresAt/report | 申请人/项目权限 |
| `POST /api/v1/project-imports/plans` | `{commandId,uploadId,mode,targetProjectId?}`，mode 为 create_new 或 merge | 扫描、版本和哈希校验 |
| `POST /api/v1/project-imports/{id}/confirm` | `{commandId,planDigest,resolutions[]}`；202 | plan 变化拒绝 |
| `GET /api/v1/project-imports/{id}` | 状态、逐阶段进度、核对报告 | 批次隔离 |

### 数据模型

- `export_jobs`、`import_jobs` 保存 schema/product version、manifest hash、状态、stage、report；`import_object_mappings(import_id,source_type,source_id,target_id,resolution)`。
- `staging_files` 有哈希、扫描状态、TTL；确认前不进入正式媒体空间。项目包 manifest/校验和规则见数据生命周期文档。

### 可执行验收用例

```gherkin
@US-028 @integration @p1
Scenario: US-028-S01 导出后导入保持引用完整
  Given 项目包含剧本、Shot、资产、音频和快照
  When 导出为当前 schema 包并以 create_new 导入
  Then 核对报告对象数和文件哈希一致且所有内部引用指向新 ID

Scenario: US-028-S02 校验失败不产生半成品
  Given 项目包中一个媒体文件哈希错误
  When 用户创建导入计划
  Then 返回 package_checksum_mismatch 且正式表和媒体区无新增对象
```

## US-029 备份与灾难恢复

### 页面交互规格

- 路由：`/admin/backups`；显示数据库、媒体、配置、事件位点覆盖、哈希验证、保留期、RPO/RTO 状态和最近演练。
- 创建/验证可由管理员发起；恢复向导必须选择隔离环境/维护窗口、备份集、验证清单和回切方案，并重新认证或双人批准。
- 执行中显示阶段；失败不得覆盖最后可用环境。恢复完成只有在引用、事件位点和抽样旅程验证后才能切换。

### API 契约

| 方法与路径 | 请求/响应 | 约束与错误 |
|---|---|---|
| `POST /api/v1/admin/backups` | `{commandId,type,scope}`，type 为 full 或 incremental；202 BackupSet | 幂等；platform_admin |
| `POST /api/v1/admin/backups/{id}/verify` | `{commandId,verificationProfile}`；202 | 生成独立验证记录 |
| `POST /api/v1/admin/restore-plans` | `{commandId,backupSetId,targetEnvironment,maintenanceWindow,rollbackPlan}` | 不在生产直接执行 |
| `POST /api/v1/admin/restores/{id}/approvals` | `{commandId,decision,reauthToken}` | 申请人与批准人分离（策略启用时） |
| `POST /api/v1/admin/restores/{id}/execute` | `{commandId,planDigest}`；202 | 计划已批准且备份已验证 |

### 数据模型

- `backup_sets(id,type,status,schema_version,event_position,started_at,completed_at,retention_until,encryption_key_ref,manifest_hash)`；`backup_artifacts` 按 database/media/config/position 保存哈希。
- `backup_verifications`、`restore_jobs`、`restore_approvals`、`restore_verifications` 全部追加写；恢复不修改备份制品。
- 调度必须监控最近成功且已验证备份是否满足 RPO≤1h；报告计算实际 RTO 并以30分钟为正式发布门槛。

### 可执行验收用例

```gherkin
@US-029 @disaster-recovery @p0
Scenario: US-029-S01 通过验证的备份完成隔离恢复
  Given 一个覆盖数据库、媒体和事件位点且哈希通过的 BackupSet
  When 执行已批准的隔离恢复并通过抽样旅程
  Then RestoreJob 为 verified 且记录实际RTO和引用核对报告

Scenario: US-029-S02 未验证备份不能执行恢复
  Given BackupSet 仅完成文件写入但未验证
  When 管理员执行 RestorePlan
  Then API 返回 backup_not_verified 且目标环境未改变
```
