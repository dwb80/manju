# V2 RC 验收报告

> 执行日期：2026-07-23  
> 对象：当前工作树

## 结论

第八章全部 P0 阶段任务已完成。P0 缺陷为 0；V2 发布范围 P0/P1/P2 无未完成项。真实 Provider 因没有隔离测试账号与密钥而按既定条件跳过，不影响非真实 Provider 的关键门禁。

## 证据矩阵

| 门禁 | 命令 / 证据 | 结果 |
|------|-------------|------|
| 源码完整性 | `node scripts/check-missing-source-files.mjs` | 后端 dist JS 176、对应 TS 176、缺失 0，100% |
| 后端生产构建 | `backend/npm run build` | 通过 |
| 前端生产构建 | `frontend/npm run build` | 通过，25 条路由生成成功 |
| 后端全量门禁 | `backend/npm run test:all` | 通过；含编码、密钥、覆盖率、前端构建和关键 E2E |
| 覆盖率 | `backend/npm run test:coverage` | 当前工作树通过 lines 33% / functions 30% 阻断门槛；精确值以当次 Node coverage 输出为准 |
| 安全扫描 | `backend/npm run check:security` | SQL 插值审计与密钥扫描通过 |
| 关键用户旅程 | `frontend/npm run test:e2e:prepared` | 21/21，通过；连续两次执行均通过 |
| SQLite 升级/恢复 | `backend/tests/sqlite-migration-backup.test.mjs` | 旧 schema 自动迁移；备份恢复后数据与 `integrity_check` 通过 |
| 权限隔离 | 后端认证、RBAC、资源所有权与跨项目访问回归纳入 `test:all` | 通过 |
| P0 预算与假成功保护 | `backend/tests/p0-release-guards.test.mjs` | 3/3；批次聚合预算、Pipeline 预算复检、未配置执行器及审核决策 fail closed |
| 性能冒烟 | `backend/npm run test:performance` | 100 请求、并发 10、0 失败；P95 247.36ms ≤ 500ms |
| 真实 Provider | `backend/npm run test:provider:real` | 条件跳过：未设置 `REAL_PROVIDER_SMOKE=1`，且无隔离账号确认/密钥 |

## 发布检查表

- [x] P0 功能与 SEC P0 均无缺口
- [x] 后端、前端生产构建通过
- [x] 当前工作树全量门禁通过
- [x] 关键 E2E 连续两次通过
- [x] 数据迁移、备份和恢复可重复验证
- [x] 性能冒烟达到阈值
- [x] 已知限制与条件跳过项已披露
- [x] 回滚方案已文档化
- [x] 生成物、日志、临时数据库规则已加入 `.gitignore`

## 发布前环境动作

生产部署方仍需配置 `DATA_ENCRYPTION_KEY`、认证模式、CORS 白名单、HTTPS/代理信任、安全扫描与备份目标；如要启用真实 Provider 验收，必须使用隔离测试账号，并同时设置 `REAL_PROVIDER_SMOKE=1`、`REAL_PROVIDER_ISOLATED_ACCOUNT=1` 和 `AGNES_API_KEY`。
