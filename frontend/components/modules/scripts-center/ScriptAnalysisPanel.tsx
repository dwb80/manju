"use client";

/**
 * 剧本分析面板（提取角色/场景/道具）
 *
 * 功能：
 * - 调用 AI 分析剧本，提取角色、场景、道具
 * - 支持编辑提取出的资产内容
 * - 分析完成后提供"进入剧本编辑器"入口（不再做工厂流转）
 * - 重新分析时提示"重新分析中"
 */

import { useState } from "react";
import {
  BarChart3,
  Sparkles,
  Loader2,
  Users,
  Image as ImageIcon,
  Package,
  ExternalLink,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ShadcnSelect } from "@/components/ui/select";
import type { Script } from "@/lib/module-types";
import type { ExtractedAsset } from "./types";

export function ScriptAnalysisPanel({
  script,
  extractedAssets,
  isAnalyzing,
  analyzeStatus,
  onAnalyze,
  onOpenEditor,
  onUpdateAsset,
}: {
  script: Script;
  extractedAssets: ExtractedAsset[];
  isAnalyzing: boolean;
  /** 当前分析状态文案，用于区分"分析中"/"重新分析中" */
  analyzeStatus: string;
  onAnalyze: () => void;
  /** 跳转到剧本编辑器（在新标签页打开） */
  onOpenEditor: () => void;
  /** 更新单个资产内容（编辑保存） */
  onUpdateAsset: (id: string, patch: Partial<ExtractedAsset>) => void;
}) {
  const characters = extractedAssets.filter((a) => a.type === "character");
  const scenes = extractedAssets.filter((a) => a.type === "scene");
  const props = extractedAssets.filter((a) => a.type === "prop");

  return (
    <div className="space-y-4">
      {/* 统计卡片已移除：页面专注于「点击分析 → AI 调用 → 结果展示 → 进入编辑」流程。
          已导入剧本的字数 / 提取数量等统计信息可通过其他入口（剧本列表、剧本编辑器右侧）查看。 */}

      {/* 分析按钮 / 结果入口栏 */}
      {extractedAssets.length === 0 ? (
        <div className="text-center py-8">
          <BarChart3 className="h-12 w-12 text-[#666] mx-auto mb-3" />
          <p className="text-sm text-[#888] mb-4">点击下方按钮，AI将分析剧本内容并提取角色、场景、道具的文字描述</p>
          <Button onClick={onAnalyze} disabled={isAnalyzing}>
            {isAnalyzing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {analyzeStatus}
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                开始分析剧本
              </>
            )}
          </Button>
        </div>
      ) : (
        <>
          {/* 入口栏：总览 + 进入剧本编辑器 */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <div className="text-sm text-blue-200">
              共 <span className="font-bold text-blue-400">{extractedAssets.length}</span> 个资产
              <span className="text-blue-300/70 text-xs ml-2">
                角色 {characters.length} · 场景 {scenes.length} · 道具 {props.length}
              </span>
            </div>
            <Button onClick={onOpenEditor} size="sm">
              <ExternalLink className="mr-2 h-4 w-4" />
              进入剧本编辑器
            </Button>
          </div>

          {/* 角色资产 */}
          {characters.length > 0 && (
            <AssetSection
              title="角色资产"
              icon={Users}
              iconColor="text-blue-400"
              assets={characters}
              onUpdateAsset={onUpdateAsset}
            />
          )}

          {/* 场景资产 */}
          {scenes.length > 0 && (
            <AssetSection
              title="场景资产"
              icon={ImageIcon}
              iconColor="text-emerald-400"
              assets={scenes}
              onUpdateAsset={onUpdateAsset}
            />
          )}

          {/* 道具资产 */}
          {props.length > 0 && (
            <AssetSection
              title="道具资产"
              icon={Package}
              iconColor="text-yellow-400"
              assets={props}
              onUpdateAsset={onUpdateAsset}
            />
          )}

          {/* 重新分析按钮 */}
          <div className="text-center pt-2">
            <Button variant="ghost" size="sm" onClick={onAnalyze} disabled={isAnalyzing}>
              {isAnalyzing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {analyzeStatus}
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  重新分析
                </>
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

/** 资产分区组件（仅展示 + 编辑） */
function AssetSection({
  title,
  icon: Icon,
  iconColor,
  assets,
  onUpdateAsset,
}: {
  title: string;
  icon: typeof Users;
  iconColor: string;
  assets: ExtractedAsset[];
  onUpdateAsset: (id: string, patch: Partial<ExtractedAsset>) => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`h-4 w-4 ${iconColor}`} />
        <span className="text-sm font-medium text-white">{title}</span>
        <span className="text-xs text-[#888]">({assets.length})</span>
      </div>
      <div className="space-y-2">
        {assets.map((asset) => (
          <AssetCard key={asset.id} asset={asset} onUpdateAsset={onUpdateAsset} />
        ))}
      </div>
    </div>
  );
}

/** 单个资产卡片，支持内联编辑保存 */
function AssetCard({
  asset,
  onUpdateAsset,
}: {
  asset: ExtractedAsset;
  onUpdateAsset: (id: string, patch: Partial<ExtractedAsset>) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<ExtractedAsset>(asset);

  const startEdit = () => {
    setDraft(asset);
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setDraft(asset);
  };

  const saveEdit = () => {
    onUpdateAsset(asset.id, {
      name: draft.name,
      description: draft.description,
      role: draft.role,
      gender: draft.gender,
      sceneType: draft.sceneType,
      timeOfDay: draft.timeOfDay,
      lighting: draft.lighting,
      weather: draft.weather,
      category: draft.category,
      material: draft.material,
      color: draft.color,
    });
    setIsEditing(false);
  };

  return (
    <div className="p-3 rounded-lg border bg-white/5 border-white/10">
      <div className="flex-1 min-w-0">
        {isEditing ? (
          /* 编辑模式 */
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                className="flex-1 h-8 px-2 rounded bg-[#252525] border border-white/10 text-sm text-white focus:outline-none focus:border-emerald-500/50"
                placeholder="名称"
              />
              <Button size="sm" onClick={saveEdit} title="保存">
                <Check className="h-3 w-3 text-emerald-400" />
              </Button>
              <Button size="sm" variant="ghost" onClick={cancelEdit} title="取消">
                <X className="h-3 w-3" />
              </Button>
            </div>
            <textarea
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              rows={2}
              className="w-full px-2 py-1 rounded bg-[#252525] border border-white/10 text-xs text-white focus:outline-none focus:border-emerald-500/50 resize-none"
              placeholder="描述"
            />
            {/* 类型专属属性编辑 */}
            {asset.type === "character" && (
              <div className="flex flex-wrap gap-2">
                <ShadcnSelect
                  options={[
                    { value: "", label: "角色类型" },
                    { value: "protagonist", label: "主角" },
                    { value: "antagonist", label: "反派" },
                    { value: "supporting", label: "配角" },
                    { value: "minor", label: "次要" },
                  ]}
                  value={draft.role ?? ""}
                  onChange={(value) => setDraft({ ...draft, role: value })}
                  className="h-7 text-xs min-w-[110px]"
                />
                <ShadcnSelect
                  options={[
                    { value: "", label: "性别" },
                    { value: "male", label: "男" },
                    { value: "female", label: "女" },
                    { value: "other", label: "其他" },
                  ]}
                  value={draft.gender ?? ""}
                  onChange={(value) => setDraft({ ...draft, gender: value })}
                  className="h-7 text-xs min-w-[80px]"
                />
              </div>
            )}
            {asset.type === "scene" && (
              <div className="flex flex-wrap gap-2">
                <ShadcnSelect
                  options={[
                    { value: "", label: "场景类型" },
                    { value: "indoor", label: "室内" },
                    { value: "outdoor", label: "室外" },
                  ]}
                  value={draft.sceneType ?? ""}
                  onChange={(value) => setDraft({ ...draft, sceneType: value })}
                  className="h-7 text-xs min-w-[100px]"
                />
                <input
                  type="text"
                  value={draft.timeOfDay ?? ""}
                  onChange={(e) => setDraft({ ...draft, timeOfDay: e.target.value })}
                  className="h-7 w-20 px-1 rounded bg-[#252525] border border-white/10 text-xs text-white"
                  placeholder="时间"
                />
                <input
                  type="text"
                  value={draft.lighting ?? ""}
                  onChange={(e) => setDraft({ ...draft, lighting: e.target.value })}
                  className="h-7 w-20 px-1 rounded bg-[#252525] border border-white/10 text-xs text-white"
                  placeholder="光线"
                />
              </div>
            )}
            {asset.type === "prop" && (
              <div className="flex flex-wrap gap-2">
                <select
                  value={draft.category ?? ""}
                  onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                  className="h-7 px-1 rounded bg-[#252525] border border-white/10 text-xs text-white"
                >
                  <option value="">类别</option>
                  <option value="weapon">武器</option>
                  <option value="tool">工具</option>
                  <option value="clothing">服饰</option>
                  <option value="vehicle">交通工具</option>
                  <option value="artifact">神器</option>
                  <option value="furniture">家具</option>
                  <option value="other">其他</option>
                </select>
                <input
                  type="text"
                  value={draft.material ?? ""}
                  onChange={(e) => setDraft({ ...draft, material: e.target.value })}
                  className="h-7 w-20 px-1 rounded bg-[#252525] border border-white/10 text-xs text-white"
                  placeholder="材质"
                />
                <input
                  type="text"
                  value={draft.color ?? ""}
                  onChange={(e) => setDraft({ ...draft, color: e.target.value })}
                  className="h-7 w-20 px-1 rounded bg-[#252525] border border-white/10 text-xs text-white"
                  placeholder="颜色"
                />
              </div>
            )}
          </div>
        ) : (
          /* 查看模式 */
          <>
            <div className="flex items-center gap-2">
              <span className="font-medium text-white text-sm">{asset.name}</span>
              {/* 编辑按钮 */}
              <button
                onClick={startEdit}
                className="ml-1 p-0.5 rounded text-[#888] hover:text-emerald-400 hover:bg-white/5"
                title="编辑"
              >
                <Pencil className="h-3 w-3" />
              </button>
            </div>
            <div className="text-xs text-[#888] mt-1">{asset.description}</div>
            {/* 资产属性 */}
            <div className="flex flex-wrap gap-2 mt-1 text-xs text-[#666]">
              {asset.type === "character" && (
                <>
                  {asset.role && <span>角色: {asset.role}</span>}
                  {asset.gender && <span>性别: {asset.gender}</span>}
                </>
              )}
              {asset.type === "scene" && (
                <>
                  {asset.sceneType && <span>类型: {asset.sceneType}</span>}
                  {asset.timeOfDay && <span>时间: {asset.timeOfDay}</span>}
                  {asset.lighting && <span>光线: {asset.lighting}</span>}
                </>
              )}
              {asset.type === "prop" && (
                <>
                  {asset.category && <span>类别: {asset.category}</span>}
                  {asset.material && <span>材质: {asset.material}</span>}
                  {asset.color && <span>颜色: {asset.color}</span>}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
