# 需求完整性与可验收性评审（2026-07-29）

> **评审对象**：`docs/requirements/`、`docs/delivery-specs/`、`docs/domain/` 与目标 OpenAPI/测试矩阵的追溯关系  
> **评审目标**：判断需求是否范围完整、语义一致、可实现、可验证，并能否作为全面开发准入依据  
> **结论**：**Conditional Go（附条件通过）**。可继续 DDD/接口细化并启动边界稳定模块；在关闭下列 P0 项前，不得宣称“全部需求均已开发就绪”。

## 1. 执行摘要

当前需求基线已经具备正式产品级骨架：产品决策、31 个模块、主生产旅程、RBAC、数据生命周期、质量/成本/发布/规模基线均有明确入口。自动化设计门禁执行结果为：

- 47 个交付功能；
- 189 个目标 OpenAPI operation；
- 94 个具备 Given/When/Then 的验收场景；
- `node scripts/check-implementation-readiness.mjs`：**PASS**。

这证明核心交付规格具备较高可验收性，但不等于需求全集已完全闭环。本轮发现 **3 个 P0、3 个 P1**。主要风险不是主流程缺失，而是新增/专项需求尚未完全进入“需求 ID → 页面行为 → API/Schema → 场景 → 测试矩阵”的可执行追溯链。

## 2. 评审口径

每项需求按以下门禁检查：

1. 有稳定 ID、目标角色和业务结果；
2. 正常、异常、权限、并发和恢复行为明确；
3. 验收结果可观察、可量化，不依赖“体验良好”等主观措辞；
4. 能追溯到领域命令/事件、不变量；
5. 能追溯到页面状态、API、逻辑模型和 Given/When/Then 场景；
6. 与范围决策、其他专项指南和目标 OpenAPI 不冲突；
7. 设计完成与代码已实现严格分开。

## 3. 已满足项

| 维度 | 证据 | 结论 |
|---|---|---|
| 产品范围 | `01-product-scope-baseline.md` 的 PD-001～PD-007 | 主制品、画幅、认证、审核策略、交换包、数据回流和优先级均有冻结答案 |
| 模块覆盖 | `modules/01-module-catalog.md` | 31 个产品模块均映射到领域/交付规格入口 |
| 核心交付规格 | `delivery-specs/02`～`09` | 47 个功能具备页面、API、逻辑模型与验收场景框架 |
| 可执行验收 | `test-matrix.json` | 94 个场景均含 Given/When/Then，功能 ID 与 OpenAPI operation 可解析 |
| 接口基线 | `openapi.json` | 189 个 `/api/v1/` operation，通过统一错误响应、请求体和引用检查 |
| 横切能力 | RBAC、生命周期、DEP、质量、商业规模和 SOP 文档 | 权限、迁移、追溯、质量和运行边界已有正式基线 |

## 4. 问题清单

### RQ-P0-001：QC→Review 准入门尚未进入交付契约和测试矩阵

- **证据**：领域基线现已规定送审先生成 `QCReport`，通过或合法豁免后才创建 `Review`；但目标 OpenAPI 中 `/shots/{id}/review-submissions` 仍直接返回 `reviewId`，`/final-videos/{id}/review-submissions` 仍直接返回 first Review。
- **缺失**：`qc_running / qc_blocked / review_pending` 响应语义、异步查询或回调、`GrantQCGateWaiver` 权限/审计接口、mandatory 不可豁免错误、failed/timed_out 重试耗尽场景。
- **影响**：前后端可能继续实现“提交即创建 Review”，与 H-003 的权威领域顺序冲突。
- **关闭条件**：更新相关交付规格、OpenAPI、逻辑模型和测试矩阵；至少增加 QC 通过、block 阻断、warn 合法豁免、mandatory 禁止豁免、超时耗尽五类场景。

### RQ-P0-002：19 项专业工作台需求未逐项进入四联件

- **证据**：`14-professional-production-workstations.md` 定义 OPS 3 项、SHOT 2 项、CAND 3 项、CONT 2 项、REV 3 项、EDIT 3 项、COLLAB 3 项，共 19 项；当前测试矩阵的 source 仅指向九本 delivery spec，没有以这些专项 ID 建立直接追溯。
- **影响**：这些验收条件虽清晰，但无法证明每项都有对应页面/API/Schema/自动化场景，尤其生产矩阵、关键路径预测、批量候选、连续性台和专业审片台。
- **关闭条件**：为 19 项逐项建立交付规格映射；可复用现有 operation/scenario，但必须在 test matrix 中声明 `requirementIds` 或等价关系并补齐缺口。

