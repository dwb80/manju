# 迭代优先级

> **配套规范**：[DDD 治理规范](governance.md)｜[上下文映射](context-map.md)

按业务阻塞程度排序：

| 优先级 | 聚合 | 所属上下文 | 阻塞原因 | 建议迭代 |
|-------|------|-----------|---------|---------|
| P0 | Project | 项目管控 | 项目是全部业务的入口，无聚合则无法管控项目状态、团队成员和权限 | 迭代1 |
| P0 | Script | 剧本创作 | 剧本是分镜的来源，无聚合则剧本文档、分析和迭代循环无保护 | 迭代1 |
| P0 | Storyboard | 分镜导演 | 分镜板是"创作链路"的关键容器，没有它分镜只能散装存在。"打通链路"必须包含 | 迭代1 |
| P1 | Character | 资产库 | 角色一致性包是生成质量的关键约束 | 迭代1 |
| P1 | Scene | 资产库 | 分镜引用角色+场景+道具，与 Character 同步实现避免分镜只能绑定角色 | 迭代1 |
| P1 | Prop | 资产库 | 与 Character/Scene 同构（状态机/命令/事件一致），代码已实现；分镜引用角色+场景+道具三件套，同步实现避免迭代1分镜只能绑定角色+场景 | 迭代1 |
| P1 | AITask | AI任务调度 | AI 任务需要统一调度、幂等和重试保护 | 迭代2 |
| P1 | Review | 审核质量 | 审核流程是交付链路关键环节，无聚合则审核状态、审核人分配和审核决策无保护 | 迭代2 |
| P1 | QCReport | 审核质量 | 质检报告无聚合，无法防止篡改和保证不可变性 | 迭代2 |
| P2 | FinalVideo | 发布交付 | 成片管理需要打包状态保护 | 迭代2 |
| P2 | PublishPlan | 发布交付 | 发布计划需要状态流转保护 | 迭代2 |
| P2 | ModelConfig | AI任务调度 | 模型配置含能力标签和路由策略，需要聚合支持"自动选模型" | 迭代2 |
| P2 | PromptTemplate | AI任务调度 | Prompt 作为可复用资产，需要聚合支持"资产优先"原则 | 迭代2 |
| P2 | PipelineTemplate | AI任务调度 | 流水线模板需要聚合支持"流水线驱动"原则 | 迭代2 |
| P1 | EditProject | 后期制作 | 多轨剪辑是视频片段到成片的必经环节 | 迭代2 |
| P1 | AudioAsset | 后期制作 | 配音、BGM 和音效是完整漫剧制品的必要组成 | 迭代2 |
| P1 | SubtitleDocument | 后期制作 | 字幕是发布预检和平台交付的必要组成 | 迭代2 |
| P1 | RenderJob | 后期制作 | 渲染输出是 FinalVideo 的唯一合法来源 | 迭代2 |
| P3 | Conversation | 智能助手 | 对话历史需要版本保护 | 迭代3 |
| P3 | WorkItem | 智能助手 | 工作项需要聚合保护 | 迭代3 |
| P3 | Dataset | AI任务调度 | 数据集需要聚合保护 | 迭代3 |
| P4 | CapabilityTemplate | AI任务调度 | AI 能力模板是高级编排能力（串联多模型节点），非首期阻塞 | 迭代4 |

---

## 建议迭代节奏

- **迭代1**：Project + Script + Storyboard + Character + Scene + Prop（P0 + P1 前半）— 打通"项目→剧本→资产→分镜"的完整创作链路
- **迭代2**：AITask + Review + QCReport + EditProject + AudioAsset + SubtitleDocument + RenderJob + FinalVideo + PublishPlan + ModelConfig + PromptTemplate + PipelineTemplate — 打通"生成→审核→后期→渲染→成片终审→发布"的交付链路
- **迭代3**：Conversation + WorkItem + Dataset（P3）— 补全辅助和支撑模块
- **迭代4**：CapabilityTemplate（P4）— 高级编排能力（串联多模型节点）

每个迭代的标准格式：Gate 0 契约冻结 → 纯领域实现 → 持久化与并发 → 旧写路径迁移 → 跨聚合集成 → 架构门禁。

---

## P2-8 评估记录：Prop 聚合提前到迭代1

> **评估结论**：建议提前。Prop 已从迭代2（P2）调整至迭代1（P1），与 Character / Scene 同步实现。

### 评估依据

1. **结构与 Character/Scene 同构**：在[资产库上下文](contexts/04-asset-library.md)中，Prop 的状态机（§3.1「与 Character 同构」）、命令（CreateProp / UpdateProp / MarkPropReady / PublishProp / UnpublishProp / ArchiveProp / RestoreProp / SoftDeleteProp）、领域事件（PropCreated ~ PropDeleted）与 Character / Scene 完全同构，实现成本与风险与 Character / Scene 一致，不引入新的状态机范式。
2. **代码已实现**：`backend/src/services/module-domain/prop-module.ts` 已提供完整 CRUD、版本管理（`recordVersion`）、软删除/恢复/批量操作，代码注释明确标注「与 getCharacter 同构」；`backend/src/types/prop.ts` 类型定义完备。即迭代1所需实现工作量极小。
3. **分镜已引用道具**：Shot 聚合（`backend/src/domain/storyboard/shot.aggregate.ts`）已持有 `propAssetIds`，Storyboard / Shot 类型（`backend/src/types/storyboard.ts`）已定义 `prop_asset_ids` 字段。若 Prop 留在迭代2，则迭代1的分镜只能绑定角色+场景，无法绑定道具，造成「资产三件套」割裂。
4. **与 Scene 提前的理由一致**：Scene 提前到迭代1的阻塞原因正是「分镜引用角色+场景+道具」。该理由对 Prop 同样成立——分镜引用的是角色+场景+道具三件套，缺一即不完整。因此 Prop 应与 Character / Scene 同步进入迭代1，使迭代1交付的「项目→剧本→资产→分镜」链路具备完整的资产绑定能力。
