# 平台基础能力需求

> **权威性**：本文经 `02-requirements-and-acceptance.md` 引用后，作为 US-022～US-029 的详细验收附件。若摘要与本文冲突，以本文的可测试验收条件为准。  
> **范围**：单组织正式产品；不隐含 SaaS 计费、多租户或公开注册。

## US-022 用户与成员管理

**用户故事**：作为平台管理员，我希望创建、邀请、停用和管理用户，使只有合法成员能够进入组织并被加入项目。

**验收条件**：

- 用户来源支持管理员创建和受信任 SSO 自动创建；默认不提供匿名自助注册。
- 用户状态至少包含 `invited/active/disabled/locked`；disabled 用户的现有会话必须失效。
- 用户名和规范化邮箱在组织内唯一；重复请求必须幂等。
- 禁用最后一个 `platform_admin` 必须被阻止。
- 用户离开组织时不删除其审计、历史作品和审核署名，显示为历史身份。
- 管理员可重置密码或撤销全部会话；系统不得通过通知发送明文密码。
- 列表支持状态、来源、系统角色和项目成员关系筛选，敏感字段按权限脱敏。
- 所有创建、启停、角色和凭据操作必须审计。

**优先级**：P0。

## US-023 认证与会话安全

**用户故事**：作为组织成员，我希望通过安全的账号或企业 SSO 登录并管理会话，使账号被盗和越权风险可控。

**验收条件**：

- 支持账号密码和已配置企业 SSO；认证方式由系统策略启停。
- 密码策略、失败锁定、过期和历史复用必须由服务端执行；日志不得记录密码、Token 或授权码。
- Web 会话使用 HttpOnly/Secure/SameSite Cookie 或等价安全机制；所有写请求启用 CSRF 防护。
- 登录、刷新、登出、改密、管理员重置、用户禁用均有明确会话失效规则。
- 用户可查看活跃会话并撤销其他会话；异常登录产生安全通知。
- SSO state、redirect URI 和授权码必须一次性校验并设有效期。
- 未认证返回 401；已认证但无权返回 403；不得用 404 统一掩盖而破坏审计，资源枚举风险由响应详情控制。
- 认证核心路径必须覆盖暴力破解、会话固定、CSRF、开放重定向和跨项目越权测试。

**优先级**：P0。

## US-024 通知中心

**用户故事**：作为项目成员，我希望在合适渠道及时收到与我相关的任务、审核、预算、质量、SLA 和发布通知，并控制噪声。

**验收条件**：

- 站内通知为必选渠道；邮件为可配置渠道；实时刷新使用 SSE，断线后通过游标补拉。
- Notification 必须记录事件类型、模板版本、接收人、项目、对象、优先级、去重键、投递状态和可跳转目标。
- 用户可按通知类别设置站内/邮件偏好和免打扰时段；P0 安全/数据事故通知不可完全关闭。
- 同一业务事件重复投递必须按去重键幂等；批量事件可按规则合并摘要，不能造成通知风暴。
- 支持未读数、按条件筛选、单条/批量已读、归档和跳转；已读状态按用户隔离。
- 邮件失败采用有上限重试并进入死信；站内通知成功不掩盖邮件失败状态。
- SLA 升级必须记录原接收人、升级接收人、规则和时间。
- 模板变量必须经过 schema 校验和转义；缺失变量不得发送残缺通知。

**优先级**：P1；但认证安全告警、审核结果和 P0 SLA 通知是发布阻断子集。

## US-025 统一回收站与数据恢复

**用户故事**：作为项目管理员，我希望查询、批量恢复或永久删除软删除数据，使误删可恢复且保留策略可执行。

**验收条件**：

- 支持项目、剧集、剧本、分镜板、Shot、角色、场景、道具、音频、字幕、剪辑工程和允许删除的模板；不支持删除的制品必须显示原因。
- 回收站显示对象类型、名称、删除人、删除时间、到期时间、父对象和依赖摘要。
- 恢复前执行父对象存在性、名称唯一、权限、保留期和引用冲突预检；冲突时不做部分静默恢复。
- 批量恢复返回逐项结果；有关联的一组对象支持事务恢复计划。
- 默认软删除保留 30 天；法务保留或安全调查对象停止物理清理。
- 永久删除要求高风险确认、原因和重新认证；owner 可申请，平台管理员按策略批准/执行。
- 到期清理必须幂等并生成审计报告；文件和数据库清理失败进入重试/人工处理。
- 已发布成片和 PublishRecord 按保留策略归档，不通过普通回收站永久删除。

