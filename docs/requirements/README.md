# 需求文档索引

> 本目录是产品需求的统一入口，回答“为谁解决什么问题、产品必须具备什么行为、如何验收”。
> 领域模型、技术实现和当前完成状态不在本目录重复定义，分别以 `docs/domain/`、`docs/delivery-specs/` 和 `docs/implementation/` 为准。

## 推荐阅读顺序

1. [产品设计规格总纲](01-product-design-spec.md)——产品愿景、角色、主流程、信息架构和非功能要求。
2. [需求与验收标准](02-requirements-and-acceptance.md)——统一用户故事、业务规则和验收基线。
3. [产品级需求基线](product/README.md)——范围、漫剧专业能力、平台能力、用户旅程、权限、数据生命周期和路线图。
4. [完整模块目录](modules/01-module-catalog.md)——31 个产品模块及其权威需求、领域和交付规格入口。

## 权威边界

| 问题 | 权威来源 |
|---|---|
| 产品定位、目标用户、范围和非目标 | [product/](product/README.md) |
| 用户故事、业务规则和验收条件 | [02-requirements-and-acceptance.md](02-requirements-and-acceptance.md)及其明确引用的产品附件 |
| 模块范围和专项需求 | [modules/](modules/README.md) |
| 聚合、状态机、命令、事件和不变量 | [domain/](../domain/README.md) |
| 页面交互、目标 API、逻辑模型和可执行验收场景 | [delivery-specs/](../delivery-specs/README.md) |
| 当前代码完成度和实现证据 | [implementation/02-feature-status.md](../implementation/02-feature-status.md) |

## 变更规则

- 新需求必须具有稳定需求 ID、目标用户、业务结果和可测试验收条件。
- 需求变更必须同步评估领域契约、交付规格、物理模型、迁移和自动化测试。
- 页面或代码已经存在不等于需求已经满足；只有追踪矩阵和实现证据完整后才能更新功能状态。
- 下游文档不得静默降低本目录已冻结的产品要求；冲突必须通过变更评审解决。
