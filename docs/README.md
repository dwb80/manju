# 文档索引

> 本文档说明 `docs` 目录下每个文档的用途和推荐阅读顺序。
>
> **领域归属**：[DDD 索引](ddd/README.md) + [上下文映射](ddd/context-map.md)
> **DDD 治理**：所有项目文档的领域归属、跨上下文引用、术语使用按 [DDD 治理规范](ddd/governance.md) 执行。

---

## 阅读顺序建议

### 第一次接触项目

按以下顺序阅读，快速了解项目全貌：

1. **[product/README.md](product/README.md)** —— 正式产品基线（范围决策、需求审计、漫剧专业需求、用户旅程、权限矩阵、交付门禁）
2. **[product-design-spec.md](product-design-spec.md)** —— 产品顶层设计（愿景、角色、流程、数据模型、AI体系、信息架构、NFR、优先级分级体系）
3. **[ddd/README.md](ddd/README.md)** —— DDD 文档索引（[context-map.md](ddd/context-map.md) + [glossary.md](ddd/glossary.md) + [module-map.md](ddd/module-map.md)）
4. **[feature-status.md](feature-status.md)** —— 当前真实能力、产品边界和对外承诺口径
5. **[requirements-and-acceptance.md](requirements-and-acceptance.md)** —— 功能需求、验收标准、API规范、数据字典
6. **[architecture-and-development.md](architecture-and-development.md)** —— 技术架构、项目结构、存储方案、开发指南
7. **[development-standards.md](development-standards.md)** —— Definition of Done、事件可靠性、迁移、测试和交付门禁

### 按角色阅读

**产品经理 / 项目经理**：
- `product-design-spec.md`（产品全貌 + 优先级体系）
- `ddd/glossary.md`（统一语言）+ `ddd/module-map.md`（模块-上下文映射）+ `ddd/iteration-priority.md`（迭代节奏）
- `requirements-and-acceptance.md`（功能需求和验收标准）

**开发人员**：
- `ddd/context-map.md`（上下文边界）+ `ddd/glossary.md`（统一语言）+ 你负责的 `ddd/contexts/0N-*.md`（聚合、事件、状态机）
- `architecture-and-development.md`（技术架构 + 存储方案）
- `requirements-and-acceptance.md`（API规范）
- `api.md`（实际接口说明）
- 各模块指南（见下方清单）

**测试人员**：
- `requirements-and-acceptance.md`（验收标准和测试要点）
- `feature-status.md`（功能实现状态）

**运维人员**：
- `architecture-and-development.md`（存储方案和部署）
- `security/`（合规清单、事件响应、SBOM）
- `release/`（发布验收、回滚方案）

---

## 文档清单

### 产品级需求基线

| 文档 | 说明 |
|------|------|
| **[product/README.md](product/README.md)** | 正式产品评审入口及权威关系。 |
| **[product/product-scope-baseline.md](product/product-scope-baseline.md)** | 产品定位、非目标、完整度标准、成功指标和待确认决策。 |
| **[product/product-requirements-audit.md](product/product-requirements-audit.md)** | 区分真实缺失、局部存在、冲突、待核验和战略候选。 |
| **[product/comic-production-requirements.md](product/comic-production-requirements.md)** | 构图、画面层、气泡、拟声词、漫画特效、有限动态和一致性需求。 |
| **[product/platform-capability-requirements.md](product/platform-capability-requirements.md)** | 用户认证、通知、回收站、配置、审计、导入导出和备份恢复的正式验收附件。 |
| **[product/data-lifecycle-and-migration.md](product/data-lifecycle-and-migration.md)** | 数据保留、项目包、备份恢复、Audio/Clip/角色/错误协议迁移与回滚。 |
| **[product/user-journeys.md](product/user-journeys.md)** | 从立项到发布、返工、迁移和恢复的跨岗位旅程。 |
| **[product/rbac-command-matrix.md](product/rbac-command-matrix.md)** | 系统角色与项目角色分层的命令级授权基线。 |
| **[product/delivery-roadmap.md](product/delivery-roadmap.md)** | 正式产品 Gate 0～4、整改队列和完成证据。 |