### RQ-P0-003：产品基线状态声明自相矛盾

- **证据**：`product/README.md` 仍写“产品基线 v0.1，待产品负责人逐项确认决策清单”，而 `01-product-scope-baseline.md` 中 PD-001～PD-007 全部标为“已冻结”。
- **影响**：团队无法判断冻结答案是否已经获得产品授权，可能把尚未批准的设计误当承诺，或重复讨论已冻结事项。
- **关闭条件**：由产品负责人确认一种状态：若已批准，更新 README 的版本、批准人/日期；若未批准，把 PD 状态恢复为待确认并暂停依赖这些决策的发布承诺。

### RQ-P1-001：Timeline 新实体尚未下沉到交付 Schema

- **证据**：领域文档已明确 Track、VideoClip、AudioClip、TimelineSubtitleCue、Transition、EffectInstance、Timebase 和不变量；交付规格仍用 `{tracks,clips,transitions,durationMs}` 与 `properties_json` 泛化表示，目标 OpenAPI 未检出对应结构化 Schema。
- **影响**：客户端、服务端和渲染器可能分别解释时间、效果版本、转场和来源哈希。
- **关闭条件**：建立关闭额外字段的 JSON Schema/OpenAPI components，并增加重叠、帧边界、转场、音频淡化、字幕版本和 effect 版本缺失场景。

### RQ-P1-002：剧本专项指南保留旧审核与旧 API 口径

- **证据**：`modules/02-script-center-guide.md` 仍描述可配置多级审核模板和 `/api/approval-workflows`、`/api/scripts/:scriptId/approval`；产品 PD-004 明确首发不提供任意会签编排，统一接口基线要求 `/api/v1/`。
- **影响**：专项指南被模块目录列为剧本中心入口，开发者可能误建第二套审核模型与非 v1 API。
- **关闭条件**：明确剧本审核是否属于固定单级策略；删除/归档旧模板设计或标记为非当前范围，并将有效接口指向统一 Review 契约。

### RQ-P1-003：专项基线的验收条款尚未全部拥有稳定场景 ID

- **证据**：质量、音频后期、商业规模和 SOP 文档包含大量规范性条款，但测试矩阵只以 47 个 delivery feature 为入口；部分条款只能间接推断覆盖关系。
- **影响**：发布门禁难以证明权利、恢复、容量、质量统计等非主路径要求被测试。
- **关闭条件**：对 P0/P1 规范性条款建立 requirement ID，并映射到测试层（E2E、contract、integration、migration、performance、security 或 operation drill）。

## 5. 准入判定

| 范围 | 判定 | 条件 |
|---|---|---|
| 继续 DDD 设计与接口细化 | Go | 当前材料足够，且四项已知 DDD 缺口已完成文档修复 |
| 项目管控、基础资产等边界稳定模块 | Conditional Go | 按现有交付规格实现并维持 feature evidence 为 unverified，直到测试通过 |
| 审核质量/送审链 | No-Go | 先关闭 RQ-P0-001 |
| 专业生产工作台整体交付承诺 | No-Go | 先关闭 RQ-P0-002 |
| 对外声明“全部需求已确认并开发就绪” | No-Go | 至少关闭全部 P0，并由产品负责人签署冻结状态 |

## 6. 建议关闭顺序

1. 产品负责人确认并签署 PD-001～PD-007，消除基线状态冲突。
2. 把 QC→Review Intake 同步到交付规格、OpenAPI 和测试矩阵。
3. 为 19 项专业工作台需求建立直接追溯并补齐缺失四联件。
4. 下沉 Timeline 结构化 Schema 和边界场景。
5. 收敛剧本专项指南的旧审核/API 设计。
6. 为质量、迁移、容量、安全和运营条款补 requirement ID 与非功能测试映射。

完成 P0 后重新执行本评审与 `check-implementation-readiness.mjs`；只有 P0 为 0 且门禁继续通过，才可升级为完整需求 `Go`。
