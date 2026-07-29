# 前端 DDD 开发规范（可实施版）

> 适用范围：漫剧 AI 生产平台前端（Next.js 15 + React 19 + TypeScript）
> 权威归属：本文档为前端开发规范权威，领域定义以 `docs/domain/` 为准，API 契约以 `docs/engineering/03-api.md` 为准。
> 制定原则：瘦身版前端 DDD——不复制后端不变量，只承载交互规则与展示模型；适配现有代码结构，支持增量迁移。

---

## 一、核心设计原则

### 1. 前端 DDD 是瘦身版，不是后端 DDD 的完整复制

后端聚合根保证真正的业务不变量（如"库存不足不能下单""分镜未审批不能进入流水线"）。前端领域层的职责边界：

| 职责 | 前端领域层做 | 后端领域层做 |
|------|-------------|-------------|
| 业务不变量校验（写路径） | 交互前置校验（快速反馈） | 权威校验（最终防线） |
| 状态机定义与转换规则 | 定义展示状态机 + 可转换判断 | 定义持久状态机 + 强制转换 |
| 金额/进度等计算 | 展示计算（派生只读） | 权威计算 |
| 跨实体复杂业务规则 | 编排调用（委托后端） | 核心规则实现 |

**红线**：前端领域层不承载后端权威规则，避免与后端不一致；前端做的是"展示模型 + 交互规则 + 派生计算"。

### 2. 三条强制原则

1. **依赖向内**：展示层 → 应用层 → 领域层 ← 基础设施层，内层绝不 import 外层。
2. **领域层零框架依赖**：不 import React、Next.js、Zustand、fetch；只允许 import TypeScript 标准库与 `shared/` 纯工具。
3. **聚合根封装行为**：外部只能操作聚合根，不能直接改子实体字段；状态变更通过聚合根方法触发。

### 3. 增量迁移，非推倒重来

现有代码（`lib/app-types.ts`、`services/*.service.ts`、`components/factory/`）有成熟实践，本规范允许新旧结构共存，按模块逐步迁移（见第十二章迁移路径）。

---

## 二、四层架构与目录结构

### 目标目录结构（与现有结构共存）

```
frontend/
├── domains/                      # 领域层【新增，核心】
│   ├── script/                   # 剧本创作上下文
│   ├── storyboard/               # 分镜导演上下文
│   ├── asset/                    # 资产库上下文（角色/场景/道具）
│   ├── pipeline/                 # AI任务调度上下文
│   ├── project/                  # 项目管控上下文
│   ├── review/                   # 审核质量上下文
│   ├── publish/                  # 发布交付上下文
│   ├── assistant/                # 智能助手上下文
│   └── post-production/          # 后期制作上下文
│       ├── entities/             # 实体（有ID、有行为）
│       ├── valueObjects/         # 值对象（不可变）
│       ├── domainServices/       # 领域服务（跨实体规则）
│       ├── domainEvents/         # 领域事件
│       ├── repositories/         # 仓储接口（抽象Port）
│       └── index.ts              # 域内 barrel 导出
│
├── application/                  # 应用层【新增】
│   ├── script/
│   ├── storyboard/
│   └── ...
│       ├── useCases/             # 用例（一个操作一个文件）
│       └── dtos/                 # 入参出参 DTO
│
├── infrastructure/               # 基础设施层【重组现有 services + lib/api-client】
│   ├── repositories/             # 仓储接口的具体实现
│   ├── api-client/               # HTTP 客户端（现有 lib/api-client.ts 迁入）
│   ├── storage/                  # LocalStorage 封装
│   ├── eventBus/                 # 事件总线实现
│   └── mappers/                  # DTO ↔ 领域实体映射（防腐层）
│
├── presentation/                 # 展示层【现有 app/components/hooks 逻辑归入】
│   ├── app/                      # = 现有 app/（路由）
│   ├── components/               # = 现有 components/
│   ├── hooks/                    # = 现有 hooks/
│   └── stores/                   # = 现有 lib/stores/
│
├── shared/                       # 全局共享【现有 lib/utils 等纯工具迁入】
│   ├── constants/
│   ├── types/
│   └── utils/
│
└── legacy-bridge/                # 迁移期兼容层（迁移完成后删除）
```

