/**
 * @file publish-plan.tsx
 * @description 发布计划组件，管理视频发布计划和排期
 */

"use client";

import { ShadcnSelect } from "@/components/ui/select";
import { useState } from "react";
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
  XCircle,
  AlertCircle,
  ChevronDown,
  Save,
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
        colorClass: "bg-orange-500/10 text-orange-400 border-orange-500/20",
      },
      executing: {
        icon: PlayCircle,
        text: "执行中",
        colorClass: "bg-blue-500/10 text-blue-400 border-blue-500/20",
      },
      completed: {
        icon: CheckCircle,
        text: "已完成",
        colorClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      },
      cancelled: {
        icon: XCircle,
        text: "已取消",
        colorClass: "bg-red-500/10 text-red-400 border-red-500/20",
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
      alert("请填写完整的计划信息");
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
      alert("请填写完整的计划信息");
      return;
    }
    onEditPlan?.(planId, form);
    setEditingPlanId(null);
    resetForm();
  };

  /**
   * 处理删除计划
   */
  const handleDelete = (planId: string) => {
    if (confirm("确定要删除这个发布计划吗？")) {
      onDeletePlan?.(planId);
    }
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
          <h2 className="text-lg font-semibold text-white">发布计划管理</h2>
          <p className="text-sm text-[#888]">管理发布计划，追踪发布进度</p>
        </div>
        {!showCreateForm && !editingPlanId && (
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            <span>创建发布计划</span>
          </button>
        )}
      </div>

      {/* 创建/编辑表单 */}
      {(showCreateForm || editingPlanId) && (
        <div className="rounded-xl border border-white/10 bg-[#1a1a1a] p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-medium text-white">
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
              className="text-sm text-[#888] transition-colors hover:text-white"
            >
              取消
            </button>
          </div>

          <div className="space-y-4">
            {/* 计划名称 */}
            <div>
              <label className="mb-2 block text-sm font-medium text-white">
                计划名称
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="输入计划名称"
                className="w-full rounded-lg border border-white/10 bg-[#202020] px-4 py-2 text-sm text-white placeholder-[#666] focus:border-white/20 focus:outline-none"
              />
            </div>

            {/* 计划日期 */}
            <div>
              <label className="mb-2 block text-sm font-medium text-white">
                计划日期
              </label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
                className="w-full rounded-lg border border-white/10 bg-[#202020] px-4 py-2 text-sm text-white focus:border-white/20 focus:outline-none"
              />
            </div>

            {/* 负责人 */}
            <div>
              <label className="mb-2 block text-sm font-medium text-white">
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
                <label className="mb-2 block text-sm font-medium text-white">
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
                  className="w-full rounded-lg border border-white/10 bg-[#202020] px-4 py-2 text-sm text-white focus:border-white/20 focus:outline-none"
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
              <label className="mb-2 block text-sm font-medium text-white">
                发布平台
              </label>
              <div className="flex flex-wrap gap-2">
                {platformOptions.map((platform) => (
                  <button
                    key={platform}
                    onClick={() => togglePlatform(platform)}
                    className={`rounded-lg border px-3 py-2 text-sm transition-colors ${form.platforms.includes(platform)
                        ? "border-blue-500/50 bg-blue-500/10 text-blue-400"
                        : "border-white/10 bg-[#202020] text-[#888] hover:border-white/20"
                      }`}
                  >
                    {getPlatformName(platform)}
                  </button>
                ))}
              </div>
              {form.platforms.length === 0 && (
                <p className="mt-1 text-xs text-[#666]">请至少选择一个发布平台</p>
              )}
            </div>

            {/* 包含的成片 */}
            <div>
              <label className="mb-2 block text-sm font-medium text-white">
                包含的成片
              </label>
              <div className="max-h-60 space-y-2 overflow-y-auto rounded-lg border border-white/10 bg-[#202020] p-3">
                {availableVideos.length > 0 ? (
                  availableVideos.map((video) => (
                    <button
                      key={video.id}
                      onClick={() => toggleVideo(video.id)}
                      className={`w-full rounded-lg border p-3 text-left transition-colors ${form.videoIds.includes(video.id)
                          ? "border-blue-500/50 bg-blue-500/10"
                          : "border-white/5 bg-[#1a1a1a] hover:border-white/10"
                        }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Video className="h-4 w-4 text-blue-400" />
                          <span className="text-sm font-medium text-white">
                            {video.name}
                          </span>
                        </div>
                        {form.videoIds.includes(video.id) && (
                          <CheckCircle className="h-4 w-4 text-blue-400" />
                        )}
                      </div>
                      <div className="mt-1 text-xs text-[#888]">
                        {video.projectName} · {Math.floor(video.duration / 60)}:{(video.duration % 60).toString().padStart(2, "0")}
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="py-8 text-center text-[#666]">暂无可用的成片</div>
                )}
              </div>
              <p className="mt-1 text-xs text-[#888]">
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
                className="rounded-lg border border-white/10 bg-[#202020] px-4 py-2 text-sm text-[#888] transition-colors hover:border-white/20 hover:text-white"
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
                className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
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
                  className="rounded-xl border border-white/10 bg-[#1a1a1a] p-5 transition-colors hover:border-white/20"
                >
                  {/* 头部信息 */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <Calendar className="h-5 w-5 text-blue-400" />
                        <h3 className="text-base font-semibold text-white">{plan.name}</h3>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-[#888]">
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
                    <p className="mb-2 text-xs text-[#888]">发布平台:</p>
                    <div className="flex flex-wrap gap-2">
                      {plan.platforms.map((platform) => (
                        <span
                          key={platform}
                          className="rounded-md bg-white/5 px-3 py-1.5 text-sm text-[#888]"
                        >
                          {getPlatformName(platform)}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* 包含的成片 */}
                  <div className="mt-4">
                    <p className="mb-2 text-xs text-[#888]">包含的成片:</p>
                    <div className="max-h-32 overflow-y-auto">
                      <div className="flex flex-wrap gap-2">
                        {plan.videos.map((video) => (
                          <div
                            key={video.id}
                            className="flex items-center gap-2 rounded-lg border border-white/5 bg-[#202020] px-3 py-2"
                          >
                            <Video className="h-3.5 w-3.5 text-blue-400" />
                            <span className="text-sm text-white">{video.name}</span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs ${video.publishStatus === "published"
                                  ? "bg-emerald-500/10 text-emerald-400"
                                  : "bg-orange-500/10 text-orange-400"
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
                        <span className="text-xs text-[#888]">发布进度</span>
                        <span className="text-xs text-white">
                          {plan.videos.filter((v) => v.publishStatus === "published").length} / {plan.videos.length}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-white/5">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-blue-500 transition-all"
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
                      className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#202020] px-3 py-1.5 text-xs text-[#888] transition-colors hover:border-white/20 hover:text-white"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                      <span>编辑</span>
                    </button>
                    <button
                      onClick={() => handleDelete(plan.id)}
                      className="flex items-center gap-1.5 rounded-lg border border-red-500/10 bg-red-500/5 px-3 py-1.5 text-xs text-red-400 transition-colors hover:border-red-500/20 hover:bg-red-500/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>删除</span>
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="rounded-xl border border-white/10 bg-[#1a1a1a] p-12 text-center">
              <Calendar className="mx-auto h-16 w-16 text-[#666]" />
              <h3 className="mt-4 text-lg font-medium text-white">暂无发布计划</h3>
              <p className="mt-2 text-sm text-[#888]">创建发布计划来管理和追踪发布进度</p>
              <button
                onClick={() => setShowCreateForm(true)}
                className="mt-6 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 px-6 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
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
        <div className="rounded-xl border border-white/10 bg-[#1a1a1a] p-4">
          <div className="grid grid-cols-4 gap-4 text-center text-sm">
            <div>
              <div className="text-[#888]">总计划数</div>
              <div className="mt-1 text-lg font-bold text-white">{plans.length}</div>
            </div>
            <div>
              <div className="text-[#888]">计划中</div>
              <div className="mt-1 text-lg font-bold text-orange-400">
                {plans.filter((p) => p.status === "planned").length}
              </div>
            </div>
            <div>
              <div className="text-[#888]">执行中</div>
              <div className="mt-1 text-lg font-bold text-blue-400">
                {plans.filter((p) => p.status === "executing").length}
              </div>
            </div>
            <div>
              <div className="text-[#888]">已完成</div>
              <div className="mt-1 text-lg font-bold text-emerald-400">
                {plans.filter((p) => p.status === "completed").length}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}