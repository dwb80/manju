结论：**当前V2开发没有完整遵守开发、设计和模块化强制原则，不能通过“开发就绪/合并准入”审查。**

功能层面已有较多实现，但架构边界、质量门禁、状态机、测试门禁存在严重偏差。

## 审计结论

| 审查维度 | 结论 | 主要问题 |
|---|---|---|
| 开发强制原则 | 不通过 | Router直接写Repository、跨模块写表、大量`any` |
| 设计强制原则 | 不通过 | 假质检、质量“阻断”不阻断、成片绕过审核 |
| 模块化原则 | 不通过 | 没有分层模块目录、数据所有权没有落实 |
| 状态与事务 | 不通过 | 镜头状态可直接覆盖，多记录写入缺少原子事务 |
| 权限控制 | 部分通过 | 流水线权限较完整，成片接口权限不足 |
| 前端设计 | 不通过 | 类型检查失败、硬编码项目ID、直接提示操作SQLite |
| 自动化门禁 | 不通过 | 前端类型检查失败，后端正式测试4项失败 |
| 可观测与异步 | 部分通过 | 有事件和日志，但后台任务泄漏到测试结束之后 |
| 综合结论 | **不通过** | 必须先整改P0问题，再继续扩大V2开发 |

## P0问题

### 1. 质检接口会生成随机假报告

当`qualityDetectionService`不可用时，接口使用随机数生成60–89分的“质检报告”，并直接持久化，见 [quality-router.ts](D:/trae/manju/backend/src/http/quality-router.ts:355)。

这直接违反：

- 失败必须显式化
- 不得生成假成功
- 状态必须来自真实服务端事实
- 自动决策必须可追溯

该逻辑必须删除。质检服务不可用时只能返回503或创建失败任务。

### 2. “block”策略实际没有阻断流水线

质量处理代码明确称其为“软阻断”，只写事件和日志，不修改节点状态，见 [quality-detection-service.ts](D:/trae/manju/backend/src/services/module-domain/quality-detection-service.ts:542)。

因此配置`on_failure=block`时，低质量结果仍可继续流向下游，质量门禁名义存在、实际失效。

### 3. 成片可以绕过渲染、质检和审核

`POST /api/final-videos`允许调用方直接提交：

- `videoUrl`
- `qualityScore`
- `version`
- 分辨率和帧率
- `status="ready"`

随后只要状态为`ready`就可以下载，见 [final-videos-router.ts](D:/trae/manju/backend/src/http/final-videos-router.ts:78)。

问题包括：

- 调用方可以伪造质量分。
- 没有强制关联不可变时间线版本。
- 没有强制关联渲染任务。
- 没有验证成片质检结果。
- 没有验证镜头审核结果。
- 普通项目成员通过项目可见性检查后即可创建或修改成片，未校验编辑权限。
- PATCH允许直接修改状态和质量分。

这违反MOD-AV数据所有权和正式成片准入规则。

### 4. 镜头状态机没有真正执行

`updateShot`直接把输入中的`status`写入数据库，没有执行合法转换校验，也没有乐观锁，见 [storyboard-module.ts](D:/trae/manju/backend/src/services/module-domain/storyboard-module.ts:269)。

同时，视频任务模块直接把镜头状态写成`completed`，见 [video-task-module.ts](D:/trae/manju/backend/src/services/module-domain/video-task-module.ts:151)，但`ShotStatus`类型并不包含`completed`，见 [storyboard.ts](D:/trae/manju/backend/src/types/storyboard.ts:72)。

代码依赖`as any`绕过了类型系统，产生了数据库状态与领域状态不一致的问题。

### 5. 正式质量门禁和构建门禁均未通过

实际验证结果：

- 后端`npm run build`：通过。
- 前端`npm run lint`：失败。
- 后端`npm test`：54项中50项通过、4项失败。

前端错误包括：

- 大量缺失模块。
- 场景、道具字段类型不一致。
- 重复定义UI组件。
- `Button`传入无效`as any`属性。
- 一致性包API的`body`类型错误。
- 镜头创建参数类型错误。

例如 [storyboard-director.tsx](D:/trae/manju/frontend/components/modules/storyboard-director.tsx:342) 使用了无效的`as any` JSX属性。

后端失败包括：

