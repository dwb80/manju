# 产品级需求基线

> **建立日期**：2026-07-28  
> **适用目标**：正式可交付产品，不采用“先按 MVP 降格、以后再补齐”的验收口径。  
> **当前状态**：产品基线 v1.0，PD-001～PD-007 已于 2026-07-28 冻结；2026-07-29 本轮整改再次确认其为 DDD 与交付设计输入。后续变更必须走决策变更规则，不再以“待确认”表述。

本目录回答“产品为什么存在、服务谁、必须完整到什么程度”。领域聚合与状态机仍以 `docs/domain/` 为权威来源，当前实现状态仍以 `docs/implementation/02-feature-status.md` 及代码/API/测试证据为准。

## 文档顺序

1. [产品范围与决策基线](01-product-scope-baseline.md)
2. [产品级需求审计](02-product-requirements-audit.md)
3. [漫剧专业生产需求](03-comic-production-requirements.md)
4. [平台基础能力需求](04-platform-capability-requirements.md)
5. [核心用户旅程](05-user-journeys.md)
6. [命令级权限矩阵](06-rbac-command-matrix.md)
7. [数据生命周期与迁移方案](07-data-lifecycle-and-migration.md)
8. [产品交付路线图与门禁](08-delivery-roadmap.md)
9. [DEP 变更影响与全链路追溯需求](09-change-impact-and-traceability.md)
10. [漫剧内容策划与生产 SOP 基线](10-content-planning-and-production-sop.md)
11. [漫剧质量标准与金标准样本基线](11-quality-and-golden-sample-baseline.md)
12. [音频、后期与渠道交付基线](12-audio-postproduction-and-delivery-baseline.md)
13. [商业模式、客户画像与规模假设基线](13-commercial-customer-and-scale-baseline.md)
14. [专业漫剧生产工作台需求](14-professional-production-workstations.md)
15. [需求完整性与可验收性评审（2026-07-29）](15-requirements-completeness-and-acceptance-review-2026-07-29.md)
16. [UI 覆盖度及需求—页面—状态追溯评审（2026-07-29）](16-ui-requirement-page-state-trace-review-2026-07-29.md)
17. [非功能与运行门禁需求目录](17-nonfunctional-requirement-catalog.md)
18. [UI 设计权威与版本基线](18-ui-design-authority.md)
19. [逐功能交付规格](../../delivery-specs/README.md)

阶段性产品 Review 已归档至 [历史 Review](../../archive/reviews/2026-07-28/README.md)。

## 权威关系

| 决策类型 | 权威来源 | 说明 |
|---|---|---|
| 产品定位、目标用户、范围和非目标 | 本目录 | 未确认的战略选择必须标为“待确认”，不得暗中进入实现 |
| 用户故事、验收条件、业务规则 | `02-requirements-and-acceptance.md` | 本目录发现的缺口确认后必须回写该文档 |
| 聚合、命令、状态机、不变量和事件 | `docs/domain/` | 产品需求确认后再变更领域契约 |
| 当前可用能力 | `docs/implementation/02-feature-status.md` | 页面存在或代码片段存在不能代替验收证据 |
| 当前 API | OpenAPI；门禁建立前为路由与契约测试 | 设计接口不得冒充已实现接口 |

## 产品级变更规则

- 新能力必须关联目标用户、业务结果、用户旅程和可测试验收条件。
- “正式产品”不等于默认加入多租户、移动端、知识库等通用能力；没有商业和用户证据的扩展项进入决策清单，不提前制造领域上下文。
- 任何影响主生产链路、数据兼容、权限、成本、质量或恢复能力的缺口，不得仅以“后续版本”关闭。
- 需求确认顺序为：产品决策 → 用户故事与验收 → 领域契约 → API/Schema → 实现与迁移 → 自动化验收 → 发布承诺。
