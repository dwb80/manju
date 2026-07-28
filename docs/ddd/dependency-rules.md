# 依赖方向约束

> **配套规范**：[DDD 治理规范](governance.md)｜[上下文映射](context-map.md)

## 1. 分层依赖图

系统采用 CQRS 拆分读写路径：写路径经 Command Handler 改写聚合状态，读路径经 Query Handler 查询读模型。两条路径从 HTTP / Event Handler 分叉，共用底层 SQLite 存储，但各自经过独立的 Application 与 Domain 依赖。

```
                    HTTP / Event Handler
                    ↓                      ↓
        (写) Command Handler        (读) Query Handler
          [Application 层]            [Application 层]
                    ↓                      ↓
            Domain Aggregate        Domain 只读接口 / 读模型
            [Domain 层]             [Domain 层]
                    ↓                      ↓
            Repository Port        Infrastructure 读数据访问
          [Domain Port]            [Infrastructure 层]
                    ↓                      ↓
            SQLite Repository Adapter（读写共用）
          [Infrastructure 层]
```

**写路径（Command Handler）**：HTTP / Event Handler 接收命令 → Application Command Handler 加载并操作 Domain Aggregate → 经 Repository Port 持久化 → SQLite Repository Adapter 落库；状态变更产出领域事件，由 Outbox 分发并投影到读模型。

**读路径（Query Handler）**：HTTP / Event Handler 接收查询 → Application Query Handler（CQRS 读模型处理器）执行查询，它依赖 **Domain 层的只读接口 / 读模型定义**（不触发聚合状态变更，不持有写仓储）与 **Infrastructure 层的数据访问**（读模型投影表 / 只读 SQL 查询）→ 直接从 SQLite 读取已投影的读模型返回。读模型由写路径产出的领域事件异步投影更新，最终一致（投影滞后容忍度 ≤ 2 秒，投影规则见 [跨上下文协作契约 §4](contracts.md#4-cqrs-读模型投影映射)）。

**Query Handler 约束**：
- 位于 Application 层，与 Command Handler 并列，职责互不交叉：Query Handler 不得调用聚合命令、不得写入 Repository Port，只读取读模型 / 只读视图。
- 依赖 Domain 层时只能依赖只读接口（读模型结构、查询入参 / 出参契约），不得依赖聚合根的可变行为与不变量校验逻辑。
- 依赖 Infrastructure 层的只读数据访问（读模型投影表、物化视图或只读 SQL），不经过 Repository Port 的写方法。
- 读模型与写库物理同库（SQLite），逻辑分离；未来可平滑替换为独立读存储，仅需更换读数据访问实现。

领域层必须满足：
- 不依赖 `AppContext`。
- 不依赖 HTTP、SQLite、AI Provider 或文件系统。
- 不直接调用另一个聚合的 Repository。
- 跨聚合引用必须通过 ID 持有（如 `Storyboard.shotIds: string[]`、`FinalVideo.sourceShotIds: string[]`），不得持有对象引用。
- 可以通过纯内存测试完成状态机和不变量验证。

---

## 2. 跨聚合引用规则

| 引用方 | 被引用方 | 引用形式 | 生命周期 |
|-------|---------|---------|---------|
| Storyboard | Shot | `shotIds: string[]` | Shot 归档时移除 ID，不级联删除 |
| EditProject.VideoClip | Shot | `shotId + shotVersion` | Shot 归档时剪辑保留冻结版本，但禁止新渲染使用失效来源 |
| EditProject.AudioClip | AudioAsset | `audioAssetId + version` | 资产归档不影响历史渲染，新 revision 标记失效 |
| EditProject.SubtitleTrack | SubtitleDocument | `subtitleDocumentId + version` | 同上 |
| FinalVideo | RenderJob | `sourceRenderJobId + sourceEditRevision` | RenderJob 不可删除，只可按保留策略归档 |
| Storyboard / Shot | Character / Scene / Prop（资产） | `sceneId: string`、`characterAssetIds: string[]`、`propAssetIds: string[]` | 资产归档/软删除时分镜保留引用，UI 标记资产失效，不级联删除 |
| FinalVideo | Shot | `sourceShotIds: string[]` | Shot 删除前需先删除 FinalVideo |
| Review | Shot（多态审核目标） | `targetType: 'shot' \| 'video' \| 'image' \| 'audio'` + `targetId: string` | 被审核对象删除时 Review 保留记录但 UI 标记失效，不级联删除 |
| Shot | Review（关联审核） | `reviewId: string \| null` | Review 关闭/取消后 Shot 保留 `reviewId` 作为历史，不级联删除 |
| Character | Script（来源） | `sourceScriptId: string \| null` | Script 删除后保留引用但 UI 标记来源失效 |
| Scene | Script（来源） | `sourceScriptId: string \| null` | 同上 |
| Prop | Script（来源） | `sourceScriptId: string \| null` | 同上 |
| Conversation | Project（关联） | `projectId: string \| null` | Project 删除后 Conversation 仍保留，UI 标记"项目已删除" |
| WorkItem | Project（关联） | `projectId: string \| null` | 同上 |
| PipelineRun | Project（关联） | `projectId: string` | Project 归档后 Run 标记只读（拒绝 `createRun` / `startRun` 等写命令，见上下文不变量），不级联删除；Project 恢复后解除只读 |
| AITask | Shot | `shotId: string \| null` | Shot 归档时任务完成即可，UI 标记关联失效 |
| Shot | AITask（视频任务） | `videoTaskId: string \| null` | 视频任务删除/归档时 Shot 保留引用但 UI 标记失效，`videoUrl` 历史结果保留 |
| AITask | PipelineRun/Node | `pipelineRunId/pipelineNodeId` | Pipeline 归档时不影响已完成的 AITask |
| ModelConfig | PromptTemplate | 由消费方在运行时按 `sceneTags` 匹配，无持久引用 | — |

**引用约定补充**：
- **多态引用**：`Review` 与 `QCReport` 通过 `targetType` + `targetId` 多态引用被审核/质检对象（`shot` / `video` / `image` / `audio`），引用方不持有具体聚合类型，解析由消费方按 `targetType` 路由。
- **双向引用**：`Shot ↔ Review`、`Shot ↔ AITask(视频任务)` 为双向 ID 引用——分镜持有 `reviewId` / `videoTaskId` 作为关联入口，审核/任务侧反向持有 `targetId` / `shotId`。两侧均仅持有 ID，任一侧归档/删除不级联影响对侧，由 UI 标记失效。
- **项目关联只读传播**：`PipelineRun` / `Conversation` / `WorkItem` 等通过 `projectId` 关联 `Project`；`Project` 归档后，按各上下文不变量将关联资源标记为只读（拒绝写命令），`Project` 恢复后解除，均不级联删除。
