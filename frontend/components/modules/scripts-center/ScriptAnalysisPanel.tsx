"use client";

/**
 * 剧本分析面板（提取角色/场景/道具）
 *
 * 功能：
 * - 调用 AI 分析剧本，提取角色、场景、道具
 * - 支持编辑、保存提取出的资产内容
 * - 支持按类型转入角色工厂、场景工厂、道具工厂
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
  ArrowRight,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Script } from "@/lib/module-types";
import type { ExtractedAsset } from "./types";

export function ScriptAnalysisPanel({
  script,
  extractedAssets,
  isAnalyzing,
  isTransferring,
  analyzeStatus,
  onAnalyze,
  onToggleAsset,
  onConfirmAll,
  onTransfer,
  onTransferByType,
  onUpdateAsset,
}: {
  script: Script;
  extractedAssets: ExtractedAsset[];
  isAnalyzing: boolean;
  isTransferring: boolean;
  /** 当前分析状态文案，用于区分"分析中"/"重新分析中" */
  analyzeStatus: string;
  onAnalyze: () => void;
  onToggleAsset: (id: string) => void;
  onConfirmAll: (type: "character" | "scene" | "prop", confirm: boolean) => void;
  onTransfer: () => void;
  /** 按类型流转到对应工厂 */
  onTransferByType: (type: "character" | "scene" | "prop") => void;
  /** 更新单个资产内容（编辑保存） */
  onUpdateAsset: (id: string, patch: Partial<ExtractedAsset>) => void;
}) {
  const description = script.description ?? "";
  const wordCount = script.words ?? description.replace(/\s/g, "").length;

  const characters = extractedAssets.filter((a) => a.type === "character");
  const scenes = extractedAssets.filter((a) => a.type === "scene");
  const props = extractedAssets.filter((a) => a.type === "prop");
  const confirmedCount = extractedAssets.filter((a) => a.confirmed).length;

  return (
    <div className="space-y-4">
      {/* 剧本基本信息 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white/5 rounded-lg p-3">
          <div className="text-xs text-[#888] mb-1">总字数</div>
          <div className="text-lg font-bold text-white">{wordCount.toLocaleString()}</div>
        </div>
        <div className="bg-white/5 rounded-lg p-3">
          <div className="text-xs text-[#888] mb-1">提取角色</div>
          <div className="text-lg font-bold text-blue-400">{characters.length}</div>
        </div>
        <div className="bg-white/5 rounded-lg p-3">
          <div className="text-xs text-[#888] mb-1">提取场景</div>
          <div className="text-lg font-bold text-emerald-400">{scenes.length}</div>
        </div>
        <div className="bg-white/5 rounded-lg p-3">
          <div className="text-xs text-[#888] mb-1">提取道具</div>
          <div className="text-lg font-bold text-yellow-400">{props.length}</div>
        </div>
      </div>

      {/* 分析按钮 */}
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
          {/* 流转操作栏 */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <div className="text-sm text-blue-200">
              已确认 <span className="font-bold text-blue-400">{confirmedCount}</span> / {extractedAssets.length} 个资产
            </div>
            <Button onClick={onTransfer} disabled={isTransferring || confirmedCount === 0} size="sm">
              {isTransferring ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  流转中...
                </>
              ) : (
                <>
                  <ArrowRight className="mr-2 h-4 w-4" />
                  确认并流转到工厂
                </>
              )}
            </Button>
          </div>

          {/* 角色资产 */}
          {characters.length > 0 && (
            <AssetSection
              title="角色资产"
              icon={Users}
              iconColor="text-blue-400"
              targetFactory="角色工厂"
              assets={characters}
              onToggle={onToggleAsset}
              onConfirmAll={(confirm) => onConfirmAll("character", confirm)}
              onTransferToFactory={() => onTransferByType("character")}
              isTransferring={isTransferring}
              onUpdateAsset={onUpdateAsset}
            />
          )}

          {/* 场景资产 */}
          {scenes.length > 0 && (
            <AssetSection
              title="场景资产"
              icon={ImageIcon}
              iconColor="text-emerald-400"
              targetFactory="场景工厂"
              assets={scenes}
              onToggle={onToggleAsset}
              onConfirmAll={(confirm) => onConfirmAll("scene", confirm)}
              onTransferToFactory={() => onTransferByType("scene")}
              isTransferring={isTransferring}
              onUpdateAsset={onUpdateAsset}
            />
          )}

          {/* 道具资产 */}
          {props.length > 0 && (
            <AssetSection
              title="道具资产"
              icon={Package}
              iconColor="text-yellow-400"
              targetFactory="道具工厂"
              assets={props}
              onToggle={onToggleAsset}
              onConfirmAll={(confirm) => onConfirmAll("prop", confirm)}
              onTransferToFactory={() => onTransferByType("prop")}
              isTransferring={isTransferring}
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

/** 资产分区组件 */
function AssetSection({
  title,
  icon: Icon,
  iconColor,
  targetFactory,
  assets,
  onToggle,
  onConfirmAll,
  onTransferToFactory,
  isTransferring,
  onUpdateAsset,
}: {
  title: string;
  icon: typeof Users;
  iconColor: string;
  targetFactory: string;
  assets: ExtractedAsset[];
  onToggle: (id: string) => void;
  onConfirmAll: (confirm: boolean) => void;
  onTransferToFactory: () => void;
  isTransferring: boolean;
  onUpdateAsset: (id: string, patch: Partial<ExtractedAsset>) => void;
}) {
  const confirmedCount = assets.filter((a) => a.confirmed).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${iconColor}`} />
          <span className="text-sm font-medium text-white">{title}</span>
          <span className="text-xs text-[#888]">({confirmedCount}/{assets.length} 已确认)</span>
          <span className="text-xs text-[#666]">→ {targetFactory}</span>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => onConfirmAll(true)}
            className="px-2 py-0.5 rounded text-xs bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
          >
            全选
          </button>
          <button
            onClick={() => onConfirmAll(false)}
            className="px-2 py-0.5 rounded text-xs bg-white/5 text-[#888] hover:bg-white/10"
          >
            取消全选
          </button>
          {/* 转入对应工厂按钮 */}
          <button
            onClick={onTransferToFactory}
            disabled={isTransferring || confirmedCount === 0}
            className="px-2 py-0.5 rounded text-xs bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
            title={`将已确认的资产转入${targetFactory}`}
          >
            转入{targetFactory}
          </button>
        </div>
      </div>
      <div className="space-y-2">
        {assets.map((asset) => (
          <AssetCard
            key={asset.id}
            asset={asset}
            onToggle={onToggle}
            onUpdateAsset={onUpdateAsset}
          />
        ))}
      </div>
    </div>
  );
}

/** 单个资产卡片，支持内联编辑保存 */
function AssetCard({
  asset,
  onToggle,
  onUpdateAsset,
}: {
  asset: ExtractedAsset;
  onToggle: (id: string) => void;
  onUpdateAsset: (id: string, patch: Partial<ExtractedAsset>) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<ExtractedAsset>(asset);
  const isTransferred = asset.id.startsWith("transferred-");

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
    <div
      className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
        asset.confirmed
          ? "bg-emerald-500/5 border-emerald-500/30"
          : "bg-white/5 border-white/10"
      } ${isTransferred ? "opacity-50" : ""}`}
    >
      <input
        type="checkbox"
        checked={asset.confirmed}
        onChange={() => onToggle(asset.id)}
        disabled={isTransferred}
        className="mt-1 h-4 w-4 rounded accent-emerald-500"
      />
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
                <select
                  value={draft.role ?? ""}
                  onChange={(e) => setDraft({ ...draft, role: e.target.value })}
                  className="h-7 px-1 rounded bg-[#252525] border border-white/10 text-xs text-white"
                >
                  <option value="">角色类型</option>
                  <option value="protagonist">主角</option>
                  <option value="antagonist">反派</option>
                  <option value="supporting">配角</option>
                  <option value="minor">次要</option>
                </select>
                <select
                  value={draft.gender ?? ""}
                  onChange={(e) => setDraft({ ...draft, gender: e.target.value })}
                  className="h-7 px-1 rounded bg-[#252525] border border-white/10 text-xs text-white"
                >
                  <option value="">性别</option>
                  <option value="male">男</option>
                  <option value="female">女</option>
                  <option value="other">其他</option>
                </select>
              </div>
            )}
            {asset.type === "scene" && (
              <div className="flex flex-wrap gap-2">
                <select
                  value={draft.sceneType ?? ""}
                  onChange={(e) => setDraft({ ...draft, sceneType: e.target.value })}
                  className="h-7 px-1 rounded bg-[#252525] border border-white/10 text-xs text-white"
                >
                  <option value="">场景类型</option>
                  <option value="indoor">室内</option>
                  <option value="outdoor">室外</option>
                </select>
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
              {isTransferred && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">已流转</span>
              )}
              {/* 编辑按钮 */}
              {!isTransferred && (
                <button
                  onClick={startEdit}
                  className="ml-1 p-0.5 rounded text-[#888] hover:text-emerald-400 hover:bg-white/5"
                  title="编辑"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              )}
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
