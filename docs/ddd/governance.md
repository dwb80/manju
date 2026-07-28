# DDD 治理 — 文档结构与引用规范

> 本文件是漫剧 AI 生产平台 DDD 治理的**索引与规范**。所有项目文档的 DDD 引用、术语使用、上下文归属都按本规范对齐。

---

## 0. 权威来源声明

项目文档体系遵循三层权威来源原则，任何文档冲突时按以下优先级裁决：

| 权威层 | 权威文档 | 裁决范围 | 冲突处理规则 |
|--------|---------|---------|-------------|
| 领域权威 | `ddd/` 目录全部文档 | 聚合定义、状态机、领域事件、命令、不变量、统一语言术语 | 以 DDD 文档为准，其他文档须对齐 |
| 需求权威 | `requirements-and-acceptance.md` | 用户故事、验收标准、业务规则、目标 API | 以需求文档为准，差异进入追踪矩阵 |
| 接口权威 | CI 生成的 OpenAPI（门禁完成前为路由 + 契约测试） | 当前可调用路径、请求、响应和错误 | OpenAPI 与实现漂移时阻断发布 |
| 状态权威 | `feature-status.md` + 代码/API/测试证据 | 功能实现状态、已实现端点、已创建表 | 无三方证据时一律标记未核验 |

