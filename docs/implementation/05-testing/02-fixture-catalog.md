# Fixture 与测试数据目录

| Fixture | 目的 | 不变量 |
|---|---|---|
| `empty_org` | 首次登录/空状态 | 仅一个 platform_admin，无项目 |
| `project_a_base` | 通用项目范围 | owner/admin/各岗位/outsider 边界明确 |
| `project_a_comic_ready` | 漫剧编辑 | 已发布角色/场景/道具/音频各至少1版本 |
| `shot_draft_valid` | 构图/文字/动态 | 所有坐标0..1、时间在 Shot 内、引用已发布版本 |
| `shot_with_conflicts` | 预检负向 | 气泡重叠、文字越界、Motion 重叠、光敏风险 |
| `snapshot_approved` | 不可变/返工 | hash 固定且 Review 已通过 |
| `pipeline_provider_matrix` | AI 任务 | 七种可控 Provider 结果 |
| `review_separation` | 审核 | submitter、first、second 三个不同用户 |
| `edit_project_multitrack` | 后期 | video/audio/subtitle 三轨和稳定源版本 |
| `publish_unknown_result` | 发布对账 | Provider 已接受但客户端未收到响应 |
| `legacy_v1_database` | 迁移 | 包含旧 Audio、ProjectClip、settings、code envelope 数据 |
| `backup_complete` | DR | DB/媒体/配置/事件位点及正确 manifest hash |

Fixture 生成器必须幂等并支持指定 `clockSeed/idSeed/providerSeed`。不得从生产数据库复制未经脱敏的数据；迁移演练使用结构等价的合成数据或批准的脱敏副本。
