# DDD 文档整改报告（2026-07-28）

## 结论

本轮已完成文档层 P0/P1 结构整改：主生产链路已有明确上下文、聚合、状态门禁、事件可靠性和开发完成标准。文档可以作为后续 Gate 0 契约评审输入，但不能据此宣称代码已经实现；真实实现状态统一为“待核验”。

## 已完成

| 问题 | 整改结果 |
|---|---|
| 缺失功能状态权威来源 | 重建 `feature-status.md`，默认未核验，禁止页面/mock 冒充完成 |
| 后期制作无领域承接 | 新增 §3.9 后期制作上下文：EditProject、AudioAsset、SubtitleDocument、RenderJob |
| 分镜资产引用断链 | Shot 增加版本化资产绑定、Prompt 快照和绑定/解绑事件 |
| 资产可绕过 ready 发布 | Character/Scene/Prop 发布统一只允许 ready |
| FinalVideo 可绕过终审 | 增加制品版本、两级终审、审核版本绑定和重新打包失效规则 |
| 发布缺预检与执行记录 | PublishPlan 增加 PublishPrecheck、PublishRecord 和执行幂等规则 |
| Review 的 reject/needs_fix 混用 | 拆分 RejectReview 与 RequestReviewChanges |
| WorkItem 系统完成路径矛盾 | 增加 CompleteSystemWorkItem；closed 才是 task/issue 最终终态 |
| AI 任务无法生成多个候选 | 创建幂等改为 Idempotency-Key，Provider 回调用 providerRequestId 去重 |
| 事件事务/重放无物理承接 | 定义 outbox_events、inbox_events、event_dlq、projection_checkpoints |
| 角色数量和单/多角色冲突 | Member 改为 roles[]，补齐 11 类业务角色并保留唯一 owner |
| 开发完成标准缺失 | 新增 Definition of Done、迁移、测试、事件、前端、观测和安全门禁 |
| 缺追踪闭环 | 新增 US→聚合→命令→事件→API/Schema→验收证据矩阵 |

## 尚需代码核验或实现

1. 对追踪矩阵逐行填写真实 API、表、代码路径和测试编号。
2. 将历史 `Audio` 和 `project_clips` 数据迁移到后期制作模型。
3. 实现并迁移事件 Inbox/DLQ/投影位点；核验现有 Outbox 是否满足新 envelope。
4. 将项目成员单 role 数据迁移为 roles 数组并补权限矩阵测试。
5. 实现 FinalVideo 两级终审、发布预检和 PublishRecord。
6. 将后端核心领域覆盖率门禁从当前低阈值提升到 ≥80%。
7. 建立 OpenAPI 生成及漂移校验，补齐后期制作 API。
8. 完成代码核验后逐项更新 `feature-status.md`，不得批量标记完成。

## 下一道门禁

只有满足以下条件，文档才可进入“需求冻结”：

- 追踪矩阵所有 P0 行无“待核验”。
- 所有 Markdown 相对链接检查通过。
- 事件表、消费者注册表、API 和迁移名称一致。
- 产品、开发、测试共同签署 P0 验收范围。

