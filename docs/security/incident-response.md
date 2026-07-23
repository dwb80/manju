# 安全事件响应 Runbook

> **SEC-OPS-01** — 5 类常见安全事件的响应流程 + 联系人 + 证据保全 + 通报 SLA。
> 创建于 2026-07-22（W14 P1 一次性推进）。

## 0. 通用响应流程（适用于所有事件）

```
发现 → 5 min 内评估严重性 → 15 min 内启动响应 → 30 min 内通知负责人
       ↓
1. 隔离：阻断扩散（限流 / 停服 / 吊销 token）
2. 评估：影响范围（用户数 / 数据条数 / 损失金额）
3. 证据保全：日志 / 数据库快照 / 网络抓包
4. 修复：根因分析 + 部署补丁
5. 通知：内部 → 用户 → 监管（按严重性）
6. 复盘：RCA + 改进项落地（2 周内）
```

## 1. 数据泄漏（Data Breach）

**触发**：数据库 / 日志 / 媒体文件被未授权访问/导出/外发

**严重性分级**：
- P0：含 PII（手机/身份证/邮箱/银行卡）≥ 1k 条 或 金融数据
- P1：含 PII 100-1k 条 或 业务核心数据
- P2：脱敏后数据 或 非核心

**响应步骤**：
1. **5 min**：拉黑访问 IP（CDN 阻断） + 关闭可疑 API
2. **15 min**：导出 `prompt_injection_logs` / `audit_log` / `cost_records` 5 min 时间窗
3. **30 min**：通知数据保护官（DPO）+ 法务 + CEO
4. **60 min**：评估是否触发 GDPR 72h 通报（数据涉及欧盟用户）
5. **24h**：发布用户通知（"我们检测到..."）+ 主动 reset 相关用户密码
6. **72h**：通报监管（中国个保法 24h / GDPR 72h）

**联系人**：
- 值班 SRE：oncall-sre@agnes-ai.com
- 安全负责人：sec-lead@agnes-ai.com
- 法务：legal@agnes-ai.com
- CEO：ceo@agnes-ai.com

**修复要点**：
- 关闭 SQL 注入向量（参数化查询 + e2e 注入测试）
- 加固访问控制（资源所有权二次校验 SEC-ACC-02）
- 加固 PII 脱敏（SEC-DATA-04 自动 redact）

## 2. 越权访问（Broken Access Control / IDOR）

**触发**：用户访问到不属于自己的项目 / 资源 / 任务

**响应步骤**：
1. **5 min**：拉黑攻击者账号（禁用 24h + 强制 logout）
2. **15 min**：导出 `audit_log` 中该用户所有 GET/PATCH/DELETE 操作
3. **30 min**：紧急部署临时补丁：所有端点加 `caller.id == resource.owner_id` 校验
4. **24h**：通知被越权访问的真正 owner + 全量日志审计
5. **72h**：复盘（哪些端点没做所有权校验）+ 加 SEC-ACC-02 系统化修复

**修复要点**：
- 实施 `ensureProjectWriteAccess` 在所有 mutation 端点
- 实施 `ensureResourceOwnership` 在所有 GET 端点（read-time 校验）
- e2e 注入测试：尝试访问他人 project_id

## 3. DDoS / 大流量攻击

**触发**：5xx 错误率 > 20% 或入口流量 > 10x 正常

**响应步骤**：
1. **5 min**：CDN 启用"严格模式"（JS challenge + IP 频控）
2. **10 min**：开启 rate limit（写操作 60/min/user，登录 5/min/IP）
3. **15 min**：通知云厂商（启动弹性扩容 + DDoS 高防）
4. **30 min**：评估是否需要切到只读模式
5. **24h**：发布状态页更新

**修复要点**：
- 实施 SEC-ACC-01（端点级 rate limit）
- 接入 Cloudflare 5 秒盾 / 阿里云高防
- 准备 4 倍容量的弹性扩容预案

## 4. 供应链攻击（Supply Chain）

**触发**：`npm audit` 报 high/critical 漏洞 或 可疑 commit

**响应步骤**：
1. **5 min**：锁定 `package-lock.json` + 暂停 CI 自动部署
2. **15 min**：评估漏洞是否被利用（`npm audit` + 安全公告 CVE）
3. **30 min**：升级到 patched 版本（minor/patch 升级）
4. **60 min**：重新构建 + 部署 + 验证
5. **24h**：通知用户（如已暴露）+ 申请 CVE 编号

**修复要点**：
- 实施 SEC-SUP-01（CI 集成 `npm audit --audit-level=high`）
- 实施 SEC-SUP-02（SBOM 生成 + 漏洞追踪）
- 实施 SEC-SUP-03（容器镜像扫描 trivy）
- 订阅 GitHub Security Advisories 自动通知

## 5. AI 滥用（AIGC Misuse）

**触发**：用户输入"违法/暴力/色情"内容 或 Prompt injection 攻击

**响应步骤**：
1. **5 min**：标记该用户为"观察"（保留 prompt_injection_logs）
2. **15 min**：如果输入了违法内容：拉黑账号 + 通知法务
3. **30 min**：评估是否生成违法/侵权内容（QA-F18 敏感词 + NSFW 模型）
4. **60 min**：删除生成内容 + 写 `aigc_watermark_meta` 标识为"被举报"
5. **24h**：评估是否上报监管

**修复要点**：
- 加固 SEC-AI-01（Prompt injection 防护 + 攻击遥测）
- 加固 SEC-AI-02（NSFW / 暴力 / 违法内容过滤）
- 加固 SEC-AI-04（AIGC 水印 + 元数据溯源）

## 6. 证据保全规范

任何 P0/P1 事件必须在 1h 内：
- 导出 `data/logs/pino.log`（24h 时间窗）
- 导出 `data/app.db` 全库快照
- 导出 `data/audit-log/` 全量
- 写 `docs/security/incidents/YYYY-MM-DD-{short-id}.md` 包含：
  - 时间线（精确到分钟）
  - 影响范围
  - 采取的动作
  - 根因（待 RCA 完补充）
  - 改进项

## 7. 通报 SLA

| 严重性 | 内部通报 | 用户通报 | 监管通报 |
|--------|----------|----------|----------|
| P0 严重 | 5 min | 24h | 72h（GDPR）/ 24h（个保法） |
| P1 高 | 15 min | 24h | 7 天 |
| P2 中 | 60 min | 72h | 不需要 |
| P3 低 | 24h | 不需要 | 不需要 |

## 8. 复盘模板

事件关闭后 2 周内完成：
- 5 Whys 根因分析
- 修复项（每个 1 句话描述 + 负责人 + 截止日期）
- 流程改进（runbook 更新 / 新增检测规则）
- 培训项（如适用）

## 9. 工具与脚本

- 拉黑 IP：`scripts/block-ip.sh <ip>`
- 强制 logout 全员：`scripts/force-logout-all.sh`
- 数据库快照：`npm run ops:backup`
- 日志搜索：`node scripts/search-logs.mjs <pattern> --since 1h`

## 10. 联系人总表

| 角色 | 邮箱 | 值班电话 |
|------|------|----------|
| 值班 SRE | oncall-sre@agnes-ai.com | +86-xxx |
| 安全负责人 | sec-lead@agnes-ai.com | +86-xxx |
| 数据保护官（DPO） | dpo@agnes-ai.com | +86-xxx |
| 法务总监 | legal@agnes-ai.com | +86-xxx |
| CEO | ceo@agnes-ai.com | +86-xxx |
| 客服主管 | cs-lead@agnes-ai.com | +86-xxx |
| 公关 | pr@agnes-ai.com | +86-xxx |
