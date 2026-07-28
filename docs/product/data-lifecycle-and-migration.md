# 数据生命周期、导入导出、备份与迁移方案

> **状态**：冻结设计基线。执行迁移前必须以生产副本演练并生成核对报告。  
> **范围**：单组织部署的数据库、媒体文件、事件位点、配置和版本化项目数据。

## 1. 数据生命周期

| 数据类型 | 活跃期 | 软删除/归档 | 默认保留 | 物理清理规则 |
|---|---|---|---:|---|
| Project/Episode/Script/Storyboard/Shot | 项目活跃期间 | 软删除进入回收站；发布制品关联对象优先归档 | 30 天回收期 | 无依赖、无法务冻结、完成审计后清理 |
| Character/Scene/Prop/AudioAsset/Subtitle | 版本化活跃 | 归档或软删除 | 30 天回收期；被快照引用版本长期保留摘要 | 文件清理前校验引用计数和快照 |
| PresentationSnapshot/Review/QCReport | 不可变证据 | 归档，不走普通回收站 | 随项目/合规策略，至少 365 天 | 只按保留任务清理，保留 digest 与审计 |
| RenderJob/AITask/PublishRecord | 运行与历史 | 终态归档 | 365 天；成本/发布证据按合规延长 | 外部 ID、费用和错误摘要保留 |
| Notification | 活跃/已读/归档 | 用户归档 | 180 天；安全通知从审计策略 | 正文可脱敏，投递摘要保留 |
| AuditRecord | 追加写 | 不允许普通删除 | ≥365 天 | 仅合规保留任务，清理行为本身审计 |
| Backup | 可恢复 | 到期 | 按日/周/月策略 | 至少保留一个已验证可恢复备份 |

法务/安全 `retention_hold` 优先于所有自动清理。清理任务以批次 ID 幂等，数据库记录和媒体文件分别记录结果；部分失败进入 WorkItem，不反复清理已成功部分。

## 2. 统一回收站

- 回收站读模型聚合各上下文的可恢复对象，不拥有原对象生命周期。
- 恢复由对象所属上下文的命令执行；平台层先生成 RecoveryPlan，列出父对象、名称、权限和引用冲突。
- 同一依赖图的批量恢复在单库部署中使用 UnitOfWork；跨上下文无法原子恢复时使用可重放步骤和补偿，不暴露为“全部成功”。
- 永久删除采用申请—影响预检—重新认证/审批—执行—核对—审计流程。

## 3. 版本化项目包

推荐扩展名 `.manju-project.zip`，逻辑结构：

```text
manifest.json
data/
  projects.ndjson
  scripts.ndjson
  assets.ndjson
  storyboards.ndjson
  post-production.ndjson
files/
checksums.sha256
reports/export-report.json
```

`manifest.json` 至少包含：

```json
{
  "format": "manju-project",
  "schemaVersion": "1.0.0",
  "productVersion": "x.y.z",
  "projectId": "...",
  "exportedAt": "...",
  "objectCounts": {},
  "rootDigest": "sha256:...",
  "requiredCapabilities": [],
  "excludedSensitiveTypes": ["credentials", "sessions", "audit_records"]
}
```

兼容规则：当前主版本必须读取当前和前一主版本；版本升级使用显式迁移器 `vN -> vN+1`，禁止跳过中间语义或忽略未知必填字段。

## 4. 导入事务

1. 上传到隔离 staging，限制大小/文件数/解压比并执行恶意文件检查。
2. 校验 manifest、schemaVersion、哈希、文件路径和引用完整性。
3. 解析为 ImportPlan，不写正式仓储。
4. 展示 ID/名称/版本/父对象冲突及 `create_new/merge` 处理方案。
5. 用户确认后写 `ImportJob`，小数据单事务；大文件先复制到内容寻址 staging，再原子提交数据库引用。
6. 失败回滚数据库和未引用文件；重试复用 importJobId/idempotencyKey。
7. 生成对象数量、映射、跳过、失败、哈希和耗时核对报告。

## 5. 备份与恢复

### 5.1 备份集

每个 BackupSet 包含数据库一致性快照、媒体清单与增量、必要配置、schema/migration 版本、Outbox/Inbox/DLQ/投影位点和校验清单。凭据使用独立密钥封装，不与备份密码放在同一位置。

### 5.2 默认目标

- RPO ≤ 24 小时。
- RTO ≤ 4 小时。
- 每日自动备份、每周保留、每月长期保留；具体数量按存储预算配置。
- 每次备份完成后校验可读性与哈希；至少每季度恢复演练。

### 5.3 恢复步骤

