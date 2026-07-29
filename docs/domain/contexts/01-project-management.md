# 3.1 项目管控上下文 (Project Management)

> **所属上下文**：项目管控 (Project Management)
> **聚合根**：`Project`（含 `Episode` / `Member` / `Delegation`）/ `ProductionPlan` / `EditLease`
> **对应页面**：项目中心、生产控制塔、团队与权限
> **配套规范**：[DDD 治理规范](../02-governance.md)｜[统一语言术语表](../03-glossary.md)｜[上下文映射](../04-context-map.md)｜[跨上下文协作契约](../05-contracts.md)

**边界**：项目的创建、配置、归档；剧集管理；团队成员、权限和临时代理；版本化生产排期。实际生产进度仍来自其他上下文事实投影。

> **事件表说明**：聚合的"领域事件"表仅列出有消费者的关键事件（跨上下文消费者标注上下文名称，上下文内部消费者标注具体组件）。命令表"产出事件"列是事件全量来源，如某事件未出现在事件表中，表示其为纯内部事件且无下游消费者。

---

## 1. 聚合根：Project

```
Project (Aggregate Root)
├── id: string
├── name: string
├── category: string              // 漫剧类型
├── type: string                  // single | series
├── status: ProjectStatus         // planning | active | paused | completed | archived
├── description: string
├── episodeCount: number
├── owner: string                 // UserId
├── dueDate: string               // ISO date
├── storagePath: string
├── storageMode: string           // managed | existing
├── presentationSpec: ProjectPresentationSpec // 默认9:16、可选16:9/自定义、安全区模板
├── budgetPolicy: ProjectBudgetPolicy          // 月度/总额、硬上限、告警阈值
├── version: number               // 乐观锁
├── createdAt: string
├── updatedAt: string
├── archivedAt: string | null
├── deletedAt: string | null      // 软删除
├── episodes: Episode[]           // 聚合内实体
├── members: Member[]             // 聚合内实体
└── delegations: Delegation[]     // 有期限的项目权限代理
```

### 1.1 实体：Episode

```
Episode (Entity, within Project aggregate)
├── id: string
├── episodeNumber: number
├── title: string
├── status: string                 // planning | active | paused | completed | archived
├── targetDuration: number         // 目标时长（秒），用于后期 EditProject 时间线校验
├── createdAt: string
├── updatedAt: string
└── deletedAt: string | null       // 软删除
```

### 1.2 实体：Member

```
Member (Entity, within Project aggregate)
├── userId: string
├── roles: ProjectRole[]           // 可组合角色；owner 必须唯一
├── permissionOverrides: { allow: string[], deny: string[] } // 细粒度覆盖，deny 优先
├── addedAt: string
└── addedBy: string                // 操作人 UserId
```

### 1.2.1 实体：Delegation

```text
Delegation (Entity, within Project aggregate)
├── id: string
├── grantorUserId: string
├── delegateUserId: string
├── permissionKeys: string[]
├── startsAt: string
├── expiresAt: string
├── status: active | revoked | expired
├── reason: string
├── createdAt: string
└── revokedAt: string | null
```

### 1.3 角色枚举（ProjectRole）

| 角色 | 说明 | 核心权限 |
|------|------|---------|
| `owner` | 项目所有者 | 全部权限，不可被移除 |
| `admin` | 项目管理员 | 除转让 owner 外全部权限 |
| `producer` | 制片人 | 项目规划、成本、进度 |
| `writer` | 编剧 | 剧本读写、分析 |
| `storyboard_director` | 分镜导演 | 分镜读写、生成触发 |
| `designer` | 美术设计师 | 角色/场景/道具资产读写 |
| `video_director` | 视频导演 | 视频生成与镜头调整 |
| `voice_actor` | 配音人员 | 音频资产和配音制作 |
| `editor` | 剪辑人员 | 后期剪辑与渲染 |
| `reviewer` | 审核员 | 审核读写 |
| `publisher` | 发布员 | 成片/发布计划读写 |
| `ai_admin` | AI 管理员 | 模型、Prompt、配额与成本策略 |

