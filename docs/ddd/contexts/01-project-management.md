# 3.1 项目管控上下文 (Project Management)

> **所属上下文**：项目管控 (Project Management)
> **聚合根**：`Project`（含内部实体 `Episode` / `Member`）
> **对应页面**：项目中心
> **配套规范**：[DDD 治理规范](../governance.md)｜[统一语言术语表](../glossary.md)｜[上下文映射](../context-map.md)｜[跨上下文协作契约](../contracts.md)

**边界**：项目的创建、配置、归档；剧集管理；团队成员和权限。

> **事件表说明**：聚合的"领域事件"表仅列出有消费者的关键事件（跨上下文消费者标注上下文名称，上下文内部消费者标注具体组件）。命令表"产出事件"列是事件全量来源，如某事件未出现在事件表中，表示其为纯内部事件且无下游消费者。

---

## 1. 聚合根：Project

```
Project (Aggregate Root)
├── id: string
├── name: string
├── category: string              // 漫剧类型
├── type: string                  // single | series
├── status: ProjectStatus         // active | archived
├── description: string
├── episodeCount: number
├── owner: string                 // UserId
├── dueDate: string               // ISO date
├── storagePath: string
├── storageMode: string
├── presentationSpec: ProjectPresentationSpec // 默认9:16、可选16:9/自定义、安全区模板
├── budgetPolicy: ProjectBudgetPolicy          // 月度/总额、硬上限、告警阈值
├── version: number               // 乐观锁
├── createdAt: string
├── updatedAt: string
├── archivedAt: string | null
├── deletedAt: string | null      // 软删除
├── episodes: Episode[]           // 聚合内实体
└── members: Member[]             // 聚合内实体
```

### 1.1 实体：Episode

```
Episode (Entity, within Project aggregate)
├── id: string
├── episodeNumber: number
├── title: string
├── status: string                 // active | archived
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

```
                ┌─────────┐
        ┌──────▶│ active  │◀──────┐
        │       └────┬────┘       │
     restore         │ archive    restore
        │            ▼            │
        │       ┌─────────┐       │
        └───────│ archived│───────┘
                └─────────┘
```

### 1.5 命令

| 命令 | 前置状态 | 产出事件 | 说明 |
|------|---------|---------|------|
| `CreateProject` | 不存在 | `ProjectCreated`, `EpisodeAdded` | 创建项目，事务内自动创建默认剧集（第 1 集），同时产出 `EpisodeAdded` 事件以确保与手动添加一致 |
| `UpdateProject` | active | `ProjectUpdated` | 修改名称/描述/截止日期 |
| `UpdateProjectPresentationSpec` | active | `ProjectPresentationSpecUpdated` | 更新画幅/安全区；返回受影响 Shot，已送审内容不得静默覆盖 |
| `ConfigureProjectBudget` | active | `ProjectBudgetConfigured` | 设置预算周期、额度、硬上限和告警阈值；仅允许 owner/admin/ai_admin，producer 可提交审批 |
| `ArchiveProject` | active | `ProjectArchived` | 归档项目，需检查所有关联进行中操作均处于终态 |
| `RestoreProject` | archived | `ProjectRestored` | 恢复项目 |
| `SoftDeleteProject` | active | `ProjectDeleted` | 软删除 |
| `AddEpisode` | active | `EpisodeAdded` | 添加剧集 |
| `UpdateEpisode` | active | `EpisodeUpdated` | 修改剧集信息 |
| `SoftDeleteEpisode` | active | `EpisodeDeleted` | 软删除剧集，写入 `deletedAt`；支持 5 秒撤销，30 天宽限期内可恢复，超期走物理删除（管理接口）；需无关联分镜和成片 |
| `AddMember` | active | `MemberAdded` | 添加团队成员及一个或多个角色（仅 owner/admin 可执行）。不允许通过本命令授予 owner |
| `RemoveMember` | active | `MemberRemoved` | 移除团队成员（不可移除 owner） |
| `TransferOwnership` | active | `OwnershipTransferred` | owner 转让：将原 owner 降级为 admin，新团队成员设为 owner |
| `UpdateMemberRoles` | active | `MemberRolesUpdated` | 修改组合角色；owner 只能通过 TransferOwnership 变更 |
| `UpdatePermission` | active | `PermissionUpdated` | 修改团队成员的细粒度权限覆盖（仅 owner/admin 可执行） |

### 1.6 不变量

- 项目归档前，所有关联的 PipelineRun 必须处于终态（completed / failed / cancelled）。
- 项目归档前，所有剧集必须无进行中的审核（in_review / pending / needs_fix）。
- 项目归档前，所有关联的 FinalVideo 不可处于打包中（packaging）。
- 项目归档前，所有关联的 PublishPlan 不可处于执行中（executing）。
- 剧集软删除统一使用 `deletedAt` 字段标记，与工厂实体（Character/Scene/Prop）、Script、Dataset 等保持一致；支持 5 秒撤销，30 天宽限期内可恢复，超过后走物理删除（管理接口）。
- 剧集删除前，必须无关联的分镜板和成片。
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
- 预算阈值必须满足 `0 < alertThreshold < hardCap <= limit`（未启用 hardCap 时只要求告警阈值小于 limit）。
- 项目角色的默认命令权限以[命令级权限矩阵](../../product/rbac-command-matrix.md)为基线；系统角色与项目角色必须分层计算，前端菜单不是授权依据。
- 权限覆盖必须能表达 `allow[]` 与 `deny[]`，显式 deny 优先；旧单一 `permissions[]` 仅作为迁移输入，不作为最终模型。

### 1.7 领域事件

| 事件 | Payload | 消费者 |
|------|---------|-------|
| `ProjectCreated` | projectId, name, owner, type | 智能助手（初始化工作台） |
| `ProjectUpdated` | projectId, changedFields | 智能助手（更新项目摘要） |
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

---

## 2. 读模型

- 项目列表视图（卡片/表格）：支持按状态、类型、截止日期筛选和分页。
- 项目详情视图：含进度汇总、团队列表、剧集列表。
