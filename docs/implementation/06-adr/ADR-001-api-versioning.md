# ADR-001：Canonical `/api/v1` 与兼容路径

## 决策

所有新契约以 `/api/v1` 为 canonical。现有 `/api` 路由在兼容期调用同一 Application Handler，不复制业务逻辑或持久化。旧响应由边缘兼容器转换；内部统一使用 `{data}` / `{error}`。

## 原因

当前路径扁平/嵌套混杂且存在 `code:0`、`ok:true` 等多种响应。直接删除会破坏现有前端；继续扩展会固化两套协议。

## 约束

- OpenAPI 只登记 canonical 路径；兼容路由使用 `Deprecation`、`Sunset`、`Link` header。
- 指标按旧客户端/operationId 统计；零流量一个发布周期后才能 Contract。
- 同一幂等键跨兼容/canonical 路径映射到同一 route key。