### 1.3.1 项目配置值对象

```text
ProjectPresentationSpec
├── version: number
├── aspectRatio: "9:16" | "16:9" | string
├── canvasWidth: number
├── canvasHeight: number
├── safeAreaTemplateId: string | null
└── platformOverlayProfileIds: string[]

ProjectBudgetPolicy
├── version: number
├── period: daily | weekly | monthly | total
├── limit: number
├── hardCap: number | null
├── alertThreshold: number
├── currency: string
└── effectiveAt: string
```

项目配置使用有类型值对象和专用命令，不直接以通用 KV 绕过领域校验。

### 1.4 状态机

```text
planning ──start──> active ──complete──> completed
   │                  │  ▲                    │
   │               pause resume              │ reopen
   │                  ▼  │                    ▼
   └──────────────> paused ───────────────> active

planning / active / paused / completed ──archive──> archived
archived ──restore──> previousNonArchivedStatus（缺失时为 planning）
```

机器状态只使用上述英文值，UI 分别显示“策划中 / 制作中 / 已暂停 / 已完成 / 已归档”。`deletedAt` 是独立删除生命周期，不以状态值表达。

### 1.5 命令

| 命令 | 前置状态 | 产出事件 | 说明 |
|------|---------|---------|------|
| `CreateProject` | 不存在 | `ProjectCreated`, `EpisodeAdded` | 创建 `planning` 项目；owner 从认证主体派生；事务内创建默认第 1 集 |
| `StartProject` | planning / paused | `ProjectStarted` | 必要画幅、Episode、预算策略和 owner 有效后进入 active |
| `PauseProject` | active | `ProjectPaused` | 暂停新的生产命令，不取消已执行外部任务 |
| `CompleteProject` | active | `ProjectCompleted` | 核心交付完成且无进行中发布/审核后标记完成 |
| `ReopenProject` | completed | `ProjectReopened` | 重新进入 active 并记录原因 |
| `UpdateProject` | planning / active / paused | `ProjectUpdated` | 修改名称/描述/计划集数/截止日期；状态使用专用命令 |
| `UpdateProjectPresentationSpec` | planning / active / paused | `ProjectPresentationSpecUpdated` | 更新画幅/安全区；返回受影响 Shot，已送审内容不得静默覆盖 |
| `ConfigureProjectBudget` | planning / active / paused | `ProjectBudgetConfigured` | 设置预算周期、额度、硬上限和告警阈值；仅允许 owner/admin/ai_admin，producer 可提交审批 |
| `ArchiveProject` | planning / active / paused / completed | `ProjectArchived` | 归档项目，需检查所有关联进行中操作均处于终态 |
| `RestoreProject` | archived | `ProjectRestored` | 恢复到前一非归档状态；无记录时恢复为 planning |
| `SoftDeleteProject` | planning / active / paused / completed / archived | `ProjectDeleted` | 软删除；与业务状态分离 |
| `AddEpisode` | planning / active / paused | `EpisodeAdded` | 添加 Project 聚合内业务 Episode |
| `UpdateEpisode` | planning / active / paused | `EpisodeUpdated` | 修改剧集计划信息；详细生产进度由下游事实派生 |
| `SoftDeleteEpisode` | planning / active / paused / completed | `EpisodeDeleted` | 预检无阻断依赖后软删除；支持撤销和宽限期恢复 |
| `AddMember` | active | `MemberAdded` | 添加团队成员及一个或多个角色（仅 owner/admin 可执行）。不允许通过本命令授予 owner |
| `RemoveMember` | active | `MemberRemoved` | 移除团队成员（不可移除 owner） |
| `TransferOwnership` | active | `OwnershipTransferred` | owner 转让：将原 owner 降级为 admin，新团队成员设为 owner |
| `UpdateMemberRoles` | active | `MemberRolesUpdated` | 修改组合角色；owner 只能通过 TransferOwnership 变更 |
| `UpdatePermission` | active | `PermissionUpdated` | 修改团队成员的细粒度权限覆盖（仅 owner/admin 可执行） |
| `GrantDelegation` | active | `DelegationGranted` | 授予有期限、可委托的项目命令权限；双方必须是项目成员 |
| `RevokeDelegation` | active | `DelegationRevoked` | 授权人或 owner/admin 提前撤回代理 |
| `ExpireDelegation` | active 且超过 expiresAt | `DelegationExpired` | 定时任务幂等失效代理权限 |

