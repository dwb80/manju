/**
 * @file publish-plan.tsx
 * @description 发布计划组件，管理视频发布计划和排期
 */

"use client";

import { ShadcnSelect } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { useState } from "react";
import { notify } from "@/lib/notify";
import {
  Calendar,
  Plus,
  Edit2,
  Trash2,
  Clock,
  User,
  Video,
  CheckCircle,
  PlayCircle,
  XCircle, Save
} from "lucide-react";
import {
  PublishedVideo,
  PublishPlan as PublishPlanType,
  PublishPlatform,
} from "./published-videos-list";

/**
 * 发布计划表单数据类型
 */
export type PublishPlanForm = {
  /** 计划名称 */
  name: string;
  /** 计划状态 */
  status: "planned" | "executing" | "completed" | "cancelled";
  /** 计划日期 */
  date: string;
  /** 包含的成片ID列表 */
  videoIds: string[];
  /** 发布平台 */
  platforms: PublishPlatform[];
  /** 负责人 */
  owner: string;
};

/**
 * 发布计划组件Props
 */
export type PublishPlanProps = {
  /** 发布计划列表 */
  plans: PublishPlanType[];
  /** 可用的成片列表 */
  availableVideos: PublishedVideo[];
  /** 可用的负责人列表 */
  availableOwners: string[];
  /** 创建计划回调 */
  onCreatePlan?: (plan: PublishPlanForm) => void;
  /** 编辑计划回调 */
  onEditPlan?: (planId: string, plan: PublishPlanForm) => void;
  /** 删除计划回调 */
  onDeletePlan?: (planId: string) => void;
};

/**
 * 发布计划组件
 *
 * 功能：
 * - 显示发布计划列表
 * - 每个计划显示：名称、状态、日期、包含成片、发布平台、负责人
 * - 支持创建新计划
 * - 支持编辑计划
 * - 支持删除计划
 *
 * @param plans - 发布计划列表
 * @param availableVideos - 可用的成片列表
 * @param availableOwners - 可用的负责人列表
 * @param onCreatePlan - 创建计划回调
 * @param onEditPlan - 编辑计划回调
 * @param onDeletePlan - 删除计划回调
 */
