"use client";

/**
 * 剧本工作台：分镜中心（storyboards）tab
 *
 * - 分镜表单（集/场/镜/状态/标题/时长 + 角色/场景/景别/镜头运动/描述/提示词）
 * - 剧本自动拆镜（粘贴剧本 → 批量生成分镜）
 * - 批量操作（送审 / 标记完成 / 清空选择）
 * - 分镜卡片（缩略图 + 资源绑定 + 审核意见 + 编辑/删除/生成底图/图生视频）
 */

import { Check, Download, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyStoryboards } from "@/components/shared";
import type { ProjectStoryboardStatus } from "@/lib/app-types";
import type { ProjectWorkbenchTabsProps } from "./types";

export function StoryboardsTab(props: Pick<
  ProjectWorkbenchTabsProps,
  "projectStoryboards" | "filteredProjectStoryboards" | "pagedProjectStoryboards" | "storyboardDraft" | "setStoryboardDraft" | "editingStoryboardId" | "setEditingStoryboardId" |
  "selectedStoryboardIds" | "setSelectedStoryboardIds" | "toggleStoryboardSelection" |
  "storyboardStatuses" | "storyboardStatusText" |
  "characterAssets" | "sceneAssets" | "projectReviews" | "reviewDrafts" | "setReviewDrafts" |
  "createProjectStoryboardItem" | "editProjectStoryboard" | "deleteProjectStoryboardItem" |
  "useStoryboardForGeneration" | "createStoryboardReview" | "updateProjectReviewItem" | "deleteProjectReviewItem" |
  "scriptDraft" | "setScriptDraft" | "breakdownScriptToStoryboards" | "batchUpdateStoryboards" |
  "downloadStoryboardCsv" | "copy"
>) {
  const {
    projectStoryboards, filteredProjectStoryboards, pagedProjectStoryboards,
    storyboardDraft, setStoryboardDraft, editingStoryboardId, setEditingStoryboardId,
    selectedStoryboardIds, setSelectedStoryboardIds, toggleStoryboardSelection,
    storyboardStatuses, storyboardStatusText,
    characterAssets, sceneAssets, projectReviews, reviewDrafts, setReviewDrafts,
    createProjectStoryboardItem, editProjectStoryboard, deleteProjectStoryboardItem,
    useStoryboardForGeneration, createStoryboardReview, updateProjectReviewItem, deleteProjectReviewItem,
    scriptDraft, setScriptDraft, breakdownScriptToStoryboards, batchUpdateStoryboards,
    downloadStoryboardCsv, copy,
  } = props;

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-white/10 bg-[#202020] p-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">分镜中心</div>
            <div className="text-xs text-[#b4b4b4]">每条分镜绑定底图、视频、角色、场景和提示词。</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={downloadStoryboardCsv}><Download className="h-4 w-4" />导出分镜表</Button>
            {editingStoryboardId && <Button size="sm" variant="secondary" onClick={() => {
              setEditingStoryboardId("");
              setStoryboardDraft((draft) => ({ ...draft, title: "", description: "", dialogue: "", prompt: "", status: "draft", character_asset_ids: [], scene_asset_id: "" }));
            }}>取消编辑</Button>}
            <Button size="sm" onClick={() => void createProjectStoryboardItem()}>
              {editingStoryboardId ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {editingStoryboardId ? "保存修改" : "新增分镜"}
            </Button>
          </div>
        </div>
        <div className="mb-3 rounded-lg border border-white/10 bg-[#2a2a2a] p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="text-xs font-medium text-white">剧本自动拆分镜</div>
            <Button size="sm" variant="secondary" onClick={() => void breakdownScriptToStoryboards()}>生成分镜</Button>
          </div>
          <textarea
            className="min-h-24 w-full resize-none rounded-lg border border-white/10 bg-[#202020] px-3 py-2 text-xs text-white outline-none focus:border-emerald-500"
            value={scriptDraft}
            placeholder="粘贴剧本文本，系统会自动拆场景、生成分镜和提示词，并尝试绑定已有角色/场景资产"
            onChange={(event) => setScriptDraft(event.target.value)}
          />
        </div>
        <div className="grid grid-cols-6 gap-2 max-lg:grid-cols-2 max-md:grid-cols-1">
          <input className="h-9 rounded-lg border border-white/10 bg-[#2f2f2f] px-3 text-xs text-white outline-none focus:border-emerald-500" type="number" min={1} value={storyboardDraft.episode} placeholder="集数" onChange={(event) => setStoryboardDraft((draft) => ({ ...draft, episode: Number(event.target.value) }))} />
          <input className="h-9 rounded-lg border border-white/10 bg-[#2f2f2f] px-3 text-xs text-white outline-none focus:border-emerald-500" value={storyboardDraft.scene} placeholder="场次" onChange={(event) => setStoryboardDraft((draft) => ({ ...draft, scene: event.target.value }))} />
          <input className="h-9 rounded-lg border border-white/10 bg-[#2f2f2f] px-3 text-xs text-white outline-none focus:border-emerald-500" value={storyboardDraft.shot} placeholder="镜号" onChange={(event) => setStoryboardDraft((draft) => ({ ...draft, shot: event.target.value }))} />
          <select className="h-9 rounded-lg border border-white/10 bg-[#2f2f2f] px-3 text-xs text-white outline-none focus:border-emerald-500" value={storyboardDraft.status} onChange={(event) => setStoryboardDraft((draft) => ({ ...draft, status: event.target.value as ProjectStoryboardStatus }))}>
            {storyboardStatuses.map((status) => <option key={status.key} value={status.key}>{status.label}</option>)}
          </select>
          <input className="h-9 rounded-lg border border-white/10 bg-[#2f2f2f] px-3 text-xs text-white outline-none focus:border-emerald-500" value={storyboardDraft.title} placeholder="分镜标题" onChange={(event) => setStoryboardDraft((draft) => ({ ...draft, title: event.target.value }))} />
          <input className="h-9 rounded-lg border border-white/10 bg-[#2f2f2f] px-3 text-xs text-white outline-none focus:border-emerald-500" type="number" min={1} value={storyboardDraft.duration} placeholder="时长" onChange={(event) => setStoryboardDraft((draft) => ({ ...draft, duration: Number(event.target.value) }))} />
        </div>
        <div className="mt-2 grid grid-cols-4 gap-2 max-lg:grid-cols-2 max-md:grid-cols-1">
          <input className="h-9 rounded-lg border border-white/10 bg-[#2f2f2f] px-3 text-xs text-white outline-none focus:border-emerald-500" value={storyboardDraft.characters} placeholder="角色，逗号分隔" onChange={(event) => setStoryboardDraft((draft) => ({ ...draft, characters: event.target.value }))} />
          <input className="h-9 rounded-lg border border-white/10 bg-[#2f2f2f] px-3 text-xs text-white outline-none focus:border-emerald-500" value={storyboardDraft.location} placeholder="场景" onChange={(event) => setStoryboardDraft((draft) => ({ ...draft, location: event.target.value }))} />
          <input className="h-9 rounded-lg border border-white/10 bg-[#2f2f2f] px-3 text-xs text-white outline-none focus:border-emerald-500" value={storyboardDraft.shot_size} placeholder="景别" onChange={(event) => setStoryboardDraft((draft) => ({ ...draft, shot_size: event.target.value }))} />
          <input className="h-9 rounded-lg border border-white/10 bg-[#2f2f2f] px-3 text-xs text-white outline-none focus:border-emerald-500" value={storyboardDraft.camera_move} placeholder="镜头运动" onChange={(event) => setStoryboardDraft((draft) => ({ ...draft, camera_move: event.target.value }))} />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 max-md:grid-cols-1">
          <select
            className="h-9 rounded-lg border border-white/10 bg-[#2f2f2f] px-3 text-xs text-white outline-none focus:border-emerald-500"
            value={storyboardDraft.character_asset_ids[0] ?? ""}
            onChange={(event) => setStoryboardDraft((draft) => ({ ...draft, character_asset_ids: event.target.value ? [event.target.value] : [] }))}
          >
            <option value="">绑定角色资产</option>
            {characterAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
          </select>
          <select
            className="h-9 rounded-lg border border-white/10 bg-[#2f2f2f] px-3 text-xs text-white outline-none focus:border-emerald-500"
            value={storyboardDraft.scene_asset_id}
            onChange={(event) => setStoryboardDraft((draft) => ({ ...draft, scene_asset_id: event.target.value }))}
          >
            <option value="">绑定场景资产</option>
            {sceneAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
          </select>
        </div>
        <textarea className="mt-2 min-h-16 w-full resize-none rounded-lg border border-white/10 bg-[#2f2f2f] px-3 py-2 text-xs text-white outline-none focus:border-emerald-500" value={storyboardDraft.description} placeholder="画面描述" onChange={(event) => setStoryboardDraft((draft) => ({ ...draft, description: event.target.value }))} />
        <textarea className="mt-2 min-h-16 w-full resize-none rounded-lg border border-white/10 bg-[#2f2f2f] px-3 py-2 text-xs text-white outline-none focus:border-emerald-500" value={storyboardDraft.prompt} placeholder="生成提示词" onChange={(event) => setStoryboardDraft((draft) => ({ ...draft, prompt: event.target.value }))} />
      </div>

      {filteredProjectStoryboards.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-[#202020] px-3 py-2">
          <label className="flex items-center gap-2 text-xs text-[#d8d8d8]">
            <input
              className="h-4 w-4 accent-emerald-500"
              type="checkbox"
              checked={filteredProjectStoryboards.every((item) => selectedStoryboardIds.includes(item.id))}
              onChange={(event) => setSelectedStoryboardIds(event.target.checked ? filteredProjectStoryboards.map((item) => item.id) : [])}
            />
            已选 {selectedStoryboardIds.length} / {filteredProjectStoryboards.length} 条分镜
          </label>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => setSelectedStoryboardIds([])}>清空</Button>
            <Button size="sm" variant="secondary" onClick={() => void batchUpdateStoryboards("review")}>批量送审</Button>
            <Button size="sm" variant="secondary" onClick={() => void batchUpdateStoryboards("done")}><Check className="h-4 w-4" />标记完成</Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {filteredProjectStoryboards.length === 0 ? (
          projectStoryboards.length === 0 ? (
            <EmptyStoryboards onCreateStoryboard={() => void createProjectStoryboardItem()} />
          ) : (
            <div className="px-5 py-10 text-center">
              <div className="text-base font-semibold text-white">没有匹配的分镜</div>
              <div className="mt-2 text-sm text-[#bdbdbd]">调整搜索或状态筛选后再试。</div>
            </div>
          )
        ) : (
          pagedProjectStoryboards.map((storyboard) => (
            <div key={storyboard.id} className="group relative rounded-lg border border-white/10 bg-[#202020] p-4 transition-all duration-200 hover:bg-white/5 hover:border-white/20">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      aria-label={`选择分镜 ${storyboard.title}`}
                      className="h-4 w-4 accent-emerald-500"
                      type="checkbox"
                      checked={selectedStoryboardIds.includes(storyboard.id)}
                      onChange={() => toggleStoryboardSelection(storyboard.id)}
                    />
                    <span className="rounded-md bg-white/10 px-2 py-1 text-xs">第{storyboard.episode}集</span>
                    <span className="rounded-md bg-white/10 px-2 py-1 text-xs">{storyboard.scene}-{storyboard.shot}</span>
                    <span className="rounded-md bg-white/10 px-2 py-1">{storyboardStatusText(storyboard.status)}</span>
                  </div>
                  <div className="mt-2 font-medium text-white">{storyboard.title}</div>
                  <div className="mt-1 line-clamp-2 text-xs text-[#b4b4b4]">{storyboard.description || storyboard.prompt}</div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-[#b4b4b4]">
                    {storyboard.characters.length > 0 && <span>角色：{storyboard.characters.join(" / ")}</span>}
                    {storyboard.location && <span>场景：{storyboard.location}</span>}
                    {storyboard.shot_size && <span>景别：{storyboard.shot_size}</span>}
                    {storyboard.camera_move && <span>镜头：{storyboard.camera_move}</span>}
                    <span>{storyboard.duration}s</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    {(storyboard.character_asset_ids ?? []).map((assetId) => {
                      const asset = characterAssets.find((item) => item.id === assetId);
                      return asset ? <span key={asset.id} className="rounded-md bg-emerald-500/10 px-2 py-1 text-emerald-200">角色卡：{asset.name}</span> : null;
                    })}
                    {storyboard.scene_asset_id && (() => {
                      const asset = sceneAssets.find((item) => item.id === storyboard.scene_asset_id);
                      return asset ? <span className="rounded-md bg-sky-500/10 px-2 py-1 text-sky-200">场景卡：{asset.name}</span> : null;
                    })()}
                  </div>
                </div>
                {storyboard.image_url && (
                  <button className="w-40 h-24 overflow-hidden rounded-md bg-black/20 transition-all duration-200 hover:scale-[1.02]" onClick={() => window.open(storyboard.image_url, "_blank", "noopener,noreferrer")}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img className="aspect-video w-full h-full object-cover" src={storyboard.image_url} alt={storyboard.title} />
                  </button>
                )}
                {/* 快捷操作按钮（hover时显示） */}
                <div className="absolute right-4 top-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex gap-2 z-10">
                  <Button size="sm" variant="secondary" className="h-7 px-2.5 text-xs" onClick={() => useStoryboardForGeneration(storyboard, "image")}>
                    🎨 图片
                  </Button>
                  <Button size="sm" variant="secondary" className="h-7 px-2.5 text-xs" onClick={() => useStoryboardForGeneration(storyboard, "video")}>
                    🎬 视频
                  </Button>
                  <Button size="sm" variant="secondary" className="h-7 px-2.5 text-xs" onClick={() => editProjectStoryboard(storyboard)}>
                    ✏️ 编辑
                  </Button>
                  <Button size="sm" variant="destructive" className="h-7 px-2.5 text-xs" onClick={() => void deleteProjectStoryboardItem(storyboard)}>
                    🗑️ 删除
                  </Button>
                </div>
              </div>
              <div className="mt-3 rounded-lg border border-white/10 bg-[#2b2b2b] p-2">
                <div className="mb-2 text-xs font-medium text-white">审核意见</div>
                <div className="space-y-1">
                  {projectReviews.filter((review) => review.target_type === "storyboard" && review.target_id === storyboard.id).map((review) => (
                    <div key={review.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-[#202020] px-2 py-1 text-xs text-[#d8d8d8]">
                      <span className={review.status === "open" ? "text-yellow-200" : review.status === "resolved" ? "text-emerald-200" : "text-red-200"}>{review.status === "open" ? "待处理" : review.status === "resolved" ? "已解决" : "已驳回"}</span>
                      <span className="min-w-0 flex-1 truncate">{review.comment}</span>
                      <button className="text-emerald-200 hover:text-white" onClick={() => void updateProjectReviewItem(review, { status: "resolved" })}>通过</button>
                      <button className="text-red-200 hover:text-white" onClick={() => void deleteProjectReviewItem(review)}>删除</button>
                    </div>
                  ))}
                  {projectReviews.filter((review) => review.target_type === "storyboard" && review.target_id === storyboard.id).length === 0 && (
                    <div className="text-xs text-[#777]">暂无审核意见</div>
                  )}
                </div>
                <div className="mt-2 flex gap-2">
                  <input
                    className="h-8 min-w-0 flex-1 rounded-md border border-white/10 bg-[#202020] px-2 text-xs text-white outline-none focus:border-emerald-500"
                    value={reviewDrafts[storyboard.id] ?? ""}
                    placeholder="输入返工点、通过意见或剪辑备注"
                    onChange={(event) => setReviewDrafts((drafts) => ({ ...drafts, [storyboard.id]: event.target.value }))}
                  />
                  <Button size="sm" variant="secondary" onClick={() => void createStoryboardReview(storyboard)}>添加</Button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => editProjectStoryboard(storyboard)}><Pencil className="h-4 w-4" />编辑</Button>
                <Button size="sm" variant="secondary" onClick={() => useStoryboardForGeneration(storyboard, "image")}>生成底图</Button>
                <Button size="sm" variant="secondary" onClick={() => useStoryboardForGeneration(storyboard, "video")}>图生视频</Button>
                <Button size="sm" variant="secondary" onClick={() => void copy(storyboard.prompt || storyboard.description)}>复制提示词</Button>
                <Button size="sm" variant="destructive" onClick={() => void deleteProjectStoryboardItem(storyboard)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