### 1.6 不变量

- 项目归档前，所有关联的 PipelineRun 必须处于终态（completed / failed / cancelled）。
- 项目归档前，所有剧集必须无进行中的审核（in_review / pending / needs_fix）。
- 项目归档前，所有关联的 FinalVideo 不可处于打包中（packaging）。
- 项目归档前，所有关联的 PublishPlan 不可处于执行中（executing）。
- 剧集软删除统一使用 `deletedAt` 字段标记，与工厂实体（Character/Scene/Prop）、Script、Dataset 等保持一致；支持 5 秒撤销，30 天宽限期内可恢复，超过后走物理删除（管理接口）。
- 剧集删除前必须执行只读依赖预检，且无 Script、Storyboard、Shot、Audio、EditProject、FinalVideo 等阻断依赖。
- 剧集删除时，剧本和资产引用通过级联事件软删除/解关联（不删除资产本身）。
- 软删除的剧集不可创建新内容，但可在宽限期内恢复。
- `Episode.targetDuration` 是后期制作 `EditProject.timeline.durationMs` 的业务上限；超出时阻止最终渲染（详见[后期制作上下文](09-post-production.md)）。
- 一个项目必须有且只有一个包含 `owner` 角色的成员，该成员不可被 `RemoveMember` 移除。
- 一个成员可拥有多个非 owner 角色，最终权限为角色权限并集叠加显式权限覆盖。
- 只能通过 `TransferOwnership` 变更 owner，且新 owner 必须是项目现有团队成员。
- 只有 `owner` / `admin` 可以执行 `ArchiveProject` / `AddMember` / `RemoveMember` / `UpdatePermission`。
- 软删除的项目不可创建新内容，但可恢复。
- `version` 每次变更只递增一次。
- `AddMember` 同一 `userId` 不可重复添加（已存在则抛 `member_already_exists`）。
- `presentationSpec` 创建后默认 9:16；变更必须递增版本并生成影响报告。已冻结 `PresentationSnapshot` 保留旧规格。
- `Episode` 的唯一业务事实源在 Project 聚合。剧本中心的 `script_episodes` 只能作为 ScriptDocument 结构投影并引用 `projectEpisodeId`，不得建立第二套编号、归档、发布或删除生命周期。
- `plannedEpisodeCount` 是计划值，实际集数从未删除 Episode 集合计算，两者不得互相覆盖。
- `storageMode=managed` 时路径由服务端生成；`existing` 必须位于部署允许根并通过权限与冲突预检。软删除项目不得默认删除 existing 原始目录。
- 预算阈值必须满足 `0 < alertThreshold < hardCap <= limit`（未启用 hardCap 时只要求告警阈值小于 limit）。
- 项目角色的默认命令权限以[命令级权限矩阵](../../requirements/product/06-rbac-command-matrix.md)为基线；系统角色与项目角色必须分层计算，前端菜单不是授权依据。
- 权限覆盖必须能表达 `allow[]` 与 `deny[]`，显式 deny 优先；旧单一 `permissions[]` 仅作为迁移输入，不作为最终模型。
- 代理权限只能是授权人当前拥有且标记为 delegable 的权限；owner 转移、成员/系统角色管理、Provider 凭据、平台配置和永久删除不可代理。
- `startsAt < expiresAt`，代理到期/撤回后立即不参与 effective permissions 计算，但历史命令保留真实操作者和代理来源。

### 1.7 领域事件