维护/隔离环境 → 恢复数据库 → 恢复媒体 → 执行迁移 → 校验引用和哈希 → 校验事件位点与积压 → 运行 J-01/J-04/J-06 抽样旅程 → 双人签署 → 切换流量。失败时保留原环境并回切。

## 6. 历史 Audio 与 project_clips 迁移

### 6.1 映射

| 旧数据 | 新模型 | 转换规则 |
|---|---|---|
| `audios.id` | `audio_assets.id` | 默认保留 ID；冲突时记录 id_map |
| `audios.type` | `AudioAsset.type` | voiceover→voice，bgm→bgm，effect/sfx→sfx；未知值进入人工报告 |
| `audios.file_url` | `AudioAsset.fileUrl` | 规范化 URL/路径并验证文件存在与哈希 |
| `audios.duration` | `durationMs` | 秒转整数毫秒；缺失时通过媒体探测，失败标记待修复 |
| `audios.character_id` | `voiceProfileId`/metadata | 不直接假定等价；保留 characterId 来源并按可用映射生成 voiceProfile |
| `project_clips` | `EditProject.timeline.videoTracks[].clips[]` | 按 project/episode/storyboard 分组创建 EditProject revision 1 |
| clip audio/subtitle refs | AudioClip/SubtitleCue 引用 | 通过 id_map 重写，缺失依赖阻止该工程切换 |
| 旧 timeline/version | `currentRevision/lastRenderedRevision` | 只迁移可证明的版本；未知渲染状态不标记 ready |

### 6.2 阶段

1. **Inventory**：统计行数、类型、空字段、重复 ID、文件缺失、孤儿引用和状态分布，冻结核对基线。
2. **Expand**：创建新表/列和迁移状态表，不改变旧写路径。
3. **Backfill**：按批次幂等转换，记录 sourceId/targetId/digest/status/error。
4. **Shadow read**：同一请求读取新旧模型并比较数量、关键字段、文件和时间线总时长，差异进入报告。
5. **Dual write（短期）**：必要时通过单一应用服务同时写新旧模型；禁止两个独立业务入口各写一套。
6. **Cutover**：满足门禁后切新读写；旧表只读，禁止新增命令。
7. **Stabilize**：观察至少一个正式发布周期，验证生成、剪辑、渲染和回滚。
8. **Contract**：移除旧写入口；旧表到期后归档/删除，删除前再备份和核对。

### 6.3 切换门禁

- 行数与对象映射 100% 可解释（成功、明确跳过或明确阻断），不得有未知丢失。
- 有效文件哈希一致；缺失文件全部有责任人和处理状态。
- 每个 EditProject 的 clip 顺序、入出点、总时长和引用通过校验。
- 新模型的 J-01/J-06 端到端旅程通过。
- 回滚脚本已在生产副本演练，且不会覆盖切换后新数据。

### 6.4 回滚

切换后若出现 P0 数据/生产故障：停止新写 → 保存新模型增量 journal → 切回旧读写兼容层 → 验证核心查询 → 修复迁移器 → 将 journal 重新合并到新模型。禁止简单丢弃切换后的新数据。

## 7. 项目角色迁移

| 旧角色 | 默认新角色 | 备注 |
|---|---|---|
| owner | owner | 保证每项目唯一 |
| editor | writer + storyboard_director + designer + video_director + editor | 宽权限映射，迁移报告要求 owner 后续收敛 |
| reviewer | reviewer | 保留 |
| commenter | 无业务写角色 + 显式 comment allow | 不映射为 reviewer |
| viewer | 无业务写角色 | 只读由成员基础权限提供 |

系统级 `admin/editor/viewer` 不直接转换为项目业务角色。迁移前后逐项目验证唯一 owner、成员可见性和高风险权限，无法确定的记录标记 `requires_review`，不得默认提升为 admin。

系统角色默认迁移：旧 `admin -> platform_admin`；旧 `editor/viewer -> platform_user`。`platform_operator` 只能由平台管理员在迁移后显式授予，禁止把内容编辑者自动提升为运行操作员。

## 8. 统一错误协议迁移

按[统一错误与 HTTP 响应契约](../ddd/error-contract.md)执行双协议兼容：字符串 code 为权威，数字放入 legacyCode；前端遥测确认无旧消费者后移除旧 envelope。错误迁移与数据迁移分开发布，避免故障时无法判断来自协议还是数据。

## 9. 迁移审计与验收报告

每个迁移批次记录版本、代码提交、操作者、开始/结束时间、输入/输出数量、哈希、差异分类、人工决策、回滚点和最终签署。没有报告的脚本运行不构成完成证据。