### 领域设计

DDD 文档已按职责拆分为索引 + 治理规范 + 基础规范 + 10 个上下文规格文件。所有跨文档引用、术语使用、上下文归属按 [DDD 治理规范](ddd/governance.md) 执行。

| 文档 | 说明 |
|------|------|
| **[ddd/README.md](ddd/README.md)** | DDD 文档索引与读者指引。 |
| **[ddd/governance.md](ddd/governance.md)** | DDD 治理规范。文档结构、跨文档引用矩阵、统一语言使用规则、变更管理流程。 |
| **[ddd/domain-requirements-spec.md](ddd/domain-requirements-spec.md)** | DDD 领域需求规格概述（文档体系入口）。具体内容见基础规范 + 9 份上下文规格。 |
| **[ddd/glossary.md](ddd/glossary.md)** | 统一语言术语表（业务概念 + 状态术语 + 禁止别名）。 |
| **[ddd/context-map.md](ddd/context-map.md)** | 限界上下文映射。10 个上下文关系图、关系矩阵、共享内核。 |
| **[ddd/contracts.md](ddd/contracts.md)** | 跨上下文协作契约。事件链路、消费者注册表、防腐层、CQRS 投影。 |
| **[ddd/module-map.md](ddd/module-map.md)** | 模块-上下文映射表。页面到上下文和聚合根的对应关系。 |
| **[ddd/iteration-priority.md](ddd/iteration-priority.md)** | 聚合实现优先级与建议迭代节奏。 |
| **[ddd/infrastructure.md](ddd/infrastructure.md)** | 公共领域基础设施。共享内核接口定义、公共错误码。 |
| **[ddd/error-contract.md](ddd/error-contract.md)** | 统一字符串错误码、HTTP、响应 envelope、前端处理与数字旧码迁移。 |
| **[ddd/dependency-rules.md](ddd/dependency-rules.md)** | 依赖方向约束。分层依赖图、跨聚合引用规则。 |
| **[ddd/traceability-matrix.md](ddd/traceability-matrix.md)** | 用户故事到聚合、命令、事件、API、Schema 和验收证据的追踪矩阵。 |
| **[ddd/remediation-report-2026-07-28.md](ddd/remediation-report-2026-07-28.md)** | 本轮 DDD 文档整改结果与剩余代码核验项。 |
| **[ddd/contexts/0N-*.md](ddd/contexts/)** | 10 个限界上下文的完整规格（聚合、命令、状态机、不变量、事件、读模型）。 |

**核心 DDD 子文件**（按编号）：
- §3.1 [项目管控](ddd/contexts/01-project-management.md)｜§3.2 [剧本创作](ddd/contexts/02-script-creation.md)｜§3.3 [分镜导演](ddd/contexts/03-storyboard-direction.md)｜§3.4 [资产库](ddd/contexts/04-asset-library.md)｜§3.5 [AI 任务调度](ddd/contexts/05-ai-task-orchestration.md)｜§3.6 [审核质量](ddd/contexts/06-review-quality.md)｜§3.7 [发布交付](ddd/contexts/07-publish-delivery.md)｜§3.8 [智能助手](ddd/contexts/08-ai-assistant.md)｜§3.9 [后期制作](ddd/contexts/09-post-production.md)｜§3.10 [通知](ddd/contexts/10-notification.md)

### 核心文档

| 文档 | 说明 | DDD 归属 |
|------|------|---------|
| **[product-design-spec.md](product-design-spec.md)** | 产品设计规格总纲。产品愿景、用户角色、业务流程、数据模型、AI模型体系、信息架构、NFR、功能优先级分级体系（P0/P1/P2定义+评分公式+调整原则）。 | 项目级（[§1 上下文映射](ddd/context-map.md)） |
| **[requirements-and-acceptance.md](requirements-and-acceptance.md)** | 需求规格与验收标准。功能需求、验收标准、API接口规范摘要、数据字典摘要。 | [模块-上下文映射表](ddd/module-map.md) + 10 个上下文 |
| **[architecture-and-development.md](architecture-and-development.md)** | 架构设计与开发指南。当前交付架构、技术栈、项目结构、存储方案、开发排错指南。 | [上下文映射](ddd/context-map.md) + [公共领域基础设施](ddd/infrastructure.md) + [依赖方向约束](ddd/dependency-rules.md) |