| 事件 | Payload | 消费者 |
|------|---------|-------|
| `ProjectCreated` | projectId, name, ownerId, type, status=planning | 智能助手（初始化工作台） |
| `ProjectUpdated` | projectId, changedFields | 智能助手（更新项目摘要） |
| `ProjectStarted` | projectId, startedAt | 智能助手（更新工作台）、通知（生产启动） |
| `ProjectPaused` | projectId, reason, pausedAt | AI任务调度（阻止新调度）、通知 |
| `ProjectCompleted` | projectId, completedAt | 智能助手（完成度投影）、发布交付 |
| `ProjectReopened` | projectId, reason, reopenedAt | 智能助手、通知 |
| `ProjectPresentationSpecUpdated` | projectId, version, aspectRatio, affectedShotIds | 分镜导演（影响分析）、后期制作、发布交付 |
| `ProjectBudgetConfigured` | projectId, version, period, limit, hardCap, alertThreshold | AI任务调度（更新预算投影）、智能助手（更新成本看板） |
| `ProjectArchived` | projectId, archivedAt | 全部上下文（标记关联资源为只读） |
| `ProjectRestored` | projectId | 全部上下文（解除资源只读）/ 智能助手（恢复工作台） |
| `ProjectDeleted` | projectId | 智能助手（移除工作台） |
| `EpisodeAdded` | projectId, episodeId, episodeNumber | 剧本创作（允许创建剧本） |
| `EpisodeUpdated` | projectId, episodeId | 智能助手 |
| `EpisodeDeleted` | projectId, episodeId | 剧本创作（级联软删除剧本）、分镜导演（级联清理分镜板） |
| `MemberAdded` | projectId, userId, roles[] | 智能助手（更新团队列表） |
| `MemberRemoved` | projectId, userId | 智能助手（更新团队列表） |
| `OwnershipTransferred` | projectId, fromUserId, toUserId | 智能助手（更新团队负责人） |
| `MemberRolesUpdated` | projectId, userId, roles[] | 智能助手（更新团队角色） |
| `PermissionUpdated` | projectId, userId, allow[], deny[] | 智能助手（更新权限展示）、审计投影 |
| `DelegationGranted` | projectId, delegationId, grantorUserId, delegateUserId, permissionKeys, startsAt, expiresAt | 智能助手（团队/待办显示）、通知、审计投影 |
| `DelegationRevoked` / `DelegationExpired` | projectId, delegationId, delegateUserId, occurredAt | 智能助手、通知、审计投影 |

---

## 2. 读模型

- 项目列表视图（卡片/表格）：支持按状态、类型、截止日期筛选和分页。
- 项目详情视图：含进度汇总、团队列表、剧集列表。

---

## 3. 聚合根：ProductionPlan

```text
ProductionPlan
├── id: string
├── projectId: string
├── status: draft | published | superseded | archived
├── planVersion: number
├── previousPlanId: string | null
├── items: ProductionPlanItem[]
├── assumptions: { roleCapacity, providerCapacity, workingCalendar }
├── changeReason: string | null
├── createdBy: string
├── publishedAt: string | null
└── version: number

ProductionPlanItem
├── id: string
├── episodeId: string
├── stage: script | asset | storyboard | image | video | audio | review | edit | render | publish
├── plannedStartAt / plannedEndAt
├── targetCount: number
├── assigneeUserId: string | null
├── assigneeRole: ProjectRole | null
├── priority: number
├── predecessorItemIds: string[]
├── status: planned | paused | completed | cancelled
└── completionEvidenceRefs: object[]
```

实际完成量不由用户写入：投影处理器消费各上下文事实事件，仅在证据满足计划项完成规则时调用受信任命令完成计划项。

### 3.1 命令

