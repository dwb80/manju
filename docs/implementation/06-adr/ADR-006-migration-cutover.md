# ADR-006：可逆迁移与灰度切换

## 决策

历史模型采用 Expand/Backfill/Shadow Read/Dual Write/Cutover/Stabilize/Contract；每次迁移有 checksum、批次 journal、核对摘要和 feature flag。

## 约束

- Contract 前旧事实完整保留；DROP 不作为普通迭代清理。
- 新旧写入必须由同一应用命令协调，禁止长期异步双写。
- 文件和数据库引用同时核对；缺失媒体阻断切换。
- Cutover 可按 projectId 灰度并可立即回切读路径。