**优先级**：P1；主生产对象的恢复和永久删除保护是发布阻断子集。

## US-026 配置中心

**用户故事**：作为平台管理员、项目管理员和普通用户，我希望在正确作用域管理配置，使默认值、覆盖关系和敏感信息清晰可控。

**验收条件**：

- 配置作用域固定为 `system/project/user`，解析优先级为用户覆盖项目、项目覆盖系统；不允许跨组织读取。
- 每个配置项具有 key、schema、默认值、作用域、是否敏感、是否可热更新和版本。
- 敏感配置加密存储、默认不回显；更新接口区分“保持原值”和“清空”。
- 项目表现规格、预算、质量策略、默认模型、发布账号引用和通知策略使用专用命令，不直接依赖无类型 KV。
- 修改前进行 schema 与业务校验；变更采用乐观锁并生成审计记录。
- 支持查看生效值及来源，但无权用户不能看到敏感值。
- 恢复默认值必须明确作用域；不得删除下层覆盖造成意外继承。
- 关键配置变更可以回滚到前一版本；凭据值不出现在回滚差异中。

**优先级**：P1；安全凭据、预算、质量和项目表现规格配置是发布阻断子集。

## US-027 操作审计

**用户故事**：作为平台管理员或项目所有者，我希望检索和导出不可抵赖的关键操作记录，使安全调查、责任追溯和合规检查有证据。

**验收条件**：

- 统一 AuditRecord envelope：`id/occurredAt/actor/impersonator/action/target/projectId/correlationId/result/ip/userAgent/beforeDigest/afterDigest/metadata`。
- 必须覆盖认证、成员与权限、预算、质量规则、生成调度、审核决策、发布、凭据、导入导出、备份恢复和永久删除。
- 审计写入失败对高风险命令采用 fail-closed；低风险命令可完成但必须告警和补偿，策略需逐命令声明。
- 审计记录追加写、不可普通修改或删除；敏感字段脱敏，禁止写入密钥、Token、完整 Prompt 私密变量或文件内容。
- 平台管理员可查全局；项目 owner/admin 只查项目范围；普通用户只查被允许的本人操作。
- 查询支持时间、操作者、动作、对象、项目、结果和 correlationId；大结果异步导出并审计。
- 审计保留期默认不少于 365 天，可由合规策略延长；到期清理本身需要审计。
- `app_logs` 与 `audit_logs` 必须收敛语义：运行日志用于诊断，AuditRecord 用于业务/安全证据。

**优先级**：P0（关键命令覆盖）/P1（高级查询导出）。

## US-028 版本化数据导入导出

**用户故事**：作为项目管理员，我希望使用版本化项目包迁入、迁出或复制项目，使内容与依赖可验证、可追溯并可回滚。

**验收条件**：

- 项目包包含 `manifest.json`、`schemaVersion`、产品版本、对象清单、文件哈希、依赖关系和导出时间；敏感凭据、会话、审计和密钥默认排除。
- 至少支持当前和前一主版本导入；更旧版本必须先迁移或明确拒绝，不做猜测性解析。
- 导入流程为上传→病毒/格式检查→解析→依赖/冲突预检→用户确认→事务写入→核对报告。
- 支持 `create_new/merge` 两种模式；merge 必须展示 ID、名称、版本和引用冲突解决方案。
- 导入使用批次 ID 和幂等键；失败时整体回滚，无法原子化的大文件复制采用可恢复 staging，不暴露半成品。
- 导出文件带完整性哈希；下载链接短期有效且权限绑定。
- 剧本专项格式继续支持，但必须映射到项目包中的来源和导入报告。
- 导入导出均生成 AuditRecord 和可下载报告。

**优先级**：P1；版本、完整性、权限和原子性为发布阻断设计要求。

## US-029 备份与灾难恢复

