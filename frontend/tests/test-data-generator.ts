/**
 * 真实测试数据生成器
 *
 * 用于E2E测试，生成真实的业务数据
 */

import type { Project, Character, Scene, Script, Storyboard, Asset, Video, Review } from "@/lib/mock-data";

/** 测试用户配置 */
export const testUsers = {
  director: { name: "王导演", role: "导演" },
  producer: { name: "李制片", role: "制片" },
  editor: { name: "张编辑", role: "编辑" },
  reviewer: { name: "赵编剧", role: "审核员" },
};

/** 测试项目数据 */
export const testProjects: Project[] = [
  {
    id: "test-proj-1",
    name: "E2E测试项目-科幻",
    category: "科幻冒险漫剧",
    status: "active",
    description: "用于自动化测试的科幻项目",
    episode_count: 24,
    owner: "测试导演",
    due_date: "2026-12-31",
    is_default: false,
    is_pinned: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-07-10T00:00:00Z",
    storage_path: "/test-projects/scifi",
    storage_mode: "managed",
    archived_at: "",
  },
  {
    id: "test-proj-2",
    name: "E2E测试项目-武侠",
    category: "古风武侠剧",
    status: "active",
    description: "用于自动化测试的武侠项目",
    episode_count: 36,
    owner: "测试制片",
    due_date: "2026-12-31",
    is_default: false,
    is_pinned: false,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-07-10T00:00:00Z",
    storage_path: "/test-projects/wuxia",
    storage_mode: "managed",
    archived_at: "",
  },
];

/** 测试角色数据 */
export const testCharacters: Character[] = [
  {
    id: "test-char-1",
    project_id: "test-proj-1",
    name: "李星河",
    role: "主角",
    description: "勇敢的星际探险家，性格坚毅，富有正义感",
    personality: "勇敢、坚毅、正义感强",
    appearance: "高大健壮，黑色短发，眼神坚定",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-07-10T00:00:00Z",
  },
  {
    id: "test-char-2",
    project_id: "test-proj-1",
    name: "王雪莹",
    role: "配角",
    description: "聪明的科学家，擅长数据分析",
    personality: "聪明、理性、善于分析",
    appearance: "身材苗条，长发，戴眼镜",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-07-10T00:00:00Z",
  },
  {
    id: "test-char-3",
    project_id: "test-proj-2",
    name: "林风",
    role: "主角",
    description: "江湖侠客，武功高强",
    personality: "豪爽、正义、重情重义",
    appearance: "身材魁梧，黑色长发，英气勃发",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-07-10T00:00:00Z",
  },
];

/** 测试场景数据 */
export const testScenes: Scene[] = [
  {
    id: "test-scene-1",
    project_id: "test-proj-1",
    name: "太空舱内部",
    location: "室内",
    description: "高科技太空舱，充满未来感的控制面板和显示屏",
    atmosphere: "白天",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-07-10T00:00:00Z",
  },
  {
    id: "test-scene-2",
    project_id: "test-proj-1",
    name: "外星星球表面",
    location: "室外",
    description: "神秘的外星星球，奇异的地形和植物",
    atmosphere: "黄昏",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-07-10T00:00:00Z",
  },
  {
    id: "test-scene-3",
    project_id: "test-proj-2",
    name: "古代书院",
    location: "室内",
    description: "古色古香的书院，书卷气息浓厚",
    atmosphere: "白天",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-07-10T00:00:00Z",
  },
];

/** 测试剧本数据 */
export const testScripts: Script[] = [
  {
    id: "test-script-1",
    project_id: "test-proj-1",
    title: "星际迷航 EP1 - 新文明的发现",
    author: "测试导演",
    status: "completed",
    description: "人类首次发现新文明的故事",
    words: 3500,
    chapters: 1,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-07-10T00:00:00Z",
  },
  {
    id: "test-script-2",
    project_id: "test-proj-1",
    title: "星际迷航 EP2 - 第一次接触",
    author: "测试导演",
    status: "active",
    description: "与新文明的第一次接触",
    words: 3200,
    chapters: 1,
    created_at: "2026-01-02T00:00:00Z",
    updated_at: "2026-07-10T00:00:00Z",
  },
];

/** 测试分镜数据 */
export const testStoryboards: Storyboard[] = [
  {
    id: "test-sb-1",
    project_id: "test-proj-1",
    episode: 1,
    scene: 1,
    shot: 1,
    title: "EP1-场景1-镜头1",
    description: "太空舱全景，展示高科技设备",
    camera_angle: "全景",
    camera_movement: "固定",
    duration: 5,
    status: "completed",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-07-10T00:00:00Z",
  },
  {
    id: "test-sb-2",
    project_id: "test-proj-1",
    episode: 1,
    scene: 2,
    shot: 1,
    title: "EP1-场景2-镜头1",
    description: "外星星球表面，神秘景象",
    camera_angle: "远景",
    camera_movement: "推镜",
    duration: 8,
    status: "reviewing",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-07-10T00:00:00Z",
  },
];

/** 测试资产数据 */
export const testAssets: Asset[] = [
  {
    id: "test-asset-1",
    project_id: "test-proj-1",
    name: "太空舱背景图",
    type: "scene",
    file_path: "/test-assets/space-cabin-bg.jpg",
    file_size: 2048 * 1024, // 2MB
    status: "active",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-07-10T00:00:00Z",
  },
  {
    id: "test-asset-2",
    project_id: "test-proj-1",
    name: "李星河角色设计",
    type: "character",
    file_path: "/test-assets/lixinghe-design.png",
    file_size: 1536 * 1024, // 1.5MB
    status: "active",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-07-10T00:00:00Z",
  },
];

/** 测试视频数据 */
export const testVideos: Video[] = [
  {
    id: "test-video-1",
    project_id: "test-proj-1",
    title: "EP1 场景1 镜头1",
    episode: 1,
    scene: 1,
    duration: 120,
    resolution: "4K",
    status: "completed",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-07-10T00:00:00Z",
  },
  {
    id: "test-video-2",
    project_id: "test-proj-1",
    title: "EP1 场景2 镜头1",
    episode: 1,
    scene: 2,
    duration: 90,
    resolution: "2K",
    status: "processing",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-07-10T00:00:00Z",
  },
];

/** 测试审核数据 */
export const testReviews: Review[] = [
  {
    id: "test-review-1",
    project_id: "test-proj-1",
    target_type: "script",
    target_id: "test-script-1",
    reviewer: "测试审核员",
    status: "approved",
    comment: "剧本质量优秀，可以进入下一阶段",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-07-10T00:00:00Z",
  },
  {
    id: "test-review-2",
    project_id: "test-proj-1",
    target_type: "storyboard",
    target_id: "test-sb-2",
    reviewer: "测试审核员",
    status: "pending",
    comment: "等待审核",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-07-10T00:00:00Z",
  },
];

/** 测试数据汇总 */
export const allTestData = {
  projects: testProjects,
  characters: testCharacters,
  scenes: testScenes,
  scripts: testScripts,
  storyboards: testStoryboards,
  assets: testAssets,
  videos: testVideos,
  reviews: testReviews,
};