### 状态与风险管理

| 文档 | 说明 | DDD 归属 |
|------|------|---------|
| **[feature-status.md](feature-status.md)** | 功能状态基线。可发布能力、已知边界、工厂模块校准。 | [模块-上下文映射表](ddd/module-map.md) + [迭代优先级](ddd/iteration-priority.md) |
| **[risk-management-plan.md](risk-management-plan.md)** | 风险预案。技术/业务/数据/合规/成本/性能风险矩阵。 | [上下文映射](ddd/context-map.md) + [跨上下文协作契约](ddd/contracts.md) |

### 模块开发指南

| 文档 | 说明 | DDD 归属 |
|------|------|---------|
| **[script-center-guide.md](script-center-guide.md)** | 剧本中心完整指南（需求+技术设计+数据库+UI）。 | §3.2 [剧本创作上下文](ddd/contexts/02-script-creation.md) |
| **[model-center-guide.md](model-center-guide.md)** | 模型中心独立指南。 | §3.5 [AI 任务调度](ddd/contexts/05-ai-task-orchestration.md)（含 Dataset / PromptTemplate） |
| **[factories-assets-and-image-views.md](factories-assets-and-image-views.md)** | 三工厂（角色/场景/道具）资产图片多视图契约基线。 | §3.4 [资产库上下文](ddd/contexts/04-asset-library.md) |
| **[ai-image-config.md](ai-image-config.md)** | AI 图片生成参数单一真相源。 | §3.5 [AI 任务调度](ddd/contexts/05-ai-task-orchestration.md) |
| **[asset-library.md](asset-library.md)** | 资产库使用说明。 | §3.4 [资产库上下文](ddd/contexts/04-asset-library.md) |

### 技术参考

| 文档 | 说明 | DDD 归属 |
|------|------|---------|
| **[api.md](api.md)** | 实际 API 接口说明。 | [跨上下文协作契约](ddd/contracts.md) + 10 个上下文 |
| **[sqlite-plan.md](sqlite-plan.md)** | SQLite 存储方案。 | [依赖方向约束](ddd/dependency-rules.md) + 10 个上下文 |

### 安全与发布

| 文档 | 说明 |
|------|------|
| **[security/compliance-checklist.md](security/compliance-checklist.md)** | 合规清单（等保2.0 / SOC 2 / GDPR）。 |
| **[security/incident-response.md](security/incident-response.md)** | 安全事件响应预案。 |
| **[security/sbom.md](security/sbom.md)** | 软件物料清单（SBOM）说明。 |
| **[release/v2-rollback.md](release/v2-rollback.md)** | 升级与回滚方案。 |

### 根目录文档

| 文档 | 说明 |
|------|------|
| **[DESIGN.md](../DESIGN.md)** | UI 设计系统（设计方向、产品人格、颜色、排版、组件规范）。 |
| **[CHANGELOG.md](../CHANGELOG.md)** | 变更日志。 |

---

## 文档维护

### 更新规则

1. **领域设计**（DDD 规格文档）是聚合、事件、状态机的权威来源，代码变更时同步更新。DDD 文档已按职责拆分到 `ddd/` 目录下的多个文件，更新时请遵循 [DDD 治理规范](ddd/governance.md) 第 5 节"变更管理"。
2. **核心文档**需要保持最新，代码变更时同步更新
3. **模块指南**各自维护，由对应模块负责人更新
4. 术语以 [DDD 统一语言术语表](ddd/glossary.md) 为准，文档和代码必须严格使用