### 层间依赖规则（ESLint 可校验）

```
presentation  →  application  →  domains  ←  infrastructure
     │                              ↑
     └──────────────────────────────┘
              禁止：presentation 直接 import infrastructure
```

| 层 | 允许 import | 禁止 import |
|----|------------|-------------|
| domains | 同域内文件、`shared/` | application、infrastructure、presentation、React/Next/Zustand |
| application | `domains/`、`infrastructure/` 的接口（非实现）、`shared/` | presentation、React 组件 |
| infrastructure | `domains/` 接口、第三方库（fetch、Zustand）、`shared/` | presentation、application |
| presentation | `application/`、`domains/`（只读类型）、`shared/`、React/Next | 直接 import `infrastructure/repositories/` 实现（须通过 application 层） |

---

## 三、领域层规范

### 1. 实体 Entity

用 TypeScript class 定义，强制主键 `id`，业务行为封装为方法，状态变更不暴露直接赋值。

```typescript
// domains/storyboard/entities/Shot.ts
import { ShotStatus } from '../valueObjects/ShotStatus'
import { ShotSize } from '../valueObjects/ShotSize'

export class Shot {
  readonly id: string
  readonly projectId: string
  readonly storyboardId: string
  private status: ShotStatus
  readonly size: ShotSize
  private approvedAt: Date | null

  constructor(props: {
    id: string
    projectId: string
    storyboardId: string
    status: ShotStatus
    size: ShotSize
    approvedAt: Date | null
  }) {
    this.id = props.id
    this.projectId = props.projectId
    this.storyboardId = props.storyboardId
    this.status = props.status
    this.size = props.size
    this.approvedAt = props.approvedAt
  }

  /** 交互规则：是否可审批（仅 draft/ready 状态可审批） */
  canApprove(): boolean {
    return this.status.equals(ShotStatus.DRAFT) || this.status.equals(ShotStatus.READY)
  }

  /** 审批通过——前端展示状态机转换 */
  approve(): void {
    if (!this.canApprove()) {
      throw new Error(`当前状态 ${this.status.label} 不可审批`)
    }
    this.status = ShotStatus.APPROVED
    this.approvedAt = new Date()
  }

  /** 派生计算：是否可进入流水线 */
  get isPipelineReady(): boolean {
    return this.status.equals(ShotStatus.APPROVED)
  }
}
```

**关键约束**：
- `status` 为 `private`，外部只能通过 `approve()` 等方法变更；
- `canApprove()` 是交互前置判断，供 UI 决定是否显示审批按钮；
- 后端仍会独立校验状态机，前端校验仅用于快速反馈，不作为最终防线。

### 2. 值对象 ValueObject

不可变，修改返回新实例，用静态工厂方法创建。

```typescript
// domains/storyboard/valueObjects/ShotStatus.ts
export class ShotStatus {
  private constructor(
    public readonly value: string,
    public readonly label: string
  ) {}

  static readonly DRAFT = new ShotStatus('draft', '草稿')
  static readonly GENERATING = new ShotStatus('generating', '生成中')
  static readonly READY = new ShotStatus('ready', '就绪')
  static readonly APPROVED = new ShotStatus('approved', '已审批')
  static readonly REJECTED = new ShotStatus('rejected', '已驳回')

  /** 值相等判断 */
  equals(other: ShotStatus): boolean {
    return this.value === other.value
  }

  /** 从后端字符串还原（基础设施层调用） */
  static fromString(value: string): ShotStatus {
    const map: Record<string, ShotStatus> = {
      draft: ShotStatus.DRAFT,
      generating: ShotStatus.GENERATING,
      ready: ShotStatus.READY,
      approved: ShotStatus.APPROVED,
      rejected: ShotStatus.REJECTED,
    }
    const status = map[value]
    if (!status) throw new Error(`未知分镜状态: ${value}`)
    return status
  }
}
```

