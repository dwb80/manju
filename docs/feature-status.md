# V2 功能状态基线

> 基线日期：2026-07-23  
> 权威明细：[V2 实现状态第八章](requirements/v2-implementation-status.md#8-全量-feature-id-清单)

V2 发布范围内的 P0、P1、P2 功能均已实现并通过当前工作树门禁。主功能表共 187 项：175 项完成，12 项 P3 MOAT 长期规划不纳入本轮发布，因此全表完成度为 94%，发布范围完成度为 100%。SEC 安全聚合视图 42/42 完成，其中 P0 26/26。

## 可发布能力

- 项目、审核、音频、编辑、渲染、成本、模型、路由、模板、数据、非功能与质量检测模块均为 100%。
- 登录认证、RBAC、资源所有权校验、CSRF、限流、防爆破、加密、HTTPS/CORS、SQL 注入/SSRF/上传防护、AI 内容安全与供应链门禁已落地。
- 后端与前端生产构建通过；后端全量门禁通过；前端关键用户旅程 E2E 21/21 连续两次通过。
- SQLite 旧结构迁移、完整备份、恢复后完整性与数据一致性均有自动化测试。
- 任务批次和 Pipeline 在创建、追加节点与实际调度前执行聚合预算硬拦截；未配置的执行器或审核决策明确失败，不会用空结果伪装成功。

## 已知边界

- `MOAT-F01~F12` 为 P3 差异化能力规划，不属于 V2 RC 范围。
- 真实 Provider 烟测只允许使用隔离测试账号与密钥。本次环境未提供这些凭据，因此按发布策略条件跳过；本地 Fake Provider 和非真实 Provider 关键路径没有跳过。
- 性能结论是单机健康端点烟测（100 请求、并发 10、P95 247.36ms），不替代生产容量规划、长稳压测或真实媒体生成负载测试。
- 当前工作树包含用户既有的未提交改动；验收结论针对当前工作树内容，不等同于已生成 Git 发布标签。

## 工厂模块校准（2026-07-24）

三个工厂（角色 / 场景 / 道具）当前真实状态（与文档 [factories-assets-and-image-views.md](./factories-assets-and-image-views.md) 同步）：

- ✅ CRUD / 回收站 / 批量 / 跨项目复制 / 引用查询 — 后端全有，前端 UI 完整暴露
- ⚠️ 资产图片多视图（`/api/.../:id/images`）— 后端表 + service 都有，**前端 UI 未暴露**，按 [factories-assets-and-image-views.md](./factories-assets-and-image-views.md) 改造
- ⚠️ 场景 / 道具独立编辑页路由（`/scenes/:id/edit` `/props/:id/edit`）— 缺失，按 P0-1 实施
- ⚠️ AI 生图参数与 `images.txt` 漂移 — 按 [ai-image-config.md](./ai-image-config.md) 抽 `image-config.ts` 单一真相源
- ⚠️ 文档与代码字段漂移（`asset-library.md` 5 字段 vs 代码 17 字段）— 已校准到 24 字段基线

校准后工厂模块从"100% 完整"调整为"列表 / CRUD / AI 生成基线完整，多视图与编辑页待补"。

## 三厂联调 e2e 收口（S4.0~S4.4，2026-07-24）

- ✅ S4.0+S4.1 review 收口：image-provider 适配器 + 路由统一 + 错误检测 + requestId 取首条
- ✅ S4.2 一致性包 A↔B 双向：history 三维字段（shot_type/angle/view_type）+ approved 导入回 history + entity.image 主图回灌
- ✅ S4.3 端到端 5/5 全绿（`tests/s4-3-factory-e2e.test.mjs`）：character / scene / prop 三厂各跑一次 list→detail→edit→history append→apply→consistency-pack generate→pending_review→approved 主图回灌 + expression:neutral 落库
- ✅ S4.4 跨文档同步：
  - `factory-router.ts` 三套 `RESERVED_*_SUBPATHS` 合并为单一 `RESERVED_FACTORY_SUBPATHS`（7 个保留字）
  - 新建 `getScene` / `getProp` service（与 `getCharacter` 同构），详情端点统一走 service 层
  - 详情端点加 `!seg3` 守卫，避免 `/api/factories/<id>/foo` 误命中详情
  - 新增 `pipeline_command_log` 表（幂等键权威源，跨进程重启可恢复）
- 📌 遗留项：场景/道具前端编辑页 UI 仍未交付（路由已可走通），P0-1 排期。

## 验收证据

完整命令、结果、已知限制和发布检查项见 [V2 RC 验收报告](release/v2-rc-acceptance.md)，升级与回退步骤见 [V2 回滚方案](release/v2-rollback.md)。