- 3个`owner_required`回归错误。
- `render-presets.test.mjs`触发libuv句柄关闭断言。
- 测试结束后仍有流水线后台任务访问已关闭数据库。

因此实施状态文档中“累计测试100%通过”“MOD-PIPELINE 6/6完整”的表述与正式门禁不一致，见 [v2-implementation-status.md](D:/trae/manju/docs/requirements/v2-implementation-status.md:61)。

## P1架构问题

### 1. 强制模块化结构没有落地

规范要求：

```text
modules/
  production-shot/
    domain/
    application/
    infrastructure/
    presentation/
```

当前不存在`backend/src/modules`目录。V2代码仍集中在：

- `backend/src/http`
- `backend/src/services/module-domain`
- `backend/src/services/app.ts`
- `backend/src/types`
- `backend/src/storage/schema.ts`

这说明功能按迭代堆入旧结构，没有按照新的模块边界重构。

### 2. PipelineRunService职责过多

[pipeline-run-service.ts](D:/trae/manju/backend/src/services/module-domain/pipeline-run-service.ts:139)超过2000行，同时负责：

- Run和节点CRUD
- DAG调度
- 节点状态
- 并发控制
- 幂等
- 条件表达式
- 事件记录
- Provider执行
- 重试和错误恢复
- 质量触发
- 审核返工
- 项目负责人查询
- Todo创建和更新

特别是它直接写入`todos`，见 [pipeline-run-service.ts](D:/trae/manju/backend/src/services/module-domain/pipeline-run-service.ts:2227)，违反任务编排模块不得拥有返工待办数据的边界。

### 3. Presentation层直接写Repository

多个Router直接执行业务写入：

- 质检配置和报告：[quality-router.ts](D:/trae/manju/backend/src/http/quality-router.ts:242)
- 成片版本：[final-videos-router.ts](D:/trae/manju/backend/src/http/final-videos-router.ts:124)
- AI任务、发布计划、Todo等也存在同类路径。

Router没有保持“协议转换、认证、调用Application Command”的单一职责。

### 4. 跨模块直接写表

视频任务模块直接更新：

- `moduleVideoTasks`
- `storyboards`
- `shots`

见 [video-task-module.ts](D:/trae/manju/backend/src/services/module-domain/video-task-module.ts:149)。

正确边界应是：

```text
视频任务成功
→ 发布 VideoCandidateRegistered / TaskSucceeded
→ MOD-SHOT消费事件
→ 执行合法状态转换
```

而不是视频模块直接修改镜头表。

### 5. 缺少可靠事务和Outbox

创建Run、节点和依赖采用多次独立Repository写入；镜头快照创建和镜头版本更新也是两次独立写入，见 [storyboard-module.ts](D:/trae/manju/backend/src/services/module-domain/storyboard-module.ts:572)。

任一步骤失败都可能留下：

- 有Run无完整节点
- 有快照但镜头版本未更新
- 镜头版本更新但事件未记录
- 状态更新后事件写入失败

规范要求的本地事务和Outbox尚未落地。

### 6. 异步生命周期未受控

`startRun`通过fire-and-forget启动`processRun`，见 [pipeline-run-service.ts](D:/trae/manju/backend/src/services/module-domain/pipeline-run-service.ts:289)。

正式测试中已经出现：

- 测试关闭数据库后后台任务继续写入
- `database is not open`
- 并发追踪器释放未知类型
- libuv句柄关闭断言失败

说明调度器缺少：

- 可等待的shutdown
- 活动任务注册
- 测试清理钩子
- AbortSignal传播
- Timer统一释放

## 产品设计问题

### 1. 流水线仍按“有没有数据”推断进度

[pipeline-router.ts](D:/trae/manju/backend/src/http/pipeline-router.ts:122)仍根据项目是否存在剧本、分镜、图片、视频和剪辑记录推断阶段完成。

这与V2规定的“进度只根据ProductionShot状态和正式交付物计算”冲突。

### 2. 流水线入口要求用户手工输入runId

[Pipeline页面](D:/trae/manju/frontend/app/pipeline/page.tsx:46)不是项目生产工作台，而是调试型入口。页面甚至提示用户可以直接向SQLite插入数据，见 [page.tsx](D:/trae/manju/frontend/app/pipeline/page.tsx:124)。

这违反：

