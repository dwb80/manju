# 命令级权限矩阵

> **状态**：默认授权基线，待产品、安全和各岗位负责人共同确认。  
> **目标**：替代“能看某菜单就能操作”的粗粒度权限；后端必须按命令授权，前端隐藏按钮仅用于体验优化。

## 1. 两层角色模型

### 1.1 系统角色

系统角色只管理部署级能力，不直接赋予项目内容修改权：

| 系统角色 | 默认能力 |
|---|---|
| `platform_admin` | 用户/组织成员、系统安全、系统配置、Provider 凭据、全局模板、全局审计 |
| `platform_operator` | 运行监控、任务处置、备份恢复执行；不能读取无关项目内容 |
| `platform_user` | 登录并访问其加入的项目 |

当前代码中的 `admin/editor/viewer` 应迁移或映射到上述系统角色，禁止与项目 `admin` 混为同一授权判断。

### 1.2 项目角色

| 缩写 | ProjectRole | 说明 |
|---|---|---|
| O | `owner` | 唯一项目所有者 |
| A | `admin` | 项目管理员 |
| P | `producer` | 制片与进度、成本负责人 |
| W | `writer` | 编剧 |
| SD | `storyboard_director` | 分镜导演 |
| D | `designer` | 美术设计师 |
| VD | `video_director` | 视频导演/生成负责人 |
| VA | `voice_actor` | 配音人员 |
| E | `editor` | 剪辑人员 |
| R | `reviewer` | 审核人员 |
| PB | `publisher` | 发布运营 |
| AI | `ai_admin` | 项目级模型、Prompt、配额与成本策略管理员 |

矩阵符号：`✓` 默认允许；`△` 仅限本人创建、本人被指派或明确数据范围；`◎` 允许提出/执行但需要审批；`—` 默认拒绝。所有项目成员默认可读取项目基本信息，但敏感成本、凭据和审计数据单独控制。

## 2. 项目与协作命令

