# 非功能与运行门禁需求目录

> 本目录为分散在质量、音频、交付、规模、迁移和安全基线中的 P0/P1 规范性条款提供稳定 ID。原文仍是规则事实源；本文件负责测试追溯，不重复降低原文要求。

| ID | 权威来源 | 可观察验收 | 必需测试层 |
|---|---|---|---|
| NFR-QUAL-001 | `11-quality-and-golden-sample-baseline.md` §1～2 | 任何 blocker 或未关闭 major 阻止送审/发布；结果包含规则、版本和证据 | integration, e2e |
| NFR-QUAL-002 | 同上 §3～5 | 自动 QC 召回率、误报率按题材/人群/画幅分层统计并可与金标准比较 | quality-regression |
| NFR-AUDIO-001 | `12-audio-postproduction-and-delivery-baseline.md` §1 | 声音克隆无有效授权时入口关闭；撤销后阻止新生成与新发布 | security, integration |
| NFR-TIMELINE-001 | 同上及工作台 EDIT-001～003 | 时间单位、帧边界、来源版本、响度/字幕/转场/效果预检可验证 | contract, integration, e2e |
| NFR-DELIVERY-001 | `12-*` §6、`09-change-impact-*` | 成片证据链完整率 100%，任一依赖版本可反查 | integration, evidence-audit |
| NFR-SCALE-001 | `13-commercial-*`、工作台 OPS-001 | 100 Episode×每集500对象时生产矩阵首屏 P95≤3秒，导出转后台任务 | performance |
| NFR-RECOVERY-001 | `07-data-lifecycle-*`、`13-commercial-*` | 备份可校验、恢复演练满足冻结的 RPO/RTO，失败不破坏当前数据 | recovery-drill |
| NFR-MIGRATION-001 | `07-data-lifecycle-*`、PD-005 | 项目包兼容当前及前一主版本，导入失败可回滚且有差异报告 | migration |
| NFR-SEC-001 | `04-platform-*`、`13-commercial-*` | 凭据不出现在日志/导出；敏感证据按权限脱敏；关键命令全部审计 | security |
| NFR-OPS-001 | `10-content-planning-*`、`11-quality-*` | 可恢复任务永久卡在处理中为0；超时、未知结果和人工接管均可收敛 | operation-drill |
| NFR-A11Y-001 | `14-professional-*` §8、前端交付规范 | 键盘完成主流程、焦点可见、无严重 axe 违规，1440×900 主流程可用 | accessibility, e2e |
| NFR-PRIV-001 | `07-data-lifecycle-*`、`13-commercial-*` | 保留、归档、永久删除和合同终止导出均有权限、预检和审计 | security, recovery-drill |

## 追溯规则

- `test-matrix.json.features[].requirementIds` 必须至少覆盖上述全部 ID。
- `requiredTestLayers` 必须包含表中测试层；`contract` 不能替代性能、安全、迁移、恢复演练或可访问性证据。
- 实现证据仍保持 `unverified`，直到对应自动化结果、演练记录或审计样本入库。
- 任一 P0/P1 原文新增规范性条款时，必须在本目录分配 ID 或明确并入已有 ID 的理由。