| 命令 | 前置状态 | 产出事件 | 说明 |
|---|---|---|---|
| `CreateProductionPlan` | 不存在 | `ProductionPlanCreated` | 创建 draft 计划 |
| `UpsertProductionPlanItem` | draft | `ProductionPlanItemChanged` | 编辑阶段目标、时间、责任和依赖 |
| `PublishProductionPlan` | draft | `ProductionPlanPublished` | 校验成员、Episode、时间和依赖后发布 |
| `CreateProductionPlanRevision` | published | `ProductionPlanSuperseded`, `ProductionPlanCreated` | 保留旧计划并创建新 draft 版本 |
| `PauseProductionPlanItem` | published + planned | `ProductionPlanItemPaused` | 仅暂停未开始项，不改变业务对象状态 |
| `ReassignProductionPlanItem` | published + planned/paused | `ProductionPlanItemReassigned` | 转交责任并记录原因 |
| `CompleteProductionPlanItemFromEvidence` | published + planned/paused | `ProductionPlanItemCompleted` | 仅受信任投影处理器可调用，必须携带完成证据 |
| `ArchiveProductionPlan` | published/superseded | `ProductionPlanArchived` | 归档显示，不删除计划和证据 |

### 3.2 不变量

- 同一项目同一时刻只能有一个 published 的当前计划；新版本发布后旧版本进入 superseded。
- `plannedStartAt < plannedEndAt`，依赖图无环，责任人必须是具备相应命令权限的有效项目成员。
- 用户不得直接执行完成命令；计划完成证据引用确切事件/对象版本。
- 重排、转交和暂停不修改 Shot、AITask、Review、EditProject 等源聚合状态。
- 计划预测是读模型结论，必须携带计算水位和假设，不能写回为业务事实。

### 3.3 领域事件

| 事件 | Payload | 消费者 |
|---|---|---|
| `ProductionPlanCreated` / `ProductionPlanItemChanged` | planId, projectId, planVersion, changedItemIds | 智能助手（控制塔预览） |
| `ProductionPlanPublished` | planId, projectId, planVersion, itemCount, assumptions | 智能助手（生产矩阵/预测）、通知（责任人） |
| `ProductionPlanSuperseded` | planId, projectId, supersededByPlanId | 智能助手、审计投影 |
| `ProductionPlanItemPaused` / `ProductionPlanItemReassigned` | planId, itemId, before, after, reason | 智能助手、通知、审计投影 |
| `ProductionPlanItemCompleted` | planId, itemId, completionEvidenceRefs, completedAt | 智能助手（矩阵完成量） |

---

## 4. 聚合根：EditLease

EditLease 只协调编辑权，不拥有或修改目标聚合内容。

```text
EditLease
├── id: string
├── projectId: string
├── targetRef: { type, id, scope }
├── holderUserId: string
├── status: active | released | expired | taken_over
├── acquiredAt / heartbeatAt / expiresAt
├── takeoverBy: string | null
├── takeoverReason: string | null
└── version: number
```

命令：`AcquireEditLease`、`RenewEditLease`、`ReleaseEditLease`、`ExpireEditLease`、`ForceTakeoverEditLease`。

- 同一 `targetRef + scope` 同时只能有一个 active 租约；不同 Shot/轨道范围可并行。
- 获取/续租时重新校验项目成员、目标写权限和租约期限；在线 Presence 不能代替租约。
- 租约到期不提交或丢弃本地更改；后续保存仍以目标聚合 `expectedVersion` 为最终并发门禁。
- 强制接管仅 owner/admin 可执行，必须填写原因并记录原持有人、未保存风险提示和审计。

| 事件 | Payload | 消费者 |
|---|---|---|
| `EditLeaseAcquired` / `EditLeaseRenewed` | leaseId, projectId, targetRef, holderUserId, expiresAt | 智能助手（协作状态）、目标页面 Presence 投影 |
| `EditLeaseReleased` / `EditLeaseExpired` | leaseId, projectId, targetRef, holderUserId, occurredAt | 智能助手、目标页面 Presence 投影 |
| `EditLeaseTakenOver` | leaseId, targetRef, previousHolder, takeoverBy, reason | 智能助手、通知、审计投影 |