export function PublishPlan({
  plans,
  availableVideos,
  availableOwners,
  onCreatePlan,
  onEditPlan,
  onDeletePlan,
}: PublishPlanProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [form, setForm] = useState<PublishPlanForm>({
    name: "",
    status: "planned",
    date: new Date().toISOString().split("T")[0],
    videoIds: [],
    platforms: [],
    owner: "",
  });

  /**
   * 获取平台中文名
   */
  const getPlatformName = (platform: PublishPlatform): string => {
    const platformNames: Record<PublishPlatform, string> = {
      douyin: "抖音",
      bilibili: "B站",
      weibo: "微博",
      xiaohongshu: "小红书",
      kuaishou: "快手",
      wechat: "微信视频号",
      youtube: "YouTube",
      other: "其他",
    };
    return platformNames[platform] || platform;
  };

  /**
   * 获取状态图标和颜色
   */
  const getStatusDisplay = (status: PublishPlanType["status"]) => {
    const statusMap = {
      planned: {
        icon: Clock,
        text: "计划中",
        colorClass: "bg-chart-3/10 text-chart-3 border-chart-3/20",
      },
      executing: {
        icon: PlayCircle,
        text: "执行中",
        colorClass: "bg-info/10 text-info border-info/20",
      },
      completed: {
        icon: CheckCircle,
        text: "已完成",
        colorClass: "bg-primary/10 text-primary border-primary/20",
      },
      cancelled: {
        icon: XCircle,
        text: "已取消",
        colorClass: "bg-destructive/10 text-destructive border-destructive/20",
      },
    };
    return statusMap[status];
  };

  /**
   * 格式化日期
   */
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  /**
   * 平台选项列表
   */
  const platformOptions: PublishPlatform[] = [
    "douyin",
    "bilibili",
    "weibo",
    "xiaohongshu",
    "kuaishou",
    "wechat",
    "youtube",
    "other",
  ];

  /**
   * 处理创建计划
   */
  const handleCreate = () => {
    if (!form.name || !form.date || !form.owner) {
      notify.warn("请填写完整的计划信息");
      return;
    }
    onCreatePlan?.(form);
    setShowCreateForm(false);
    resetForm();
  };

  /**
   * 处理编辑计划
   */
  const handleEdit = (planId: string) => {
    if (!form.name || !form.date || !form.owner) {
      notify.warn("请填写完整的计划信息");
      return;
    }
    onEditPlan?.(planId, form);
    setEditingPlanId(null);
    resetForm();
  };

  /**
   * 处理删除计划
   */
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const handleDelete = (planId: string) => {
    setPendingDeleteId(planId);
  };
  const confirmDelete = () => {
    if (pendingDeleteId) {
      onDeletePlan?.(pendingDeleteId);
    }
    setPendingDeleteId(null);
  };

  /**
   * 开始编辑计划
   */
  const startEdit = (plan: PublishPlanType) => {
    setEditingPlanId(plan.id);
    setForm({
      name: plan.name,
      status: plan.status,
      date: plan.date,
      videoIds: plan.videos.map((v) => v.id),
      platforms: plan.platforms,
      owner: plan.owner,
    });
  };

  /**
   * 重置表单
   */
  const resetForm = () => {
    setForm({
      name: "",
      status: "planned",
      date: new Date().toISOString().split("T")[0],
      videoIds: [],
      platforms: [],
      owner: "",
    });
  };

  /**
   * 切换平台选择
   */
  const togglePlatform = (platform: PublishPlatform) => {
    setForm((prev) => {
      const platforms = prev.platforms.includes(platform)
        ? prev.platforms.filter((p) => p !== platform)
        : [...prev.platforms, platform];
      return { ...prev, platforms };
    });
  };

  /**
   * 切换视频选择
   */
  const toggleVideo = (videoId: string) => {
    setForm((prev) => {
      const videoIds = prev.videoIds.includes(videoId)
        ? prev.videoIds.filter((id) => id !== videoId)
        : [...prev.videoIds, videoId];
      return { ...prev, videoIds };
    });
  };

  return (
    <div className="space-y-6">
      {/* 顶部工具栏 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">发布计划管理</h2>
          <p className="text-sm text-muted-foreground">管理发布计划，追踪发布进度</p>
        </div>
        {!showCreateForm && !editingPlanId && (
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-info to-chart-1 px-4 py-2 text-sm font-medium text-foreground transition-opacity hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            <span>创建发布计划</span>
          </button>
        )}
      </div>

      {/* 创建/编辑表单 */}
      {(showCreateForm || editingPlanId) && (
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-medium text-foreground">
              {editingPlanId ? "编辑发布计划" : "创建新发布计划"}
            </h3>
            <button
              onClick={() => {
                if (editingPlanId) {
                  setEditingPlanId(null);
                } else {
                  setShowCreateForm(false);
                }
                resetForm();
              }}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              取消
            </button>
          </div>

          <div className="space-y-4">
            {/* 计划名称 */}
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">
                计划名称
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="输入计划名称"
                className="w-full rounded-lg border border-border bg-muted px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-border focus:outline-none"
              />
            </div>

            {/* 计划日期 */}
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">
                计划日期
              </label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
                className="w-full rounded-lg border border-border bg-muted px-4 py-2 text-sm text-foreground focus:border-border focus:outline-none"
              />
            </div>

            {/* 负责人 */}
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">
                负责人
              </label>
              <ShadcnSelect
                options={[
                  { value: "", label: "选择负责人" },
                  ...availableOwners.map((o) => ({ value: o, label: o })),
                ]}
                value={form.owner}
                onChange={(value) => setForm((prev) => ({ ...prev, owner: value }))}
                className="h-10"
              />
            </div>

            {/* 计划状态 */}
            {editingPlanId && (
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  计划状态
                </label>
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      status: e.target.value as PublishPlanForm["status"],
                    }))
                  }
                  className="w-full rounded-lg border border-border bg-muted px-4 py-2 text-sm text-foreground focus:border-border focus:outline-none"
                >
                  <option value="planned">计划中</option>
                  <option value="executing">执行中</option>
                  <option value="completed">已完成</option>
                  <option value="cancelled">已取消</option>
                </select>
              </div>
            )}

            {/* 发布平台 */}
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">
                发布平台
              </label>
              <div className="flex flex-wrap gap-2">
                {platformOptions.map((platform) => (
                  <button
                    key={platform}
                    onClick={() => togglePlatform(platform)}
                    className={`rounded-lg border px-3 py-2 text-sm transition-colors ${form.platforms.includes(platform)
                        ? "border-info/50 bg-info/10 text-info"
                        : "border-border bg-muted text-muted-foreground hover:border-border"
                      }`}
                  >
                    {getPlatformName(platform)}
                  </button>
                ))}
              </div>
              {form.platforms.length === 0 && (
                <p className="mt-1 text-xs text-muted-foreground">请至少选择一个发布平台</p>
              )}
            </div>

            {/* 包含的成片 */}
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">
                包含的成片
              </label>
              <div className="max-h-60 space-y-2 overflow-y-auto rounded-lg border border-border bg-muted p-3">
                {availableVideos.length > 0 ? (
                  availableVideos.map((video) => (
                    <button
                      key={video.id}
                      onClick={() => toggleVideo(video.id)}
                      className={`w-full rounded-lg border p-3 text-left transition-colors ${form.videoIds.includes(video.id)
                          ? "border-info/50 bg-info/10"
                          : "border-border/50 bg-card hover:border-border"
                        }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Video className="h-4 w-4 text-info" />
                          <span className="text-sm font-medium text-foreground">
                            {video.name}
                          </span>
                        </div>
                        {form.videoIds.includes(video.id) && (
                          <CheckCircle className="h-4 w-4 text-info" />
                        )}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {video.projectName} · {Math.floor(video.duration / 60)}:{(video.duration % 60).toString().padStart(2, "0")}
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="py-8 text-center text-muted-foreground">暂无可用的成片</div>
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                已选择 {form.videoIds.length} 个成片
              </p>
            </div>

            {/* 操作按钮 */}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  if (editingPlanId) {
                    setEditingPlanId(null);
                  } else {
                    setShowCreateForm(false);
                  }
                  resetForm();
                }}
                className="rounded-lg border border-border bg-muted px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-border hover:text-foreground"
              >
                取消
              </button>
              <button
                onClick={() => {
                  if (editingPlanId) {
                    handleEdit(editingPlanId);
                  } else {
                    handleCreate();
                  }
                }}
                disabled={!form.name || !form.date || !form.owner}
                className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-info to-chart-1 px-4 py-2 text-sm font-medium text-foreground transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="h-4 w-4" />
                <span>{editingPlanId ? "保存修改" : "创建计划"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 计划列表 */}
      {!showCreateForm && !editingPlanId && (
        <div className="space-y-4">
          {plans.length > 0 ? (
            plans.map((plan) => {
              const statusDisplay = getStatusDisplay(plan.status);
              const StatusIcon = statusDisplay.icon;

              return (
                <div
                  key={plan.id}
                  className="rounded-xl border border-border bg-card p-5 transition-colors hover:border-border"
                >
                  {/* 头部信息 */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <Calendar className="h-5 w-5 text-info" />
                        <h3 className="text-base font-semibold text-foreground">{plan.name}</h3>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          <span>计划日期: {formatDate(plan.date)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <User className="h-4 w-4" />
                          <span>负责人: {plan.owner}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Video className="h-4 w-4" />
                          <span>{plan.videos.length} 个成片</span>
                        </div>
                      </div>
                    </div>

                    {/* 状态标签 */}
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium ${statusDisplay.colorClass}`}
                    >
                      <StatusIcon className="h-4 w-4" />
                      {statusDisplay.text}
                    </span>
                  </div>

                  {/* 发布平台 */}
                  <div className="mt-4">
                    <p className="mb-2 text-xs text-muted-foreground">发布平台:</p>
                    <div className="flex flex-wrap gap-2">
                      {plan.platforms.map((platform) => (
                        <span
                          key={platform}
                          className="rounded-md bg-muted/50 px-3 py-1.5 text-sm text-muted-foreground"
                        >
                          {getPlatformName(platform)}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* 包含的成片 */}
                  <div className="mt-4">
                    <p className="mb-2 text-xs text-muted-foreground">包含的成片:</p>
                    <div className="max-h-32 overflow-y-auto">
                      <div className="flex flex-wrap gap-2">
                        {plan.videos.map((video) => (
                          <div
                            key={video.id}
                            className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted px-3 py-2"
                          >
                            <Video className="h-3.5 w-3.5 text-info" />
                            <span className="text-sm text-foreground">{video.name}</span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs ${video.publishStatus === "published"
                                  ? "bg-primary/10 text-primary"
                                  : "bg-chart-3/10 text-chart-3"
                                }`}
                            >
                              {video.publishStatus === "published" ? "已发布" : "待发布"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* 进度统计 */}
                  {plan.videos.length > 0 && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-muted-foreground">发布进度</span>
                        <span className="text-xs text-foreground">
                          {plan.videos.filter((v) => v.publishStatus === "published").length} / {plan.videos.length}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted/50">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-primary to-info transition-all"
                          style={{
                            width: `${(plan.videos.filter((v) => v.publishStatus === "published").length /
                                plan.videos.length) *
                              100
                              }%`,
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* 操作按钮 */}
                  <div className="mt-4 flex items-center justify-end gap-2">
                    <button
                      onClick={() => startEdit(plan)}
                      className="flex items-center gap-1.5 rounded-lg border border-border bg-muted px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-border hover:text-foreground"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                      <span>编辑</span>
                    </button>
                    <button
                      onClick={() => handleDelete(plan.id)}
                      className="flex items-center gap-1.5 rounded-lg border border-destructive/10 bg-destructive/5 px-3 py-1.5 text-xs text-destructive transition-colors hover:border-destructive/20 hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>删除</span>
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="rounded-xl border border-border bg-card p-12 text-center">
              <Calendar className="mx-auto h-16 w-16 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-medium text-foreground">暂无发布计划</h3>
              <p className="mt-2 text-sm text-muted-foreground">创建发布计划来管理和追踪发布进度</p>
              <button
                onClick={() => setShowCreateForm(true)}
                className="mt-6 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-info to-chart-1 px-6 py-3 text-sm font-medium text-foreground transition-opacity hover:opacity-90"
              >
                <Plus className="h-4 w-4" />
                <span>创建发布计划</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* 统计信息 */}
      {!showCreateForm && !editingPlanId && plans.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="grid grid-cols-4 gap-4 text-center text-sm">
            <div>
              <div className="text-muted-foreground">总计划数</div>
              <div className="mt-1 text-lg font-bold text-foreground">{plans.length}</div>
            </div>
            <div>
              <div className="text-muted-foreground">计划中</div>
              <div className="mt-1 text-lg font-bold text-chart-3">
                {plans.filter((p) => p.status === "planned").length}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">执行中</div>
              <div className="mt-1 text-lg font-bold text-info">
                {plans.filter((p) => p.status === "executing").length}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">已完成</div>
              <div className="mt-1 text-lg font-bold text-primary">
                {plans.filter((p) => p.status === "completed").length}
              </div>
            </div>
          </div>
        </div>
      )}

      {pendingDeleteId && (
        <ConfirmDialog
          title="删除发布计划"
          description="确定要删除这个发布计划吗？此操作不可撤销。"
          confirmLabel="确认删除"
          onClose={() => setPendingDeleteId(null)}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  );
}
