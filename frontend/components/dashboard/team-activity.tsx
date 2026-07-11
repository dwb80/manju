"use client";

import { memo } from "react";
import {
  GitCommit,
  Image,
  Video,
  FileText,
  CheckCircle2,
  MessageSquare,
  UserPlus,
  Settings,
  Clock,
} from "lucide-react";
import type { TeamActivity as TeamActivityData } from "@/lib/app-types";

/** 团队动态组件Props */
export interface TeamActivityProps {
  /** 活动列表 */
  activities: TeamActivityData[];
  /** 最大显示数量 */
  maxItems?: number;
}

/** 格式化时间 */
function formatTimeAgo(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diff = now.getTime() - d.getTime();

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 7) return `${days}天前`;
  return d.toLocaleDateString("zh-CN");
}

/** 活动项组件 */
const ActivityItemRow = memo(function ActivityItemRow({ activity }: { activity: TeamActivityData }) {
  return (
    <div className="flex gap-3 py-3">
      {/* 时间线 */}
      <div className="flex flex-col items-center">
        {/* 头像 */}
        <div className="relative">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-500/30 to-purple-500/30 text-xs font-medium text-white">
            {activity.user.slice(0, 2)}
          </div>
          {/* 活动类型图标 */}
          <div className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500/20">
            <GitCommit className="h-2.5 w-2.5 text-blue-400" />
          </div>
        </div>

        {/* 连接线 */}
        <div className="h-full w-px bg-white/10"></div>
      </div>

      {/* 内容 */}
      <div className="min-w-0 flex-1 pb-3">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm text-white">
            <span className="font-medium">{activity.user}</span>
            <span className="text-[#888]"> {activity.action} </span>
            <span className="text-white">{activity.target}</span>
          </p>
          <span className="flex items-center gap-1 text-xs text-[#666]">
            <Clock className="h-3 w-3" />
            {formatTimeAgo(activity.createdAt)}
          </span>
        </div>
      </div>
    </div>
  );
});

/** 团队动态组件 */
export const TeamActivity = memo(function TeamActivity({
  activities,
  maxItems = 10,
}: TeamActivityProps) {
  const displayActivities = activities.slice(0, maxItems);

  return (
    <div className="rounded-xl border border-white/10 bg-[#252525] p-6">
      {/* 标题 */}
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500/20 to-violet-500/20">
          <GitCommit className="h-5 w-5 text-indigo-400" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">团队动态</h2>
          <p className="text-sm text-[#888]">团队成员操作记录</p>
        </div>
      </div>

      {/* 活动列表 */}
      <div className="relative">
        {displayActivities.map((activity, index) => (
          <div key={activity.id}>
            <ActivityItemRow activity={activity} />
            {index < displayActivities.length - 1 && (
              <div className="ml-4 border-t border-white/5"></div>
            )}
          </div>
        ))}
      </div>

      {/* 空状态 */}
      {activities.length === 0 && (
        <div className="flex h-40 flex-col items-center justify-center">
          <GitCommit className="mb-2 h-12 w-12 text-[#333]" />
          <p className="text-sm text-[#666]">暂无团队动态</p>
        </div>
      )}

      {/* 查看更多 */}
      {activities.length > maxItems && (
        <div className="mt-4 border-t border-white/10 pt-4 text-center">
          <button className="text-sm text-blue-400 hover:text-blue-300">
            查看更多 ({activities.length - maxItems} 条)
          </button>
        </div>
      )}
    </div>
  );
});

export default TeamActivity;