**修正原规范硬伤**：每个静态实例必须传齐 `(value, label)` 两个参数；`value` 是程序标识（与后端对齐的 snake_case），`label` 是 UI 展示文案。

### 3. 仓储接口 Repository（端口）

只定义抽象接口，具体实现在基础设施层。

```typescript
// domains/storyboard/repositories/IShotRepository.ts
import { Shot } from '../entities/Shot'

export interface IShotRepository {
  findByStoryboardId(storyboardId: string): Promise<Shot[]>
  findById(id: string): Promise<Shot | null>
  save(shot: Shot): Promise<Shot>
  updateStatus(id: string, status: string): Promise<void>
}
```

### 4. 领域事件 DomainEvent

跨上下文解耦，领域层只发布不订阅处理。

```typescript
// domains/storyboard/domainEvents/ShotApprovedEvent.ts
export class ShotApprovedEvent {
  readonly occurredAt = new Date()

  constructor(
    public readonly shotId: string,
    public readonly storyboardId: string,
    public readonly projectId: string
  ) {}
}
```

### 5. 领域服务 DomainService

跨实体的复杂规则，当单个实体无法承载时使用。

```typescript
// domains/storyboard/domainServices/StoryboardProgressService.ts
import { Shot } from '../entities/Shot'
import { ShotStatus } from '../valueObjects/ShotStatus'

export class StoryboardProgressService {
  /** 派生计算：分镜板进度（纯函数，易测试） */
  static calculateProgress(shots: Shot[]): {
    total: number
    approved: number
    rejected: number
    pending: number
    progress: number
  } {
    const total = shots.length
    const approved = shots.filter(s => s.status.equals(ShotStatus.APPROVED)).length
    const rejected = shots.filter(s => s.status.equals(ShotStatus.REJECTED)).length
    const pending = total - approved - rejected
    const progress = total === 0 ? 0 : Math.round((approved / total) * 100)
    return { total, approved, rejected, pending, progress }
  }
}
```

---

## 四、应用层规范

### UseCase 编排规则

一个用户操作对应一个 UseCase；只做流程编排，不写核心业务规则。

```typescript
// application/storyboard/useCases/ApproveShotUseCase.ts
import { IShotRepository } from '@/domains/storyboard/repositories/IShotRepository'
import { ShotApprovedEvent } from '@/domains/storyboard/domainEvents/ShotApprovedEvent'
import type { EventBus } from '@/infrastructure/eventBus/types'

export class ApproveShotUseCase {
  constructor(
    private shotRepo: IShotRepository,
    private eventBus: EventBus
  ) {}

  async execute(shotId: string): Promise<void> {
    // 1. 查询聚合根
    const shot = await this.shotRepo.findById(shotId)
    if (!shot) throw new Error('分镜不存在')

    // 2. 委托领域层执行交互规则
    shot.approve()

    // 3. 持久化（委托基础设施层）
    await this.shotRepo.updateStatus(shotId, 'approved')

    // 4. 发布领域事件
    this.eventBus.publish(new ShotApprovedEvent(shot.id, shot.storyboardId, shot.projectId))
  }
}
```

**关键约束**：
- 依赖注入仓储接口（`IShotRepository`），不依赖实现类；
- 不做 UI 渲染、不操作全局状态、不写价格/进度计算等业务规则；
- 参数校验 → 调用领域实体方法 → 调用仓储保存 → 发布事件，四步以内完成。

### DI 容器（修正原规范手动 new 的问题）

用模块级单例或轻量 DI 容器，禁止在 Hook 内每次 `new`。

