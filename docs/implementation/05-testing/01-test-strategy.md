# 测试策略与质量门禁

## 1. 测试分层

| 层 | 工具/位置 | 验证内容 | 是否访问外部 Provider |
|---|---|---|---|
| Readiness | Node `node:test`，`tests/readiness` | OpenAPI、Schema、追踪、原型静态契约 | 否 |
| Domain unit | Node test/Vitest，后端领域目录旁 | 状态机、值对象、不变量、规范化 hash | 否 |
| API contract | 从 `openapi.json` 驱动 | 请求/响应/错误/权限/幂等/If-Match | 否，使用 fake adapter |
| SQLite integration | 临时数据库 | 事务、外键、唯一约束、Outbox、migration | 否 |
| Frontend component | Vitest | 表单校验、状态映射、权限呈现 | 否，MSW/等价 fake |
| E2E | Playwright | 页面主路径、异常、刷新恢复、键盘与深链 | 否，默认 fake Provider |
| Security | Node/Playwright + 专项脚本 | 越权、CSRF、SSO、敏感数据、上传 | 否 |
| Provider sandbox | 受控 nightly | 实际模型/平台适配、限流、未知结果对账 | 是，非 PR 门禁 |
| Performance/DR | 独立环境 | 容量、RPO/RTO、迁移和恢复 | 使用脱敏数据 |

## 2. 场景映射规则

- `test-matrix.json` 是 47 个功能的机器可读映射；`.feature` 文件是 94 个业务场景事实源。
- 每个 Scenario 至少映射一个自动化测试；P0 正常路径使用 E2E，负向不应全部堆在 E2E，可在契约/集成层验证。
- 测试名称必须包含 Scenario ID；一个测试可覆盖多个紧密相关场景，但报告必须逐 ID 输出结果。
- 不允许用 mock 返回固定“成功”证明业务完成；必须观察 HTTP、数据库/事件证据或用户可见状态。

## 3. Fixtures

固定、无个人信息的测试身份：

| ID | 角色 | 项目关系 |
|---|---|---|
| `usr_platform_admin` | platform_admin | 非项目默认成员 |
| `usr_owner_a` | member | project_a owner |
| `usr_admin_a` | member | project_a admin |
| `usr_writer_a` | member | project_a writer |
| `usr_director_a` | member | project_a storyboard_director |
| `usr_reviewer_a` | member | project_a reviewer，非提交人 |
| `usr_reviewer_b` | member | project_a reviewer，用于二审 |
| `usr_publisher_a` | member | project_a publisher |
| `usr_outsider_b` | member | 仅 project_b，用于越权测试 |

固定对象：`project_a/project_b`、`episode_a1`、`script_a1_v1`、`storyboard_a1`、`shot_a1_v1`、`snapshot_a1`、`final_video_a1_v1`。ID 不包含真实姓名、邮箱或生产路径。

媒体 Fixture 只使用仓库内许可明确的小文件；每个文件记录 MIME、大小和 SHA-256。恶意/损坏文件必须人工生成且禁止包含真实恶意载荷。

## 4. Provider Fake 契约

Fake adapter 必须可配置：

- success、retryable failure、permanent failure、timeout、rate limit；
- delayed callback、duplicate callback、callback input hash mismatch；
- accepted-but-response-lost（用于 `unknown_result`）；
- cost estimate、actual cost、refund；
- deterministic seed 和固定媒体 hash。

测试不得使用随机网络故障作为断言依据；所有时钟、ID 和 Provider 结果可注入。

## 5. CI 顺序

```text
1. encoding + secrets
2. implementation readiness check
3. OpenAPI contract generation drift check
4. backend build + domain unit
5. SQLite migration/integration
6. frontend lint/typecheck/component
7. Playwright P0 smoke
8. architecture dependency check
```

PR 阻断条件：任一 P0 场景失败、OpenAPI/生成类型漂移、migration 不可重复、敏感信息扫描失败、未登记路由、测试报告缺 Scenario ID。

## 6. 本地命令

```powershell
node scripts\generate-implementation-readiness.mjs
node scripts\check-implementation-readiness.mjs
node --test tests\readiness\implementation-readiness.test.mjs
npm --prefix backend run build
npm --prefix frontend run typecheck
```

功能实现后再增加：`test:domain`、`test:contract`、`test:integration`、`test:e2e:p0`。不存在真实测试文件前不得创建只返回成功的占位脚本。

## 7. 测试报告

机器报告至少包含 `scenarioId/status/duration/environment/appVersion/schemaVersion/openapiVersion/evidenceRefs/failureTraceId`。失败截图、trace 和数据库核对报告属于制品，保留期不少于一个发布周期。