- 用户不得绕过模块接口修改数据
- 页面不暴露底层存储操作
- 生产状态从项目上下文进入
- 页面与业务模块保持一致

### 3. 质检页面硬编码项目ID

[Quality页面](D:/trae/manju/frontend/app/quality/page.tsx:101)使用固定项目ID，并在后端数据返回前展示可编辑的默认配置。

这容易导致：

- 用户在错误项目上保存配置
- 默认占位被误认为真实配置
- 项目上下文与权限不一致

## 已经遵守的部分

当前实现并非全部不合格，以下部分方向正确：

- 后端TypeScript可以编译。
- 流水线节点权限使用集中权限矩阵，见 [project-member-service.ts](D:/trae/manju/backend/src/services/horizontal/project-member-service.ts:61)。
- DAG校验、条件表达式和部分错误分类采用了纯函数。
- 前端流水线和一致性包页面具备加载、错误和按钮禁用状态。
- 已实现部分幂等键、事件记录、重试、并发限制和任务恢复逻辑。
- Provider能力通过客户端适配层调用，没有全部散落在页面中。
- 批量节点操作返回逐项成功和失败，符合部分成功透明原则。

## 最终判定

当前状态更准确地描述为：

> V2功能快速实现阶段，部分业务能力已运行，但尚未完成架构收敛和正式质量门禁。

建议立即暂停继续扩展P1/P2功能，整改顺序为：

1. 删除随机假质检和假成功回退。
2. 修复质量`block`真正阻断流水线。
3. 封闭成片创建、状态修改和下载准入。
4. 建立镜头状态转换服务，清理非法`completed`状态。
5. 修复前端全部类型错误。
6. 修复后端4项正式测试和后台任务泄漏。
7. 拆分PipelineRunService。
8. 将Router写Repository迁移到Application Command。
9. 建立模块数据所有权和跨模块事件。
10. 把架构依赖检查加入CI。

::code-comment{title="[P0] 随机生成假质检结果" body="质检服务缺失时，这里用随机分数创建并持久化报告，会把基础设施故障伪装成有效质检。应删除fallback，返回503或创建失败质检任务，且不得生成可进入下游的报告。" file="D:/trae/manju/backend/src/http/quality-router.ts" start=355 end=389 priority=0}

::code-comment{title="[P0] block策略没有阻断" body="on_failure=block只记录事件和日志，不改变节点或候选的门禁状态，因此失败结果仍能继续调度。应由质量模块发布QualityGateBlocked事件，并由任务/镜头所有者执行明确的阻断状态转换。" file="D:/trae/manju/backend/src/services/module-domain/quality-detection-service.ts" start=542 end=555 priority=0}

::code-comment{title="[P0] 成片接口绕过生产门禁" body="调用方可直接创建status=ready的成片并提交qualityScore，未验证渲染快照、审核结果或成片质检；项目只读成员也可能通过成员检查写入。应改为仅接受受信渲染任务登记结果，并由Application层验证审核和质量门禁。" file="D:/trae/manju/backend/src/http/final-videos-router.ts" start=78 end=124 priority=0}

::code-comment{title="[P0] 视频模块跨域修改镜头状态" body="视频任务模块直接更新Storyboard和Shot，并写入ShotStatus未定义的completed值。该写入绕过镜头状态机和数据所有权。应发布任务成功/候选登记事件，由MOD-SHOT执行合法转换。" file="D:/trae/manju/backend/src/services/module-domain/video-task-module.ts" start=151 end=170 priority=0}

::code-comment{title="[P0] 镜头状态可被直接覆盖" body="updateShot把输入status直接并入patch，没有合法状态转换、准入条件、版本校验或状态历史事务。应从普通编辑DTO移除status，状态只能通过独立TransitionShotStatus用例修改。" file="D:/trae/manju/backend/src/services/module-domain/storyboard-module.ts" start=269 end=299 priority=0}

::code-comment{title="[P1] 编排服务跨模块写Todo" body="PipelineRunService同时负责调度、条件表达式、错误恢复和返工Todo，并直接写todos Repository，违反高内聚和数据唯一所有权。应发布ReworkRequested事件，由审核/待办模块幂等消费。" file="D:/trae/manju/backend/src/services/module-domain/pipeline-run-service.ts" start=2227 end=2259 priority=1}