| 命令/权限键 | O | A | P | W | SD | D | VD | VA | E | R | PB | AI |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `project.read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `project.update` | ✓ | ✓ | ✓ | — | — | — | — | — | — | — | — | — |
| `project.archive_restore` | ✓ | ✓ | ◎ | — | — | — | — | — | — | — | — | — |
| `project.soft_delete` | ✓ | ◎ | — | — | — | — | — | — | — | — | — | — |
| `project.permanent_delete` | ◎ | — | — | — | — | — | — | — | — | — | — | — |
| `project.transfer_ownership` | ✓ | — | — | — | — | — | — | — | — | — | — | — |
| `member.add_remove` | ✓ | ✓ | — | — | — | — | — | — | — | — | — | — |
| `member.roles_permissions` | ✓ | ✓ | — | — | — | — | — | — | — | — | — | — |
| `episode.create_update` | ✓ | ✓ | ✓ | — | — | — | — | — | — | — | — | — |
| `episode.delete_restore` | ✓ | ✓ | ◎ | — | — | — | — | — | — | — | — | — |
| `budget.read_summary` | ✓ | ✓ | ✓ | — | — | — | △ | — | — | — | — | ✓ |
| `budget.configure` | ✓ | ✓ | ◎ | — | — | — | — | — | — | — | — | ✓ |
| `workitem.create_update` | ✓ | ✓ | ✓ | △ | △ | △ | △ | △ | △ | △ | △ | △ |
| `workitem.assign_any_member` | ✓ | ✓ | ✓ | — | — | — | — | — | — | — | — | — |

## 3. 创作、资产和生成命令

| 命令/权限键 | O | A | P | W | SD | D | VD | VA | E | R | PB | AI |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `script.read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `script.create_edit` | ✓ | ✓ | △ | ✓ | △ | — | — | — | — | — | — | — |
| `script.import_export` | ✓ | ✓ | ✓ | ✓ | — | — | — | — | — | — | — | — |
| `script.publish_archive` | ✓ | ✓ | ◎ | ✓ | — | — | — | — | — | — | — | — |
| `asset.read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `asset.create_edit` | ✓ | ✓ | — | — | △ | ✓ | △ | △ | — | — | — | — |
| `asset.mark_ready_publish` | ✓ | ✓ | — | — | △ | ✓ | — | △ | — | — | — | — |
| `asset.archive_restore` | ✓ | ✓ | — | — | — | ✓ | — | — | — | — | — | — |
| `storyboard.create_edit` | ✓ | ✓ | △ | — | ✓ | △ | △ | — | — | — | — | — |
| `shot.create_reorder_delete` | ✓ | ✓ | — | — | ✓ | △ | △ | — | — | — | — | — |
| `shot.composition_text_effect` | ✓ | ✓ | — | △ | ✓ | ✓ | △ | — | △ | — | — | — |
| `shot.bind_asset` | ✓ | ✓ | — | — | ✓ | ✓ | △ | — | — | — | — | — |
| `generation.dispatch_image` | ✓ | ✓ | — | — | ✓ | ✓ | △ | — | — | — | — | ✓ |
| `generation.dispatch_video` | ✓ | ✓ | — | — | ✓ | — | ✓ | — | △ | — | — | ✓ |
| `generation.dispatch_audio` | ✓ | ✓ | — | — | — | — | — | ✓ | △ | — | — | ✓ |
| `generation.cancel_retry_own_scope` | ✓ | ✓ | — | — | △ | △ | △ | △ | △ | — | — | ✓ |
| `model_prompt_route.configure` | ✓ | ✓ | — | — | — | — | — | — | — | — | — | ✓ |
| `pipeline.template_publish` | ✓ | ✓ | — | — | — | — | — | — | — | — | — | ✓ |

## 4. 审核、后期和发布命令

| 命令/权限键 | O | A | P | W | SD | D | VD | VA | E | R | PB | AI |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `review.submit` | ✓ | ✓ | △ | △ | ✓ | △ | ✓ | △ | ✓ | — | — | — |
| `review.assign` | ✓ | ✓ | △ | — | — | — | — | — | — | ✓ | — | — |
| `review.approve_request_changes_reject` | ◎ | ◎ | — | — | — | — | — | — | — | ✓ | — | — |
| `review.override_qc_warning` | ✓ | ✓ | — | — | — | — | — | — | — | ✓ | — | — |
| `quality_rule.configure` | ✓ | ✓ | — | — | — | — | — | — | — | ✓ | — | ✓ |
| `audio.create_edit_publish` | ✓ | ✓ | — | — | — | — | — | ✓ | ✓ | — | — | — |
| `subtitle.create_edit_publish` | ✓ | ✓ | — | △ | — | — | — | △ | ✓ | — | — | — |
| `edit_project.timeline_edit` | ✓ | ✓ | — | — | △ | — | △ | △ | ✓ | — | — | — |
| `render.start_cancel_retry` | ✓ | ✓ | — | — | — | — | △ | — | ✓ | — | — | — |
| `final_video.submit_review` | ✓ | ✓ | ✓ | — | — | — | ✓ | — | ✓ | — | — | — |
| `publish_plan.create_schedule` | ✓ | ✓ | △ | — | — | — | — | — | — | — | ✓ | — |
| `publish_plan.execute_retry` | ✓ | ✓ | — | — | — | — | — | — | — | — | ✓ | — |
| `final_video.unpublish` | ✓ | ✓ | ◎ | — | — | — | — | — | — | — | ◎ | — |
| `publish_credential.manage` | — | — | — | — | — | — | — | — | — | — | — | — |

`publish_credential.manage` 仅允许 `platform_admin` 或专门的凭据管理员；项目角色只能选择已授权账号，不能读取密钥。

## 5. 数据、安全与运营命令

| 能力 | platform_admin | platform_operator | 项目 owner/admin | 其他项目角色 |
|---|---:|---:|---:|---:|
| 用户创建、禁用、重置认证 | ✓ | — | — | — |
| SSO/安全策略配置 | ✓ | — | — | — |
| 全局模型凭据与发布凭据 | ✓ | △（不可查看明文） | — | — |
| 项目级设置 | ✓（审计） | — | ✓ | 按显式权限 |
| 全局审计查询/导出 | ✓ | △ | — | — |
| 项目审计查询 | ✓ | △ | ✓ | 仅本人记录或显式授权 |
| 备份创建与校验 | ✓ | ✓ | 可发起项目导出 | — |
| 灾难恢复执行 | ✓（双人审批） | ◎ | — | — |
| 永久删除 | ✓（策略管理） | — | ◎（项目范围） | — |
| DLQ 重放/任务人工接管 | ✓ | ✓ | 可申请/查看项目结果 | — |

## 6. 授权计算规则

1. 系统身份验证通过后，先校验系统角色，再校验项目成员关系和项目角色。
2. 多项目角色的默认权限取并集；显式 `deny` 优先于角色 `allow`。
3. 权限覆盖必须建模为 `allow[]` 与 `deny[]`，不能继续用无法表达拒绝语义的单一字符串数组。
4. `owner` 唯一且不可被普通移除；转让必须使用专用命令。
5. 终审、永久删除、灾难恢复、凭据导出等高风险操作支持双人审批或重新认证。
6. owner/admin 的审核 `◎` 仅用于有审计的紧急覆盖或具备 reviewer 角色时的正常审核；不得绕过“不能审批本人作品”和成片两级审核人分离规则。
7. 资源范围至少支持 `project`、`assigned`、`created_by_me` 和显式资源 ID 集合。
8. 所有拒绝返回统一 `permission_denied`，但审计详情记录命中的策略，不向普通客户端泄露敏感规则。
9. 所有角色、权限覆盖和高风险操作变更写入不可篡改审计记录。

## 7. 验收要求

- 每个后端写路由必须映射一个权限键，禁止仅校验菜单或前端按钮。
- 每个权限键至少包含允许、拒绝、跨项目访问和角色组合测试。
- 项目归档、对象状态和权限三类门禁必须分别测试，不能把状态冲突误报为权限错误。
- 旧 `ProjectMemberRole` 迁移必须有映射、无法映射报告、回滚和数据核对。
- 权限矩阵变更必须由产品、安全、后端和测试共同评审。
