"use client";

import { memo } from "react";
import { Cpu, HardDrive, ListOrdered, Users, Gauge } from "lucide-react";
import type { ResourceMonitorData } from "@/lib/app-types";

/** AI资源监控组件Props */
export interface ResourceMonitorProps {
  /** 资源监控数据 */
  data: ResourceMonitorData;
}

/** 资源项组件 */
const ResourceItem = memo(function ResourceItem({
  icon: Icon,
  label,
  value,
  showProgress = false,
  progress = 0,
  color = "blue",
  unit = "",
}: {
  icon: typeof Cpu;
  label: string;
  value: number;
  showProgress?: boolean;
  progress?: number;
  color?: "blue" | "purple" | "cyan" | "emerald";
  unit?: string;
}) {
  const colorConfig = {
    blue: {
      text: "text-blue-400",
      bg: "bg-blue-500",
      bgLight: "bg-blue-500/20",
    },
    purple: {
      text: "text-purple-400",
      bg: "bg-purple-500",
      bgLight: "bg-purple-500/20",
    },
    cyan: {
      text: "text-cyan-400",
      bg: "bg-cyan-500",
      bgLight: "bg-cyan-500/20",
    },
    emerald: {
      text: "text-emerald-400",
      bg: "bg-emerald-500",
      bgLight: "bg-emerald-500/20",
    },
  };

  const colors = colorConfig[color];

  return (
    <div className="rounded-lg border border-white/10 bg-[#1a1a1a] p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${colors.bgLight}`}>
            <Icon className={`h-4 w-4 ${colors.text}`} />
          </div>
          <span className="text-sm text-[#888]">{label}</span>
        </div>
        <span className={`text-lg font-bold ${colors.text}`}>
          {value}
          {unit}
        </span>
      </div>

      {showProgress && (
        <div className="space-y-1">
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className={`h-full rounded-full ${colors.bg} transition-all duration-300`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-[#666]">
            <span>0%</span>
            <span>{progress}%</span>
            <span>100%</span>
          </div>
        </div>
      )}
    </div>
  );
});

/** AI资源监控组件 */
export const ResourceMonitor = memo(function ResourceMonitor({
  data,
}: ResourceMonitorProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#252525] p-6">
      {/* 标题 */}
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20">
          <Gauge className="h-5 w-5 text-cyan-400" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">AI资源监控</h2>
          <p className="text-sm text-[#888]">实时资源使用情况</p>
        </div>
      </div>

      {/* 资源网格 */}
      <div className="grid grid-cols-2 gap-4">
        {/* GPU使用率 */}
        <ResourceItem
          icon={Cpu}
          label="GPU使用率"
          value={data.gpuUsage}
          unit="%"
          showProgress
          progress={data.gpuUsage}
          color="blue"
        />

        {/* CPU使用率 */}
        <ResourceItem
          icon={HardDrive}
          label="CPU使用率"
          value={data.cpuUsage}
          unit="%"
          showProgress
          progress={data.cpuUsage}
          color="purple"
        />

        {/* 队列长度 */}
        <ResourceItem
          icon={ListOrdered}
          label="队列长度"
          value={data.queueLength}
          color="cyan"
        />

        {/* Worker数量 */}
        <ResourceItem
          icon={Users}
          label="Worker数量"
          value={data.workerCount}
          color="emerald"
        />
      </div>
    </div>
  );
});

export default ResourceMonitor;