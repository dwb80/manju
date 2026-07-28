# 统一错误与 HTTP 响应契约

> **状态**：冻结。适用于全部新接口和迁移后的旧接口。  
> **目标**：客户端只处理一套稳定字符串错误码；HTTP status、用户文案和旧数字码不得承担机器分支的主身份。

## 1. 响应 Envelope

成功：

```json
{
  "data": {},
  "meta": {},
  "traceId": "trc_..."
}
```

失败：

```json
{
  "error": {
    "code": "command_validation_error",
    "message": "项目名称格式不正确",
    "details": { "field": "name", "reason": "长度必须为 1-100" },
    "retryable": false,
    "traceId": "trc_...",
    "legacyCode": 1001
  }
}
```

规则：

- `error.code` 永远是稳定、小写 snake_case 字符串，供程序分支、统计和文档引用。
- `message` 是可本地化用户文案，不得作为机器判断依据。
- `details` 只能包含安全、结构化详情；字段验证使用 `{ field, reason, rejectedValue? }`，敏感值不返回。
- `retryable` 由服务端按错误类型和当前结果确定，客户端不得仅凭 HTTP 5xx 猜测。
- `traceId` 必须与日志、审计、事件 correlationId 可关联。
- `legacyCode` 仅在兼容期返回，类型为数字；新客户端不得依赖。
- 成功响应不再以 `code: 0` 表达成功，HTTP 2xx 即协议成功。

## 2. 错误码目录

| code | 默认 HTTP | retryable | 语义 |
|---|---:|---:|---|
| `command_validation_error` | 422 | false | 字段、格式或命令参数校验失败 |
| `authentication_required` | 401 | false | 未登录、会话无效或过期 |
| `permission_denied` | 403 | false | 当前系统/项目角色或资源范围无权执行 |
| `aggregate_not_found` | 404 | false | 聚合不存在或当前主体不可见 |
| `invalid_state_transition` | 409 | false | 当前状态不允许命令 |
| `aggregate_version_conflict` | 409 | true | 乐观锁冲突；返回最新版本摘要 |
| `aggregate_invariant_violated` | 409 | false | 操作破坏业务不变量 |
| `command_already_processed` | 409 | false | 相同 commandId 已完成；有结果时返回原结果引用 |
| `idempotency_key_collision` | 409 | false | 相同幂等键对应不同规范化请求 |
| `member_already_exists` | 409 | false | 成员重复添加 |
| `workitem_source_review_locked` | 409 | false | 审核来源工作项不可人工完成 |
| `budget_warning_requires_confirmation` | 409 | false | 达告警阈值，需要授权确认 |
| `budget_exceeded` | 402 | false | 预算硬上限或配额阻断 |
| `quota_exceeded` | 429 | true | 用户/项目/供应商配额暂不可用 |
| `rate_limit_exceeded` | 429 | true | 请求频率超限；返回 retryAfterMs |
| `deadline_exceeded` | 504 | true | 同步命令或外部调用超过截止时间 |
| `provider_unavailable` | 503 | true | AI/邮件/发布等外部 Provider 暂不可用 |
| `circuit_breaker_open` | 503 | true | 熔断器开启 |
| `event_store_unavailable` | 503 | true | 事件/Outbox 持久化不可用 |
| `dependency_conflict` | 409 | false | 删除、恢复、导入等被引用关系阻断 |
| `retention_hold_active` | 409 | false | 法务/安全保留阻止永久删除 |
| `import_package_incompatible` | 422 | false | 项目包 schemaVersion 不受支持 |
| `import_integrity_failed` | 422 | false | manifest、哈希或文件完整性失败 |
| `notification_template_invalid` | 422 | false | 模板变量或渠道内容不合法 |
| `audit_write_required` | 503 | true | 高风险命令因审计证据无法写入而拒绝 |
| `internal_error` | 500 | false | 未分类服务端错误；外部不返回堆栈 |

领域可增加更精确错误码，但必须在本目录登记并映射 HTTP；禁止路由临时用错误消息文本推断状态码。

## 3. HTTP 规则

- 400 仅用于无法解析的请求；业务字段错误使用 422。
- 401 表示未认证，403 表示已认证但未授权。
- 404 可用于资源不存在或防枚举隐藏，但内部审计要区分真实原因。
- 409 用于状态、版本、幂等和依赖冲突。
- 402 仅用于产品定义的预算硬阻断；若网关不支持可迁移到 409，但字符串 code 不变。
- 异步任务提交成功使用 202；任务后续失败体现在任务状态和错误快照，不把提交请求改写为 500。

## 4. 兼容迁移

1. 服务端先同时返回新 `error` 与 `legacyCode`，前端优先读取字符串 code。
2. 移除所有 `errorStatusForMessage`/中文消息匹配，改为显式 Domain/Application Error。
3. 统一成功 envelope；适配层在兼容期处理旧 `{code,message,data}`。
4. 契约测试遍历错误目录，校验 code 类型、HTTP、retryable、详情脱敏和 traceId。
5. 一个正式版本后移除 `legacyCode`；移除前必须通过前端遥测证明无旧消费者。

## 5. 前端处理

- 401：进入会话恢复/登录流程；不得无限重试。
- 403：保留页面上下文并解释所需权限，不伪装为网络失败。
- 409 version conflict：展示服务器最新版本与用户修改，禁止静默覆盖。
- retryable=true：按服务端 retryAfterMs/退避策略提供自动或人工重试。
- validation：定位字段；未知 code 使用 traceId 提供通用错误，不显示内部堆栈。

