/**
 * @file resource-monitor.tsx
 * @description AI资源监控组件，实时展示GPU、CPU、队列等资源使用情况
 */
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
      text: "text-info",
      bg: "bg-info",
      bgLight: "bg-info/20",
    },
    purple: {
      text: "text-chart-1",
      bg: "bg-chart-1",
      bgLight: "bg-chart-1/20",
    },
    cyan: {
      text: "text-chart-2",
      bg: "bg-chart-2",
      bgLight: "bg-chart-2/20",
    },
    emerald: {
      text: "text-primary",
      bg: "bg-primary",
      bgLight: "bg-primary/20",
    },
  };

  const colors = colorConfig[color];

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${colors.bgLight}`}>
            <Icon className={`h-4 w-4 ${colors.text}`} />
          </div>
          <span className="text-sm text-muted-foreground">{label}</span>
        </div>
        <span className={`text-lg font-bold ${colors.text}`}>
          {value}
          {unit}
        </span>
      </div>

      {showProgress && (
        <div className="space-y-1">
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full ${colors.bg} transition-all duration-300`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0%</span>
            <span>{progress}%</span>
            <span>100%</span>
          </div>
        </div>
      )}
    </div>
  );
});

/**
 * ResourceMonitor - AI资源监控组件
 * @param {ResourceMonitorProps} props - 组件属性
 * @param {ResourceMonitorData} props.data - 资源监控数据
 * @returns {JSX.Element} 渲染的资源监控界面
 */
export const ResourceMonitor = memo(function ResourceMonitor({
  data,
}: ResourceMonitorProps) {
  return (
    <div className="rounded-xl border border-border bg-secondary p-6">
      {/* 标题 */}
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-chart-2/20 to-info/20">
          <Gauge className="h-5 w-5 text-chart-2" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground">AI资源监控</h2>
          <p className="text-sm text-muted-foreground">任务队列与运行环境遥测</p>
        </div>
      </div>

      {/* 资源网格 */}
      <div className="grid grid-cols-2 gap-4">
        {data.telemetryAvailable ? (
          <>
            <ResourceItem icon={Cpu} label="GPU使用率" value={data.gpuUsage} unit="%" showProgress progress={data.gpuUsage} color="blue" />
            <ResourceItem icon={HardDrive} label="CPU使用率" value={data.cpuUsage} unit="%" showProgress progress={data.cpuUsage} color="purple" />
          </>
        ) : (
          <div className="col-span-2 rounded-lg border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
            CPU/GPU 遥测尚未接入，当前不展示模拟利用率。
          </div>
        )}

        {/* 队列长度 */}
        <ResourceItem
          icon={ListOrdered}
          label="队列长度"
          value={data.queueLength}
          color="cyan"
        />

        {data.telemetryAvailable && <ResourceItem icon={Users} label="Worker数量" value={data.workerCount} color="emerald" />}
      </div>
    </div>
  );
});

export default ResourceMonitor;