**冲突处理流程**：发现文档间冲突时，先确认权威层 → 以权威文档为准修正非权威文档 → 若权威文档本身需修改，走 [§5 变更管理](#5-ddd-文档变更管理) 流程。

---

## 1. DDD 文档体系

### 1.1 目录组织

```
docs/
└── ddd/
    ├── README.md                                 # 索引与读者指引
    ├── governance.md                             # 本文件：DDD 治理规范
    ├── domain-requirements-spec.md               # 领域需求规格概述
    ├── glossary.md                               # 统一语言术语表
    ├── context-map.md                            # 限界上下文映射
    ├── contracts.md                              # 跨上下文协作契约
    ├── module-map.md                             # 模块-上下文映射表
    ├── iteration-priority.md                     # 聚合实现优先级
    ├── infrastructure.md                         # 公共领域基础设施
    ├── dependency-rules.md                       # 依赖方向约束
    └── contexts/                                 # 9 个上下文详细规格
        ├── 01-project-management.md
        ├── 02-script-creation.md
        ├── 03-storyboard-direction.md
        ├── 04-asset-library.md
        ├── 05-ai-task-orchestration.md
        ├── 06-review-quality.md
        ├── 07-publish-delivery.md
        └── 08-ai-assistant.md
```

### 1.2 文档职责

| 文档 | 职责 |
|------|------|
| `README.md` | DDD 文档索引、读者指引、推荐阅读顺序 |
| `domain-requirements-spec.md` | 领域需求规格**概述**：文档定位、范围、配套规范清单、阅读入口 |
| `glossary.md` | 统一语言术语表（业务概念 + 状态术语 + 禁止别名） |
| `context-map.md` | 9 个限界上下文的边界、关系矩阵、共享内核 |
| `contracts.md` | 跨上下文事件链路、消费者注册表、防腐层、CQRS 投影 |
| `module-map.md` | 26 个页面到上下文和聚合根的对应关系 |
| `iteration-priority.md` | 聚合实现优先级与建议迭代节奏 |
| `infrastructure.md` | 共享内核代码位置、接口定义、公共错误码 |
| `dependency-rules.md` | 分层依赖图与跨聚合引用规则 |
| `contexts/0N-*.md` | 单一上下文的完整规格（聚合、命令、状态机、不变量、事件、读模型） |

### 1.3 拆分原则

- **基础规范独立成文**：`glossary.md` / `context-map.md` / `contracts.md` / `module-map.md` / `iteration-priority.md` / `infrastructure.md` / `dependency-rules.md` 是跨上下文的公共规范，独立维护便于引用。
- **上下文规格分文件**：每个限界上下文一个独立 Markdown 文件 `contexts/0N-<name>.md`，避免单文档过长（原文 100KB+ 已不便于审阅）。
- **概述文档轻量化**：`domain-requirements-spec.md` 仅作为文档定位和入口的概述，所有具体内容通过链接到子文档获取。
- **跨文档锚点稳定**：上下文编号 §3.1-§3.8 是稳定的语义锚点，跨文档引用以该编号为标准。

### 1.4 上下文编号映射

| 编号 | 上下文 | 文件 |
|------|--------|------|
| §3.1 | 项目管控 (Project Management) | `contexts/01-project-management.md` |
| §3.2 | 剧本创作 (Script Creation) | `contexts/02-script-creation.md` |
| §3.3 | 分镜导演 (Storyboard Direction) | `contexts/03-storyboard-direction.md` |
| §3.4 | 资产库 (Asset Library) | `contexts/04-asset-library.md` |
| §3.5 | AI 任务调度 (AI Task Orchestration) | `contexts/05-ai-task-orchestration.md` |
| §3.6 | 审核质量 (Review & Quality) | `contexts/06-review-quality.md` |
| §3.7 | 发布交付 (Publish & Delivery) | `contexts/07-publish-delivery.md` |
| §3.8 | 智能助手 (AI Assistant) | `contexts/08-ai-assistant.md` |

---

## 2. 跨文档 DDD 引用规范

### 2.1 引用模板

所有非 DDD 文档在涉及领域概念时，必须按以下模板引用 DDD：

```markdown
> **领域归属**：`contexts/0N-name.md`
> **聚合根**：`AggregateName`
> **关键不变量**：不变量 1 / 不变量 2 / ...
```

跨文档引用规范术语时使用 [统一语言术语表](glossary.md)；引用跨上下文事件时使用 [跨上下文协作契约](contracts.md)；引用上下文边界时使用 [上下文映射](context-map.md)。

### 2.2 引用矩阵

下表规定每份项目文档必须引用的 DDD 文档：

| 文档 | 必须引用的 DDD 文档 |
|---|---|
| `docs/README.md` | [DDD 索引](README.md) + [上下文映射](context-map.md) |
| `docs/product-design-spec.md` | [统一语言术语表](glossary.md) |
| `docs/architecture-and-development.md` | [上下文映射](context-map.md) + [公共领域基础设施](infrastructure.md) + [依赖方向约束](dependency-rules.md) |
| `docs/api.md` | [跨上下文协作契约](contracts.md) + 9 个上下文文件（按 API 分组对应） |
| `docs/sqlite-plan.md` | [依赖方向约束](dependency-rules.md) + 9 个上下文文件（按表归属对应） |
| `docs/asset-library.md` | [资产库 §3.4](contexts/04-asset-library.md) |
| `docs/factories-assets-and-image-views.md` | [资产库 §3.4](contexts/04-asset-library.md) |
| `docs/script-center-guide.md` | [剧本创作 §3.2](contexts/02-script-creation.md) |
| `docs/model-center-guide.md` | [AI 任务调度 §3.5](contexts/05-ai-task-orchestration.md)（含 Dataset / PromptTemplate 聚合） |
| `docs/ai-image-config.md` | [AI 任务调度 §3.5](contexts/05-ai-task-orchestration.md) |
| `docs/requirements-and-acceptance.md` | [模块-上下文映射表](module-map.md) + 9 个上下文文件 |
| `docs/feature-status.md` | [模块-上下文映射表](module-map.md) + [迭代优先级](iteration-priority.md) |
| `docs/risk-management-plan.md` | [上下文映射](context-map.md) + [跨上下文协作契约](contracts.md) |

### 2.3 引用示例

#### 资产库相关文档

```markdown
> **领域归属**：[资产库上下文 §3.4](contexts/04-asset-library.md)
> **聚合根**：`Character` / `Scene` / `Prop`
> **关键不变量**：
> - 名称在同一 `projectId` 内不可重复
> - `published` 状态不可修改，需先 `Unpublish`
> - `usageCount > 0` 时禁止软删除
```

#### API 文档

```markdown
## API 索引

按 [DDD 上下文映射](context-map.md) 分组。

### 项目管控上下文

| 路径 | 动词 | 文档 |
|---|---|---|
| `/api/projects` | GET / POST | [§3.1](contexts/01-project-management.md) |
```

#### 数据库 Schema 文档

```markdown
## 物理表归属

按 [依赖方向约束](dependency-rules.md) 列出物理表所属上下文。

### 资产库上下文

| 物理表 | 聚合根 | 引用 |
|---|---|---|
| `characters` | `Character` | [§3.4](contexts/04-asset-library.md) |
```

---

## 3. 统一语言使用规范

### 3.1 强制规则

- 所有项目文档、UI 文案、API 字段、数据库字段、代码标识符**必须**使用 [统一语言术语表](glossary.md) 中的术语。
- 禁止使用术语表中"禁止别名"列里列出的旧称。
- 引入新术语时，必须先在 `glossary.md` 增补，再在文档中使用。

### 3.2 术语校对清单

每份文档创建或修改时，需要自检：

| 自检项 | 通过条件 |
|---|---|
| 业务概念用词 | 与术语表完全一致，无别名 |
| 状态用词 | 状态名与术语表一致，UI 文案与英文标识对应 |
| 聚合根名称 | PascalCase 英文，与 DDD 聚合定义一致 |
| 上下文名称 | 中文名称（如"项目管控"）与英文标识（如 "Project Management"）配套使用 |
| 事件名称 | 过去时态 PascalCase（如 `ProjectCreated`） |

### 3.3 常见错误纠正

| 错误用法 | 正确用法 | 出处 |
|---|---|---|
| 作品 / 番剧 | 项目 | glossary.md |
| 镜头 / StoryboardItem | 分镜 | glossary.md |
| 人物 / CharacterAsset | 角色 | glossary.md |
| 背景 / SceneAsset | 场景 | glossary.md |
| 物品 / PropAsset | 道具 | glossary.md |
| 素材 / 资源 | 资产 | glossary.md |
| 任务流 / 工作流 | 流水线 | glossary.md |
| 步骤 / Task | 流水线节点 | glossary.md |
| 审批 / Approval | 审核 | glossary.md |
| 最终视频 / 成品 | 成片 | glossary.md |
| 排期 / 发布任务 | 发布计划 | glossary.md |
| 聊天 / Chat | 对话会话 | glossary.md |
| 待办 / Todo | 工作项 | glossary.md |
| 写路径适配 | 旧写路径迁移 | 本文件 §9 |

---

## 4. 上下文归属判定

新增或修改文档时，按以下流程判定其 DDD 归属：

```
文档主题
  │
  ├── 是跨多个上下文的横向主题？ ──是─→ 归属"项目级文档"（README / 架构 / 风险）
  │                                      引用 context-map.md + contracts.md
  │
  └── 否 ─→ 单一上下文主题
            │
            ├── 项目管理 → §3.1 (contexts/01-project-management.md)
            ├── 剧本 → §3.2 (contexts/02-script-creation.md)
            ├── 分镜 → §3.3 (contexts/03-storyboard-direction.md)
            ├── 角色/场景/道具/资产 → §3.4 (contexts/04-asset-library.md)
            ├── Pipeline/AI 任务/数据集/Prompt 模板 → §3.5 (contexts/05-ai-task-orchestration.md)
            ├── 审核/质检 → §3.6 (contexts/06-review-quality.md)
            ├── 成片/发布 → §3.7 (contexts/07-publish-delivery.md)
            └── AI 助手 → §3.8 (contexts/08-ai-assistant.md)
```

文档头部应注明：

```markdown
> **所属上下文**：`contexts/0N-name.md`
> **聚合根**：`AggregateName`（如适用）
```

---

## 5. DDD 文档变更管理

### 5.1 变更原则

- DDD 文档是平台领域边界、聚合定义、事件契约和统一语言的**权威来源**。
- 任何代码、UI、API、数据库 schema 变更前，必须先检查是否影响 DDD 定义。
- 如果影响 DDD 定义（新增上下文、修改聚合、新增事件、新增术语），必须**先改 DDD 文档，再改代码**。

### 5.2 变更范围分级

| 级别 | 范围 | 处理 |
|---|---|---|
| 重大 | 新增/拆分/合并上下文 | 全员评审，影响所有下游文档 |
| 中等 | 修改聚合属性、命令前置状态、事件 Payload、术语 | DDD 维护者评审，下游文档同步更新 |
| 轻微 | 修正错别字、补充示例、调整章节结构 | 直接修改，记录在文档头部 |

### 5.3 跨文档联动检查

DDD 文档变更后，必须检查以下下游文档：

```
DDD 变更
  │
  ├── 新增/修改术语 (glossary.md) ──→ product-design-spec.md / api.md / asset-library.md / script-center-guide.md
  ├── 新增/修改事件 (contracts.md / 各 contexts/ 文件) ──→ architecture-and-development.md / api.md
  ├── 新增/修改聚合 (contexts/ 文件) ──→ architecture-and-development.md / sqlite-plan.md / module-map.md
  └── 新增/修改上下文 ──→ README.md（索引）/ iteration-priority.md
```

---

## 6. DDD 与其它文档体系的关系

### 6.1 文档分层

```
┌─────────────────────────────────────────────────────────────┐
│ 第 1 层：产品愿景 / 用户价值（product-design-spec.md）        │
│           ↓ 回答"为什么做、给谁做"                            │
├─────────────────────────────────────────────────────────────┤
│ 第 2 层：领域边界 / 业务规则（ddd/ 目录）                      │
│           ↓ 回答"做什么、约束是什么"                          │
├─────────────────────────────────────────────────────────────┤
│ 第 3 层：技术架构 / 模块结构（architecture-and-development.md）│
│           ↓ 回答"怎么做、用什么技术"                          │
├─────────────────────────────────────────────────────────────┤
│ 第 4 层：API 契约 / 数据库 Schema（api.md / sqlite-plan.md）  │
│           ↓ 回答"接口长什么样、数据怎么存"                    │
├─────────────────────────────────────────────────────────────┤
│ 第 5 层：模块指南 / 验收标准（script-center-guide.md 等）     │
│           ↓ 回答"具体怎么开发、怎么验收"                      │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 信息流向

- **自顶向下**：产品愿景 → 领域边界 → 技术架构 → API/Schema → 模块指南。
- **自底向上**：模块变更 → 触发 DDD 重新审视 → 必要时更新上层文档。
- **DDD 是核心枢纽**：第 2 层，所有上下层变更必须以 DDD 是否需要更新作为判断点。

---

## 7. 治理行动项

| ID | 行动 | 优先级 | 状态 |
|---|---|---|---|
| DDD-GOV-01 | 建立 DDD 治理规范（本文件） | P0 | 完成 |
| DDD-GOV-02 | 拆分 DDD 文档为 contexts/ 子目录 + 公共规范文件 | P0 | 完成 |
| DDD-GOV-03 | 全量项目文档头部增加"所属上下文"标注 | P1 | 待自动核验 |
| DDD-GOV-04 | 全量项目文档按 DDD 引用矩阵补强引用 | P1 | 待自动核验 |
| DDD-GOV-05 | 校对全量文档统一语言使用 | P2 | 待自动核验 |
| DDD-GOV-06 | 建立 DDD 变更→下游文档联动检查清单 | P2 | 完成 |
| DDD-GOV-07 | 建立需求—领域—API—Schema—测试追踪矩阵 | P0 | 已建表，待实现证据 |

---

## 8. 治理效果验证

### 8.1 验证指标

| 指标 | 目标 | 验证方式 |
|---|---|---|
| 文档头部"所属上下文"标注率 | 100% | 逐文件检查 |
| DDD 引用链接有效率 | 100% | 链接检查脚本 |
| 统一语言别名出现次数 | 0 | 关键字搜索 |
| 上下文归属正确率 | 100% | 人工评审 |
| 文档状态描述是否仅描述终态 | 100% | 文本审计 |

### 8.2 验收清单

- [ ] 所有项目文档头部含"所属上下文"或"领域归属"标注（待脚本核验）。
- [ ] 所有项目文档链接有效（待脚本核验）。
- [ ] 所有项目文档未使用术语表"禁止别名"（待脚本核验）。
- [x] `feature-status.md` 已重建，并以“未核验”为默认状态，禁止虚报完成。
- [x] `api.md` / `sqlite-plan.md` 按上下文分组，与 DDD 章节对应。
- [x] `docs/ddd/` 目录按 contexts/ 子目录 + 公共规范文件组织，概述文档 `domain-requirements-spec.md` 仅作为入口。

---

## 9. 迭代开发流程标准格式

> 本节定义每个迭代的标准阶段格式与术语，是 Gate 0 流程描述的**权威来源**。所有项目文档在描述迭代流程时必须使用本节定义的术语，禁止使用"写路径适配"等旧称（见 §3.3 常见错误纠正）。

### 9.1 标准迭代阶段

每个迭代按以下标准格式推进：

```
Gate 0 契约冻结 → 纯领域实现 → 持久化与并发 → 旧写路径迁移 → 跨聚合集成 → 架构门禁
```

| 阶段 | 说明 |
|------|------|
| Gate 0 契约冻结 | 冻结聚合定义、命令、事件、状态机契约，后续阶段不得破坏兼容性 |
| 纯领域实现 | 基于冻结契约实现聚合根、领域服务、不变量，不依赖持久化框架 |
| 持久化与并发 | 接入数据库、仓储、乐观锁、幂等键，保证并发安全 |
| 旧写路径迁移 | 将原有直接写库的旧代码路径迁移至聚合命令入口，旧路径逐步下线 |
| 跨聚合集成 | 通过领域事件、CQRS 读模型投影、防腐层完成跨上下文协作 |
| 架构门禁 | 依赖方向校验、分层规约校验、统一语言校验，不通过则阻断发布 |

### 9.2 术语统一要求

- **"旧写路径迁移"** 是描述"将旧写代码路径迁移至聚合命令入口"阶段的标准术语，禁止使用"写路径适配"等别名。
- 迭代优先级与节奏详见 [迭代优先级](iteration-priority.md)，该文件须与本节术语保持一致。
