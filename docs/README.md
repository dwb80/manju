# 文档索引

> **更新时间**: 2026-07-18
> **说明**: 本文档说明 `docs` 目录下每个文档的用途和推荐阅读顺序。

---

## 阅读顺序建议

### 第一次接触项目

按以下顺序阅读，快速了解项目全貌：

1. **[product-design-spec.md](product-design-spec.md)** —— 产品顶层设计（愿景、角色、流程、数据模型、AI体系、信息架构、NFR）
2. **[functional-specification.md](functional-specification.md)** —— 当前版本可验证的功能、状态、边界、异常与验收基线
3. **[feature-status.md](feature-status.md)** —— 当前真实能力、产品边界和对外承诺口径
4. **[requirements-and-acceptance.md](requirements-and-acceptance.md)** —— 功能需求、验收标准、API规范、数据字典
5. **[architecture-and-development.md](architecture-and-development.md)** —— 技术架构、项目结构、存储方案、开发指南
6. **[module-relationships.md](module-relationships.md)** —— 模块间关系（剧本↔分镜↔资产↔模型）

### 按角色阅读

**产品经理 / 项目经理**：
- `product-design-spec.md`（了解产品全貌）
- `requirements-and-acceptance.md`（了解功能需求和验收标准）

**开发人员**：
- `architecture-and-development.md`（了解技术架构和项目结构）
- `module-relationships.md`（了解模块间依赖关系）
- `requirements-and-acceptance.md`（了解API规范）

**测试人员**：
- `requirements-and-acceptance.md`（了解验收标准和测试要点）

**运维人员**：
- `architecture-and-development.md`（了解存储方案和部署）
- `product-design-spec.md`（了解NFR中的监控运维需求）

---

## 文档清单

### 核心文档（合并后）

| 文档 | 说明 | 来源 |
|------|------|------|
| **[product-design-spec.md](product-design-spec.md)** | 产品设计规格总纲。包含产品愿景、用户角色、业务流程、数据模型、AI模型体系、信息架构、非功能性需求。 | 合并 7 个文档 |
| **[requirements-and-acceptance.md](requirements-and-acceptance.md)** | 需求规格与验收标准。包含功能需求（按业务阶段）、验收标准、前端验收标准、API接口规范摘要、数据字典摘要。 | 合并 5 个文档 |
| **[architecture-and-development.md](architecture-and-development.md)** | 架构设计与开发指南。包含MVP架构、技术栈、项目结构、存储方案、开发排错指南。 | 合并 4 个文档 |
| **[module-relationships.md](module-relationships.md)** | 模块关系说明。包含剧本与分镜、剧本与资产、剧本与模型中心的关系，以及生产-筛选-入库-使用流程。 | 合并 3 个文档 |

### 诊断与评审文档

| 文档 | 说明 |
|------|------|
| **[platform-diagnosis-and-competitive-prd.md](platform-diagnosis-and-competitive-prd.md)** | 2026-07-18 平台功能盘点、文档差异、合理性分析、整改建议与竞争性产品 PRD。 |
| **[code-review-report-2026-07-18.md](code-review-report-2026-07-18.md)** | 2026-07-18 代码评审、风险分级、工程整改与 90 天计划。 |
| **[feature-status.md](feature-status.md)** | 2026-07-18 当前能力分级、明确边界、对外表达红线和版本准入。 |
| **[functional-specification.md](functional-specification.md)** | 2026-07-18 功能验证唯一基线，定义模块行为、异常、边界和验收条件。 |
| **[requirements-traceability-matrix.md](requirements-traceability-matrix.md)** | 72 个功能编号到页面、API、数据和测试证据的追踪矩阵。 |
| **[defect-register.md](defect-register.md)** | 功能验证中发现的缺陷、级别、证据、影响和闭环状态。 |
| **[static-audit-report.md](static-audit-report.md)** | 静态质量、供应链、敏感信息和安全边界审计结论。 |
| **[verification-and-remediation-report-2026-07-18.md](verification-and-remediation-report-2026-07-18.md)** | 七阶段验证结果、整改证据、残余风险与发布建议。 |

### 独立保留文档

| 文档 | 说明 | 保留原因 |
|------|------|----------|
| **[script-center-guide.md](script-center-guide.md)** | 剧本中心完整指南（需求规格+技术设计+数据库设计+UI设计）。 | 内容最完整，5076行，作为剧本中心的主要参考文档 |
| **[api.md](api.md)** | 实际 API 接口说明（与 api-specification 不同，这是实际实现的）。 | 记录实际代码中的API实现 |
| **[model-center-guide.md](model-center-guide.md)** | 模型中心独立指南。 | 模型中心模块独立参考 |
| **[asset-library.md](asset-library.md)** | 资产库独立设计。 | 资产中心模块独立参考 |
| **[sqlite-plan.md](sqlite-plan.md)** | 数据库方案独立文档。 | SQLite 存储方案详细设计 |
| **[risk-management-plan.md](risk-management-plan.md)** | 持续更新的风险管理。 | 项目风险持续跟踪 |
| **[priority-classification.md](priority-classification.md)** | 需求优先级分类。 | 需求管理参考 |
| **[remaining-modules-evaluation.md](remaining-modules-evaluation.md)** | 待实现模块评估。 | 后续开发规划参考 |

### 归档文档（已移入 archive/）

以下文档已移入 `archive/` 目录，内容已过时或属于临时工作产物：

| 文档 | 归档原因 |
|------|----------|
| `system-architecture-refactor-plan.md` | 改造计划已完成 |
| `api-integration-and-test-data-plan.md` | API 已对接完成 |
| `creative-center-evaluation.md` | 评估报告已过时 |
| `project-center-evaluation.md` | 评估报告已过时 |
| `asset-center-evaluation.md` | 评估报告已过时 |
| `ai-production-center-evaluation.md` | 评估报告已过时 |
| `frontend-consistency-report.md` | 一致性修复已完成 |
| `dashboard-implementation-report.md` | Dashboard 已实现 |
| `final-integration-report.md` | 集成已完成 |
| `sync-report.md` | 同步已完成 |
| `script-center-development-checklist.md` | 内容已整合到 script-center-guide.md |
| `script-center-scope.md` | 内容已整合到 script-center-guide.md |
| `script-center-supplement-designs.md` | 内容已整合到 script-center-guide.md |
| `SYSTEM_INTEGRATION_FINAL_COMPLETE_REPORT.md` | 集成已完成 |

---

## 文档维护

### 更新规则

1. **核心文档**（合并后的 4 个文档）需要保持最新，代码变更时同步更新
2. **独立保留文档**各自维护，由对应模块负责人更新
3. **归档文档**不再更新，仅作为历史参考

### 合并记录

- **2026-07-13**: 将 42 个文档整理为 14 个有效文档 + 14 个归档文档
  - 合并 7 个核心设计文档 → `product-design-spec.md`
  - 合并 5 个需求验收文档 → `requirements-and-acceptance.md`
  - 合并 4 个架构开发文档 → `architecture-and-development.md`
  - 合并 3 个模块关系文档 → `module-relationships.md`
  - 保留 `script-center-guide.md` 作为剧本中心主文档
  - 移入 archive 14 个过时/临时文档