```typescript
// infrastructure/di/container.ts
import { ApproveShotUseCase } from '@/application/storyboard/useCases/ApproveShotUseCase'
import { ShotRepositoryImpl } from '@/infrastructure/repositories/ShotRepositoryImpl'
import { eventBus } from '@/infrastructure/eventBus'

// 模块级单例，应用生命周期内复用
const shotRepo = new ShotRepositoryImpl()

export const di = {
  approveShotUseCase: new ApproveShotUseCase(shotRepo, eventBus),
  // 其他 UseCase 按需注册
}
```

---

## 五、基础设施层规范

### 1. 仓储实现 + DTO 映射（防腐层）

实现领域层接口，后端脏数据在此层映射为干净的领域实体。

```typescript
// infrastructure/repositories/ShotRepositoryImpl.ts
import { IShotRepository } from '@/domains/storyboard/repositories/IShotRepository'
import { Shot } from '@/domains/storyboard/entities/Shot'
import { ShotStatus } from '@/domains/storyboard/valueObjects/ShotStatus'
import { ShotSize } from '@/domains/storyboard/valueObjects/ShotSize'
import { api } from '@/infrastructure/api-client'

// 后端返回的原始 DTO（snake_case，可能有冗余字段）
interface ShotDTO {
  id: string
  project_id: string
  storyboard_id: string
  status: string
  shot_size: string
  approved_at: string | null
  created_at: string
  updated_at: string
}

// 防腐层映射：DTO → 领域实体
function toDomain(dto: ShotDTO): Shot {
  return new Shot({
    id: dto.id,
    projectId: dto.project_id,
    storyboardId: dto.storyboard_id,
    status: ShotStatus.fromString(dto.status),
    size: ShotSize.fromString(dto.shot_size),
    approvedAt: dto.approved_at ? new Date(dto.approved_at) : null,
  })
}

export class ShotRepositoryImpl implements IShotRepository {
  async findByStoryboardId(storyboardId: string): Promise<Shot[]> {
    const dtos = await api<ShotDTO[]>(`/api/shots?storyboardId=${storyboardId}`)
    return dtos.map(toDomain)
  }

  async findById(id: string): Promise<Shot | null> {
    const dto = await api<ShotDTO>(`/api/shots/${id}`)
    return dto ? toDomain(dto) : null
  }

  async save(shot: Shot): Promise<Shot> {
    const dto = await api<ShotDTO>(`/api/shots`, {
      method: 'POST',
      body: JSON.stringify({ storyboardId: shot.storyboardId, size: shot.size.value }),
    })
    return toDomain(dto)
  }

  async updateStatus(id: string, status: string): Promise<void> {
    await api(`/api/shots/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) })
  }
}
```

**关键约束**：
- 后端 snake_case、冗余字段全部在此层映射转换，领域实体永远使用干净的业务模型；
- `api()` 统一封装（现有 `lib/api-client.ts` 迁入此层），业务组件不得直接调 `fetch`。

### 2. 现有 api-client.ts 迁移

现有 `lib/api-client.ts` 的 `api()`、`apiUrl()`、`clearApiCache()`、CSRF 管理、错误翻译等功能全部保留，仅迁移目录位置到 `infrastructure/api-client/`。现有 `services/*.service.ts` 逐步改造为仓储实现或保留为过渡兼容层。

---

## 六、展示层规范

### 1. 组件红线

| 允许 | 禁止 |
|------|------|
| 调用 `useApproveShot()` Hook | 组件内写状态判断 `if (shot.status === 'approved')` |
| 渲染领域实体的只读属性 `shot.isPipelineReady` | 组件内写进度计算 `shots.filter(s => ...).length` |
| 通过 props 传递领域实体 | 组件内直接调 `api()` / `fetch` |
| Store 缓存视图状态（选中态、展开态） | Store 缓存业务实体列表（应走服务端状态） |

### 2. Hook 调用应用层

```typescript
// presentation/hooks/useShotAction.ts
import { di } from '@/infrastructure/di/container'
import { useCallback } from 'react'

export function useShotAction() {
  const approveShot = useCallback(async (shotId: string) => {
    try {
      await di.approveShotUseCase.execute(shotId)
      // 成功后由事件总线驱动 UI 更新，或手动刷新
    } catch (err) {
      // 错误处理交给 Toast
      throw err
    }
  }, [])

  return { approveShot }
}
```

### 3. 现有 FactoryCRUDPage 的保留

现有 `components/factory/FactoryCRUDPage<TEntity>` 泛型组件是成熟实践，保留。迁移时将 `FactoryEntity` 基类替换为领域实体，`fetchList` 等注入函数改为调用仓储接口。

### 4. 状态管理（保留现有 Zustand 体系）

- Store 按领域划分：`useProjectStore`、`useScriptStore`、`useFactorySelectionStore`（现有实践符合）；
- Store 只缓存视图状态（选中态、展开态、主题），不缓存业务实体列表；
- 状态修改触发领域实体方法，再更新 Store。

---

## 七、类型管理规范

### 按限界上下文拆分类型文件

**现状问题**：`lib/app-types.ts`（约 700 行）和 `lib/module-types.ts`（约 670 行）是两大杂烩文件，`StoryboardStatus`、`ShotStatus` 等类型多处重复定义且不完全一致。

**目标**：每个限界上下文独立管理类型，消除重复。

```
domains/storyboard/
├── entities/Shot.ts              # Shot 实体
├── valueObjects/ShotStatus.ts    # ShotStatus 值对象
├── valueObjects/ShotSize.ts      # ShotSize 值对象
└── index.ts                      # export { Shot, ShotStatus, ShotSize }
```

### 字段命名对齐

| 层 | 命名规则 | 示例 |
|----|---------|------|
| 领域实体属性 | camelCase | `projectId`、`storyboardId` |
| 后端 DTO / 数据库 | snake_case | `project_id`、`storyboard_id` |
| 映射层 | 双向转换 | `toDomain()` / `toDTO()` |

**注意**：迁移初期，领域实体可用 camelCase，基础设施层 mapper 负责与后端 snake_case 互转。现有类型文件中的 snake_case 字段在迁移时逐步替换。

### 统一语言强制

UI 文案必须使用统一语言术语（见 `docs/domain/03-glossary.md`），禁止使用禁止别名：

| 禁止 | 正确 |
|------|------|
| 镜头 | 分镜 |
| 人物 | 角色 |
| 背景 | 场景 |
| 待办 | 工作项 |
| 工作流 | 流水线 |
| 审批 | 审核 |

---

## 八、状态同步策略（原规范缺失，本版补充）

### 前端聚合根与后端数据一致性

| 场景 | 策略 |
|------|------|
| 写操作（审批/创建/删除） | Pessimistic：等待后端确认成功后再更新 UI，失败则 Toast 提示 |
| 长耗时操作（AI 生图/视频） | 异步轮询 + SSE：后端返回 taskId，前端轮询状态（10s 间隔）或 SSE 推送 |
| 多人协作冲突 | 收到 409 时提示"数据已被他人修改，请刷新后重试"，禁止静默覆盖 |
| CQRS 读模型投影 | 最终一致（≤2s），驾驶舱/工作台数据由后端事件投影异步更新 |

### 缓存失效

- 写操作（POST/PUT/PATCH/DELETE）成功后调用 `clearApiCache()` 清除同路径 GET 缓存；
- 支持传入 `cache: "no-store"` 强制跳过缓存（现有 `api()` 已支持）。

### SSE 断线恢复

- 使用 `Last-Event-ID` 恢复断线连接；
- 重复事件不得重复更新 UI（幂等消费）。

---

## 九、命名规范

| 模块 | 命名规则 | 示例 |
|------|---------|------|
| 领域文件夹 | 小写英文名词，对齐限界上下文 | `storyboard`、`asset` |
| 实体类 | 大驼峰 | `Shot`、`Character` |
| 值对象 | 大驼峰，语义清晰 | `ShotStatus`、`ShotSize` |
| 仓储接口 | `I` + 名称 + `Repository` | `IShotRepository` |
| 仓储实现 | 名称 + `RepositoryImpl` | `ShotRepositoryImpl` |
| 用例类 | 动词 + 名词 + `UseCase` | `ApproveShotUseCase` |
| 领域事件 | 名词 + 动词过去式 + `Event` | `ShotApprovedEvent` |
| 领域服务 | 名称 + `Service` | `StoryboardProgressService` |
| DTO 映射函数 | `toDomain` / `toDTO` | `toDomain(dto)` |
| Hook | `use` + 动词 + 名词 | `useShotAction` |

---

## 十、测试规范

### 优先级

1. **领域层（最高优先级）**：实体方法、值对象校验、领域服务计算——纯函数/纯类，最容易测，应优先覆盖。
2. **应用层 UseCase**：Mock 仓储接口，测试编排流程。
3. **基础设施层**：仓储实现的映射逻辑可测试。
4. **展示层**：组件交互可选测试，E2E 覆盖关键路径。

### 领域层测试示例

```typescript
// domains/storyboard/__tests__/Shot.test.ts
import { Shot } from '../entities/Shot'
import { ShotStatus } from '../valueObjects/ShotStatus'
import { ShotSize } from '../valueObjects/ShotSize'

describe('Shot', () => {
  const createShot = (status = ShotStatus.DRAFT) =>
    new Shot({
      id: 'shot-1',
      projectId: 'proj-1',
      storyboardId: 'sb-1',
      status,
      size: ShotSize.CLOSEUP,
      approvedAt: null,
    })

  it('draft 状态可审批', () => {
    const shot = createShot(ShotStatus.DRAFT)
    expect(shot.canApprove()).toBe(true)
  })

  it('审批后状态变为 approved', () => {
    const shot = createShot(ShotStatus.DRAFT)
    shot.approve()
    expect(shot.status.equals(ShotStatus.APPROVED)).toBe(true)
    expect(shot.approvedAt).not.toBeNull()
  })

  it('已审批的不可再次审批', () => {
    const shot = createShot(ShotStatus.APPROVED)
    expect(shot.canApprove()).toBe(false)
    expect(() => shot.approve()).toThrow('不可审批')
  })
})
```

---

## 十一、避坑清单

1. **过度 DDD**：简单展示型页面（系统设置、日志查看）无需完整四层，直接 presentation + infrastructure 两层即可。
2. **领域层引入框架**：在 Entity 里 import React/Zustand/fetch——零容忍。
3. **视图层承载业务**：组件内写大量 `if` 判断业务权限、计算进度——应下沉到领域层。
4. **聚合外部直接修改子实体**：`shot.status = 'approved'`——应调 `shot.approve()`。
5. **循环依赖**：A 域 import B 域 Entity——应用领域事件解耦。
6. **接口字段直接透传给视图**：后端 DTO 直接到组件——必须在基础设施层做映射。
7. **Hook 内手动 new**：`new UseCase(new Repo())` 每次创建实例——用 DI 容器单例。
8. **复制后端不变量**：前端重复实现"库存不足不能下单"等后端权威规则——前端只做交互前置校验。
9. **Store 缓存业务列表**：把角色列表存进 Zustand——应走服务端状态（API 缓存）。
10. **静默覆盖 409**：并发冲突不提示用户——必须提示"数据已被他人修改"。

---

## 十二、迁移路径

### 阶段 0：准备（不改变现有代码）
- 在 `frontend/` 下创建 `domains/`、`application/`、`infrastructure/`、`shared/` 空目录结构；
- 配置 ESLint 层间依赖规则（见第十三章）；
- 团队对齐本规范。

### 阶段 1：基础设施层迁移（低风险）
- `lib/api-client.ts` → `infrastructure/api-client/`（仅移动目录，改 import 路径）；
- `lib/utils/` → `shared/utils/`；
- `lib/stores/` → `presentation/stores/`（或保持 `lib/stores/` 别名兼容）；
- 现有 `services/*.service.ts` 保留，作为过渡兼容层。

### 阶段 2：试点一个上下文（推荐从 storyboard 分镜导演开始）
- 创建 `domains/storyboard/` 下的 entities、valueObjects、repositories；
- 从 `lib/module-types.ts` 中抽取 `Shot`、`ShotStatus`、`ShotSize` 等类型，迁移到领域层；
- 创建 `infrastructure/repositories/ShotRepositoryImpl.ts`，封装现有 `services/module.service.ts` 中的分镜 API；
- 创建 `application/storyboard/useCases/ApproveShotUseCase.ts`；
- 试点页面（如 `app/storyboards/page.tsx`）改为通过 Hook → UseCase → Repository 调用；
- 验证通过后，删除 `lib/module-types.ts` 中对应的重复类型。

### 阶段 3：按上下文逐步推广
- 每个迭代迁移 1-2 个上下文（asset → pipeline → review → publish → ...）；
- 每次迁移以"类型文件抽取 + 仓储封装 + UseCase 编排"为最小单元；
- 迁移完成后，`lib/app-types.ts` 和 `lib/module-types.ts` 逐步清空，最终删除。

### 阶段 4：清理
- 删除 `legacy-bridge/` 兼容层；
- 删除已废弃的 `hooks/use-module-crud.ts`（已标注 DEPRECATED）；
- 全量 ESLint 依赖规则校验通过。

### 迁移期共存规则
- 新代码必须遵循四层架构；
- 老代码允许通过 `legacy-bridge/` 调用现有 `services/`；
- 禁止在新领域层代码中 import `lib/app-types.ts` 或 `lib/module-types.ts`。

---

## 十三、ESLint 依赖规则配置

```javascript
// eslint.config.mjs 片段
import boundaries from 'eslint-plugin-boundaries'

export default [
  {
    plugins: { boundaries },
    settings: {
      'boundaries/elements': [
        { type: 'domain', pattern: 'domains/*' },
        { type: 'application', pattern: 'application/*' },
        { type: 'infrastructure', pattern: 'infrastructure/*' },
        { type: 'presentation', pattern: 'presentation/*' },
        { type: 'shared', pattern: 'shared/*' },
      ],
    },
    rules: {
      'boundaries/element-types': [2, {
        default: 'disallow',
        rules: [
          { from: 'domain', allow: ['domain', 'shared'] },
          { from: 'application', allow: ['domain', 'infrastructure', 'shared'] },
          { from: 'infrastructure', allow: ['domain', 'shared'] },
          { from: 'presentation', allow: ['application', 'domain', 'shared', 'presentation'] },
        ],
      }],
    },
  },
]
```

---

## 十四、与现有文档的关系

| 文档 | 关系 |
|------|------|
| `docs/domain/` 全部 DDD 文档 | 领域权威，本文档的领域定义（聚合根、状态机、事件）以其为准 |
| `docs/engineering/01-architecture-and-development.md` §7 | 现有前端架构规范，本文档是其向 DDD 演进的升级版 |
| `docs/engineering/02-development-standards.md` §6 | 现有状态管理规范，本文档与其保持一致并补充领域层约束 |
| `docs/domain/03-glossary.md` | 统一语言术语表，本文档强制引用 |
| `docs/domain/09-dependency-rules.md` | 跨聚合引用规则，本文档前端实现须遵循 |
| `docs/domain/05-contracts.md` | 防腐层与 CQRS 读模型定义，本文档基础设施层须遵循 |

---

## 附：一句话口诀

**按业务划领域，领域纯规则不碰框架；应用层编排流程；基础设施做映射隔离后端脏数据；页面只负责点击渲染，依赖向内不向外；前端领域层是瘦身版，不复制后端不变量。**
