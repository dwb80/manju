"use client";

/**
 * 剧本工作台：资产库（assets）tab
 *
 * - 搜索 / 标签筛选 / 收藏筛选 / 资产类型切换
 * - 资产表单（name / tags / image_url / video_url / folder / resolution / duration / prompt / role_traits / style_keywords）
 * - 资产列表（预览 / 名称 / 类型 / 标签 / 媒体信息 / 操作）
 */

import { Check, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ShadcnSelect } from "@/components/ui/select";
import { ManagementTable as ProjectManagementTable, WorkbenchPager as ProjectWorkbenchPager } from "@/components/project/project-workbench";
import type { ProjectAssetKind } from "@/lib/app-types";
import type { ProjectWorkbenchTabsProps } from "./types";

export function AssetsTab(props: Pick<
  ProjectWorkbenchTabsProps,
  "projectAssets" | "filteredProjectAssets" | "pagedProjectAssets" |
  "currentWorkbenchPageNumber" | "workbenchPageSize" | "setCurrentWorkbenchPage" |
  "editingAssetId" | "assetComposerKind" | "setAssetComposerKind" | "currentAssetDraft" | "setAssetDrafts" |
  "resetProjectAssetForm" | "submitProjectAssetForm" | "editProjectAssetItem" | "deleteProjectAssetItem" |
  "reuseProjectAsset" | "toggleProjectAssetFavorite" | "projectAssetReferenceUrls" | "continueEditImage" | "copy" |
  "projectAssetKinds" | "assetKindCounts" | "assetSearch" | "setAssetSearch" | "assetKindFilter" | "setAssetKindFilter" | "assetTagFilter" | "setAssetTagFilter" | "assetFavoriteOnly" | "setAssetFavoriteOnly"
>) {
  const {
    projectAssets, filteredProjectAssets, pagedProjectAssets,
    currentWorkbenchPageNumber, workbenchPageSize, setCurrentWorkbenchPage,
    editingAssetId, assetComposerKind, setAssetComposerKind, currentAssetDraft, setAssetDrafts,
    resetProjectAssetForm, submitProjectAssetForm, editProjectAssetItem, deleteProjectAssetItem,
    reuseProjectAsset, toggleProjectAssetFavorite, projectAssetReferenceUrls, continueEditImage, copy,
    projectAssetKinds, assetKindCounts, assetSearch, setAssetSearch, assetKindFilter, setAssetKindFilter, assetTagFilter, setAssetTagFilter, assetFavoriteOnly, setAssetFavoriteOnly,
  } = props;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">资产库</div>
          <div className="text-xs text-[#b4b4b4]">素材统一管理，点击复用可直接带入生成输入区。</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            className="h-8 w-40 rounded-lg border border-white/10 bg-[#202020] px-3 text-xs text-white outline-none focus:border-emerald-500"
            value={assetSearch}
            placeholder="搜索资产"
            onChange={(event) => setAssetSearch(event.target.value)}
          />
          <input
            className="h-8 w-32 rounded-lg border border-white/10 bg-[#202020] px-3 text-xs text-white outline-none focus:border-emerald-500"
            value={assetTagFilter}
            placeholder="标签筛选"
            onChange={(event) => setAssetTagFilter(event.target.value)}
          />
          <Button size="sm" variant={assetFavoriteOnly ? "default" : "secondary"} onClick={() => setAssetFavoriteOnly((value) => !value)}>
            <Star className={`h-4 w-4 ${assetFavoriteOnly ? "fill-current" : ""}`} />收藏
          </Button>
        </div>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 flex-wrap">
        <button
          className={`shrink-0 rounded-lg border px-4 py-2.5 text-xs ${assetKindFilter === "all" ? "border-emerald-500 bg-emerald-500/10 text-emerald-100" : "border-white/10 bg-[#202020] text-[#b4b4b4] hover:bg-white/10 hover:border-white/20"}`}
          onClick={() => setAssetKindFilter("all")}
        >
          全部 {projectAssets.length}
        </button>
        {projectAssetKinds.map((item) => (
          <button
            key={item.key}
            className={`shrink-0 rounded-lg border px-4 py-2.5 text-xs ${assetKindFilter === item.key ? "border-emerald-500 bg-emerald-500/10 text-emerald-100" : "border-white/10 bg-[#202020] text-[#b4b4b4] hover:bg-white/10 hover:border-white/20"}`}
            onClick={() => {
              setAssetKindFilter(item.key);
              setAssetComposerKind(item.key);
            }}
          >
            {item.label} {assetKindCounts[item.key] ?? 0}
          </button>
        ))}
      </div>
      <div className="rounded-lg border border-white/10 bg-[#202020] p-3">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-medium">{editingAssetId ? "编辑资产" : "新增资产"}</div>
            <div className="mt-1 text-xs text-[#b4b4b4]">用表单维护资产名称、标签、媒体地址、提示词和特征信息。</div>
          </div>
          <div className="flex flex-wrap gap-2">
            {editingAssetId && <Button size="sm" variant="secondary" onClick={() => resetProjectAssetForm(assetComposerKind)}>取消编辑</Button>}
            <ShadcnSelect
              options={projectAssetKinds.map((item) => ({ value: item.key, label: item.label }))}
              value={assetComposerKind}
              disabled={Boolean(editingAssetId)}
              onChange={(value) => setAssetComposerKind(value as ProjectAssetKind)}
              className="h-8 text-xs min-w-[120px]"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 max-md:grid-cols-1">
          <input
            className="h-9 rounded-lg border border-white/10 bg-[#2f2f2f] px-3 text-sm text-white outline-none focus:border-emerald-500"
            value={currentAssetDraft.name}
            placeholder={projectAssetKinds.find((item) => item.key === assetComposerKind)?.placeholder}
            onChange={(event) => setAssetDrafts((items) => ({ ...items, [assetComposerKind]: { ...items[assetComposerKind], name: event.target.value } }))}
          />
          <input
            className="h-9 rounded-lg border border-white/10 bg-[#2f2f2f] px-3 text-xs text-white outline-none focus:border-emerald-500"
            value={currentAssetDraft.tags}
            placeholder="标签，逗号分隔"
            onChange={(event) => setAssetDrafts((items) => ({ ...items, [assetComposerKind]: { ...items[assetComposerKind], tags: event.target.value } }))}
          />
          <input
            className="h-9 rounded-lg border border-white/10 bg-[#2f2f2f] px-3 text-xs text-white outline-none focus:border-emerald-500"
            value={currentAssetDraft.image_url}
            placeholder="图片 / 参考图 URL"
            onChange={(event) => setAssetDrafts((items) => ({ ...items, [assetComposerKind]: { ...items[assetComposerKind], image_url: event.target.value } }))}
          />
          <input
            className="h-9 rounded-lg border border-white/10 bg-[#2f2f2f] px-3 text-xs text-white outline-none focus:border-emerald-500"
            value={currentAssetDraft.video_url}
            placeholder="视频 URL"
            onChange={(event) => setAssetDrafts((items) => ({ ...items, [assetComposerKind]: { ...items[assetComposerKind], video_url: event.target.value } }))}
          />
          <input
            className="h-9 rounded-lg border border-white/10 bg-[#2f2f2f] px-3 text-xs text-white outline-none focus:border-emerald-500"
            value={currentAssetDraft.folder}
            placeholder="文件夹，例如 角色/主角"
            onChange={(event) => setAssetDrafts((items) => ({ ...items, [assetComposerKind]: { ...items[assetComposerKind], folder: event.target.value } }))}
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              className="h-9 rounded-lg border border-white/10 bg-[#2f2f2f] px-3 text-xs text-white outline-none focus:border-emerald-500"
              value={currentAssetDraft.resolution}
              placeholder="分辨率"
              onChange={(event) => setAssetDrafts((items) => ({ ...items, [assetComposerKind]: { ...items[assetComposerKind], resolution: event.target.value } }))}
            />
            <input
              className="h-9 rounded-lg border border-white/10 bg-[#2f2f2f] px-3 text-xs text-white outline-none focus:border-emerald-500"
              value={currentAssetDraft.duration}
              placeholder="时长"
              onChange={(event) => setAssetDrafts((items) => ({ ...items, [assetComposerKind]: { ...items[assetComposerKind], duration: event.target.value } }))}
            />
          </div>
        </div>
        <textarea
          className="mt-2 min-h-20 w-full resize-none rounded-lg border border-white/10 bg-[#2f2f2f] px-3 py-2 text-xs text-white outline-none focus:border-emerald-500"
          value={currentAssetDraft.prompt}
          placeholder="设定词 / 生成提示词 / 角色描述 / 风格模板"
          onChange={(event) => setAssetDrafts((items) => ({ ...items, [assetComposerKind]: { ...items[assetComposerKind], prompt: event.target.value } }))}
        />
        <div className="mt-2 grid grid-cols-2 gap-2 max-md:grid-cols-1">
          <input
            className="h-9 rounded-lg border border-white/10 bg-[#2f2f2f] px-3 text-xs text-white outline-none focus:border-emerald-500"
            value={currentAssetDraft.role_traits}
            placeholder="角色特征：发型/服装/脸型"
            onChange={(event) => setAssetDrafts((items) => ({ ...items, [assetComposerKind]: { ...items[assetComposerKind], role_traits: event.target.value } }))}
          />
          <input
            className="h-9 rounded-lg border border-white/10 bg-[#2f2f2f] px-3 text-xs text-white outline-none focus:border-emerald-500"
            value={currentAssetDraft.style_keywords}
            placeholder="风格关键词：色调/光影/镜头"
            onChange={(event) => setAssetDrafts((items) => ({ ...items, [assetComposerKind]: { ...items[assetComposerKind], style_keywords: event.target.value } }))}
          />
        </div>
        <div className="mt-3 flex justify-end">
          <Button size="sm" onClick={() => void submitProjectAssetForm()}>
            {editingAssetId ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {editingAssetId ? "保存资产" : "加入资产库"}
          </Button>
        </div>
      </div>
      <ProjectWorkbenchPager
        total={filteredProjectAssets.length}
        page={currentWorkbenchPageNumber}
        pageSize={workbenchPageSize}
        label="资产列表"
        onPageChange={setCurrentWorkbenchPage}
      />
      {filteredProjectAssets.length === 0 ? (
        projectAssets.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <div className="text-base font-semibold text-white">暂无资产</div>
            <div className="mt-2 text-sm text-[#bdbdbd]">资产库用于管理角色卡、场景卡、风格模板等素材，可在分镜中快速复用。</div>
          </div>
        ) : (
          <div className="agnes-empty-state rounded-xl p-6 text-center text-sm">暂无匹配资产。可以清空搜索条件，或在上方快速加入资产。</div>
        )
      ) : (
        <ProjectManagementTable columns={["预览", "名称", "类型", "标签/文件夹", "媒体信息", "操作"]}>
          {pagedProjectAssets.map((asset) => (
            <tr key={asset.id} className="group align-top hover:bg-white/[0.03] transition-all duration-200">
              <td className="w-40 px-4 py-4">
                {asset.image_url ? (
                  <button className="block h-24 w-40 overflow-hidden rounded-lg bg-black/30 transition-all duration-200 hover:scale-[1.02] hover:ring-2 hover:ring-emerald-500/50" onClick={() => window.open(asset.image_url, "_blank", "noopener,noreferrer")}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img className="h-full w-full object-cover" src={asset.image_url} alt={asset.name} />
                  </button>
                ) : asset.video_url ? (
                  <button className="block h-24 w-40 overflow-hidden rounded-lg bg-black/30 transition-all duration-200 hover:scale-[1.02]" onClick={() => window.open(asset.video_url, "_blank", "noopener,noreferrer")}>
                    <video className="h-full w-full object-cover" src={asset.video_url} preload="metadata" />
                  </button>
                ) : (
                  <div className="grid h-24 w-40 place-items-center rounded-lg border border-dashed border-white/15 bg-[#2a2a2a] text-[#888]">无预览</div>
                )}
              </td>
              <td className="max-w-72 px-3 py-3">
                <div className="font-semibold text-white">{asset.name || "未命名资产"}</div>
                {asset.prompt && <div className="mt-1 line-clamp-2 whitespace-pre-wrap text-[#d6d6d6]">{asset.prompt}</div>}
              </td>
              <td className="px-3 py-3 text-[#eeeeee]">
                {projectAssetKinds.find((item) => item.key === asset.kind)?.label ?? asset.kind}
                {asset.is_favorite && <span className="ml-2 rounded-md bg-yellow-500/10 px-1.5 py-0.5 text-yellow-200">收藏</span>}
              </td>
              <td className="max-w-64 px-3 py-3 text-[#d6d6d6]">
                <div className="truncate">{asset.folder || "未分组"}</div>
                {asset.tags?.length > 0 && <div className="mt-1 line-clamp-2">{asset.tags.join(" / ")}</div>}
              </td>
              <td className="px-3 py-3 text-[#d6d6d6]">
                <div>{[asset.resolution, asset.duration].filter(Boolean).join(" · ") || "未记录"}</div>
                {asset.role_traits?.length > 0 && <div className="mt-1 line-clamp-1">角色：{asset.role_traits.join(" / ")}</div>}
                {asset.style_keywords?.length > 0 && <div className="mt-1 line-clamp-1">风格：{asset.style_keywords.join(" / ")}</div>}
              </td>
              <td className="w-56 px-3 py-3">
                <div className="flex flex-wrap gap-1">
                  <Button size="sm" variant="secondary" onClick={() => void reuseProjectAsset(asset)}>复用</Button>
                  <Button size="sm" variant="secondary" onClick={() => editProjectAssetItem(asset)}><Pencil className="h-4 w-4" />编辑</Button>
                  {asset.prompt && <Button size="sm" variant="secondary" onClick={() => void copy(asset.prompt)}>复制</Button>}
                  {projectAssetReferenceUrls(asset).length > 0 && <Button size="sm" variant="secondary" onClick={() => void reuseProjectAsset(asset, "video")}>视频</Button>}
                  {asset.image_url && <Button size="sm" variant="secondary" onClick={() => continueEditImage(asset.image_url)}>参考图</Button>}
                  <button className={`grid h-8 w-8 place-items-center rounded-md bg-white/10 hover:bg-white/15 ${asset.is_favorite ? "text-yellow-300" : "text-[#d8d8d8]"}`} onClick={() => void toggleProjectAssetFavorite(asset)} aria-label="收藏资产">
                    <Star className={`h-3.5 w-3.5 ${asset.is_favorite ? "fill-current" : ""}`} />
                  </button>
                  <button className="grid h-8 w-8 place-items-center rounded-md bg-red-500/10 text-red-200 hover:bg-red-500/20" onClick={() => void deleteProjectAssetItem(asset)} aria-label="删除资产">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </ProjectManagementTable>
      )}
    </div>
  );
}
