# ADR-002：Shot 表现子表与不可变快照

## 决策

VisualLayer、TextOverlay、ComicEffectCue、MotionCue 使用规范化子表作为当前可写事实；Shot 保存 composition JSON 和聚合 version。送审/渲染把完整输入规范化为 canonical JSON，保存不可变 PresentationSnapshot 和 SHA-256。

## 原因

子表支持稳定 ID、字段查询、引用约束和迁移；快照 JSON 适合复现和哈希。只用一个大 JSON 难以索引和引用，只用快照子表难以冻结跨领域依赖。

## 约束

- 子表只能经 Shot 聚合命令写入，同一 UnitOfWork 更新 Shot version。
- canonicalizer 明确 schemaVersion、字段顺序、数值精度和 Unicode 规范化。
- 审核、任务和渲染只引用 snapshotId+hash，不读取“当前 Shot”重建历史输入。
