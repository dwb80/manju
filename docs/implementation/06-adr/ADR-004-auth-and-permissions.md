# ADR-004：认证与两层权限

## 决策

Web 使用 HttpOnly/Secure/SameSite Cookie，会话服务端可撤销；所有写请求通过 CSRF。授权先检查系统角色/安全 guard，再计算项目 role + allow - deny，deny 优先。

## 约束

- 401 与 403 语义分离；跨项目访问必须在 Repository 查询前后均受范围约束。
- 前端能力提示不是授权事实源。
- 所有权转移保持唯一 owner；审核自审和两级同人属于独立职责分离 guard。
- Token、密码、授权码、密钥不得进入 OpenAPI 示例、日志、事件、通知或审计 metadata。
