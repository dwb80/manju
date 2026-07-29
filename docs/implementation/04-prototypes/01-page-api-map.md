# 页面—功能—API 映射

> 可交互原型见 [index.html](index.html)。原型用于信息架构、操作与状态评审，不替代最终视觉稿。

| 页面组 | 功能 ID | 关键写操作 | 必验状态 |
|---|---|---|---|
| 登录/安全 | US-023 | login/change-password/revoke-session | 锁定、CSRF、SSO 重放、会话失效 |
| 用户管理 | US-022 | create/invite/change-status/revoke-sessions | 最后管理员、重认证、脱敏 |
| 项目/剧集 | US-001/002 | create project/add episode | 幂等、重名、初始化回滚 |
| 项目成员 | CAP-001 | add/update/remove/transfer owner | deny 优先、唯一 owner、跨项目拒绝 |
| 剧本中心 | US-003/004 | lock/save/publish/analyze/apply | 锁冲突、stale、失败重试 |
| 分镜板 | US-005/006 | add/reorder/apply suggestions | UnitOfWork、版本冲突、部分建议 |
| 漫剧导演台 | MANGA-001～006/008 | layer/text/effect/motion/precheck/submit | 越界、授权、重叠、光敏、不可变快照 |
| 资产/音频 | US-007/008/013 | create/update/publish/archive | 发布完整性、引用影响、旧版本稳定 |
| 模型/Prompt/Pipeline | CAP-002/003、US-PM-001 | test/activate/validate/publish | 凭据脱敏、版本固定、图环检测 |
| AI 任务 | CAP-006、US-009/011 | generate/cancel/retry/adopt | 预算预占、回调 hash、unknown_result |
| 审核/质检 | US-010/012/016、MANGA-007、CAP-008 | decide/waive/retry/publish rules | 自审、两级分离、规则版本、超时 |
| 剪辑/字幕 | US-014/015/021 | cues/timeline/clip/render | 并发保存、媒体缺失、冻结版本 |
| 发布 | US-017 | plan/precheck/execute/reconcile | 平台隔离、凭据、未知结果 |
| 协作 | US-018/019/020 | create/assign/transition/link | 项目成员范围、职责分离、事件去重 |
| 通知 | US-024 | preferences/read/archive | SSE 补拉、强制渠道、目标脱敏 |
| 配置/预算 | US-026、CAP-007 | set/rollback/reserve/reconcile | 继承、敏感三态、并发穿透 |
| 审计 | US-027 | query/export | fail-closed、范围、不可修改 |
| 数据与指标 | CAP-004、US-DS-001 | import/publish/export/rebuild | 授权、扫描、空分母、watermark |
| 回收站 | US-025 | plan/restore/permanent delete | 冲突、冻结、逐项结果、重认证 |
| 项目包 | US-028 | export/plan/confirm | hash、版本、原子性、回滚 |
| 备份恢复 | US-029 | backup/verify/plan/approve/execute | 可读性、隔离、RPO/RTO、回切 |
| AI 对话/Studio | CAP-005 | send/stop/regenerate/create task | SSE 恢复、sibling、附件扫描 |

每个页面均必须覆盖 `loading/empty/ready/forbidden/conflict/error`；有 CQRS 投影的页面额外覆盖 `syncing/delayed`，异步任务额外覆盖全部终态。