**用户故事**：作为平台管理员，我希望自动备份并完成可证明的恢复演练，使数据库、媒体文件和事件位点在故障后达到约定恢复目标。

**验收条件**：

- 备份范围同时覆盖数据库、媒体/资产文件、必要配置、事件位点和 schema 版本；凭据按独立密钥策略保护。
- 正式发布最低目标：RPO ≤ 1h、RTO ≤ 30min；部署可配置更严格目标，任何放宽必须经过风险审批并持续告警，不得作为正式发布验收值。
- 支持定时全量备份和可选增量备份；备份加密、校验哈希并记录保留到期时间。
- 备份成功必须经过可读性/完整性校验；只生成文件不算成功。
- 恢复必须进入维护模式或隔离环境，校验数据库、文件、引用、事件位点和抽样业务旅程后才能切换。
- 至少每季度执行一次恢复演练并生成报告；连续失败升级到平台管理员。
- 恢复操作需要双人批准或平台管理员重新认证，并写入独立审计。
- 恢复失败不得覆盖最后一个可用环境；回切步骤和负责人必须在运行手册中明确。

**优先级**：P1；可用备份、恢复程序和发布前恢复演练为正式上线阻断项。

## 横切验收

- 所有写命令采用统一错误 envelope、权限键、幂等策略和 correlationId。
- 所有异步任务具有 queued/running/completed/failed/cancelled 终态、超时和人工接管。
- 所有敏感能力具有负向、越权、跨项目和审计测试。
- 页面存在、接口存在或脚本存在均不能单独视为完成；必须回填追踪矩阵和 `docs/implementation/02-feature-status.md`。

## 目标 API 与 Schema

> 以下是设计目标，不表示当前路由已实现；实际完成状态必须由 OpenAPI、迁移和契约测试替换追踪矩阵中的“待核验”。

| 能力 | 目标 API | 核心 Schema/表 |
|---|---|---|
| 用户 | `POST /api/v1/admin/users`、`POST /api/v1/admin/invitations`、`PATCH /api/v1/admin/users/{id}/status`、`POST /api/v1/admin/users/{id}/revoke-sessions` | users, organization_memberships, invitations, sessions, sso_links |
| 本人会话 | `GET /api/v1/auth/sessions`、`DELETE /api/v1/auth/sessions/{id}`、`POST /api/v1/auth/change-password` | sessions, auth_attempts |
| 通知 | `GET /api/v1/notifications`、`POST /api/v1/notifications/read-batch`、`POST /api/v1/notifications/{id}/archive`、`GET/PUT /api/v1/notification-preferences`、`GET /api/v1/notifications/stream` | notifications, notification_preferences, notification_delivery_attempts, notification_templates |
| 回收站 | `GET /api/v1/recycle-bin`、`POST /api/v1/recycle-bin/restore-plans`、`POST /api/v1/recycle-bin/restores`、`POST /api/v1/recycle-bin/permanent-deletions` | 各聚合 deleted_at + retention_holds + cleanup_batches |
| 配置 | `GET /api/v1/settings/effective`、`GET/PUT/DELETE /api/v1/settings/{scope}/{key}`；预算/质量/表现使用专用 API | typed_settings, setting_versions, project_budgets, quality_rule_sets |
| 审计 | `GET /api/v1/audit-records`、`POST /api/v1/audit-record-exports`、`GET /api/v1/audit-record-exports/{id}` | audit_records, audit_export_jobs |
| 导入导出 | `POST /api/v1/project-exports`、`GET /api/v1/project-exports/{id}`、`POST /api/v1/project-imports/plans`、`POST /api/v1/project-imports/{id}/confirm` | export_jobs, import_jobs, import_object_mappings, staging_files |
| 备份恢复 | `POST /api/v1/admin/backups`、`POST /api/v1/admin/backups/{id}/verify`、`POST /api/v1/admin/restore-plans`、`POST /api/v1/admin/restores/{id}/execute` | backup_sets, backup_artifacts, restore_jobs, restore_verifications |

所有列表 API 使用游标或稳定分页、显式排序和项目/用户范围；所有写 API 接收 `commandId`、`idempotencyKey`（适用时）和 `expectedVersion`（修改聚合时）。
