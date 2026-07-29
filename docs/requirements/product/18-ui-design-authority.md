# UI 设计权威与版本基线

> **生效日期**：2026-07-29  
> **状态**：UI 目标设计基线 v1.0  
> **适用范围**：需求评审、DDD 评审、交付设计与前端实现

## 1. 权威顺序

发生冲突时按以下顺序裁决：

1. `docs/requirements/02-requirements-and-acceptance.md` 与 `docs/requirements/product/`：用户结果、角色、业务规则和验收事实；
2. `docs/domain/`：聚合、状态机、命令、事件和不变量；
3. `docs/delivery-specs/` 与生成的 `test-matrix.json`：页面、API、Schema、状态和验收追溯；
4. `ui-design-improvement-spec/ui-design-improvement-spec.html`：当前视觉、组件和交互规范；
5. `frontend/`：已实现行为，必须向上述目标基线收敛。

`ux-report/production-uiux-design-spec.md` 仅作为信息架构与工作台布局参考；历史原型、截图和 Review 已归档，不再拥有状态、导航或视觉决策权。

## 2. 必须保持一致的 UI 契约

- 页面最少覆盖 `loading / empty / ready / forbidden / conflict / error_retry`；长任务另覆盖 `queued / running / cancelling / completed / failed / cancelled / timed_out / unknown_result`。
- 审核入口展示 Review Intake 的 `qc_running / qc_blocked / review_pending / reviewing`，不得把“提交”直接显示成“审核已创建”。
- 版本化写操作显示 DEP `current / stale / blocked / unknown`、影响范围和修复计划。
- Script、Shot、资产和 EditProject 的编辑动作必须呈现权限、租约、在线成员及版本冲突。
- 剪辑中心以 EditProject Revision 和闭合 Timeline 为权威；`/clips` 仅为历史兼容入口。

## 3. 变更规则

任何导航、状态、角色动作或设计 token 变更都必须同时更新权威需求/领域契约、交付规格或 UI 追溯矩阵，并附自动化或人工验收证据。历史原型只能用于解释背景，不得覆盖当前基线。
