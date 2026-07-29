# ADR-007：契约与测试事实源

## 决策

业务目标以 delivery-specs 为源，生成 OpenAPI 和 Test Matrix；物理 Schema 独立版本化并由 SQLite 执行验证。运行时 OpenAPI 在实现后成为当前接口事实源，CI 对比设计 operationId 和实现。

## 约束

- 同 method+path 只允许一个 canonical operation；多个需求用 `x-feature-ids` 关联。
- 生成物不得手工修改；修改源规格或生成器后重生。
- Scenario ID 贯穿 `.feature`、自动化测试和报告。
- 设计矩阵的 implementationEvidence 在真实代码/迁移/测试前保持 `unverified`。
