/**
 * 全局模拟业务数据生成器
 *
 * 以项目中心的项目为基础，为各个模块生成一致的业务数据
 */

import type { Project } from "@/lib/app-types";

// 项目基础数据
export const projects: Project[] = [
  {
    id: "proj-1",
    name: "星际迷航：新纪元",
    category: "科幻冒险漫剧",
    status: "active",
    description: "讲述人类在宇宙探索中发现新文明的科幻冒险故事，融合科幻元素与人文关怀",
    episode_count: 24,
    owner: "王导演",
    due_date: "2026-08-15",
    is_default: false,
    is_pinned: true,
    created_at: "2026-06-01T09:00:00Z",
    updated_at: "2026-07-09T10:30:00Z",
    storage_path: "/projects/star-trek",
    storage_mode: "managed",
    archived_at: "",
  },
  {
    id: "proj-2",
    name: "江湖风云录",
    category: "古风武侠剧",
    status: "active",
    description: "古风武侠剧，讲述江湖侠客的恩怨情仇，融合传统武侠精神与现代叙事",
    episode_count: 36,
    owner: "李制片",
    due_date: "2026-09-20",
    is_default: false,
    is_pinned: true,
    created_at: "2026-05-15T11:00:00Z",
    updated_at: "2026-07-08T14:20:00Z",
    storage_path: "/projects/wuxia",
    storage_mode: "managed",
    archived_at: "",
  },
  {
    id: "proj-3",
    name: "都市爱情故事",
    category: "现代都市爱情剧",
    status: "active",
    description: "讲述都市年轻人的爱情与成长，展现当代都市生活百态",
    episode_count: 12,
    owner: "张编辑",
    due_date: "2026-07-30",
    is_default: false,
    is_pinned: false,
    created_at: "2026-07-01T10:00:00Z",
    updated_at: "2026-07-09T08:00:00Z",
    storage_path: "/projects/city-love",
    storage_mode: "managed",
    archived_at: "",
  },
  {
    id: "proj-4",
    name: "奇幻童话世界",
    category: "奇幻儿童剧",
    status: "active",
    description: "为儿童创作的奇幻童话故事，充满想象力和教育意义",
    episode_count: 18,
    owner: "刘导演",
    due_date: "2026-10-10",
    is_default: false,
    is_pinned: false,
    created_at: "2026-06-20T08:00:00Z",
    updated_at: "2026-07-07T15:00:00Z",
    storage_path: "/projects/fairy-tales",
    storage_mode: "managed",
    archived_at: "",
  },
  {
    id: "proj-5",
    name: "悬疑推理剧场",
    category: "悬疑推理剧",
    status: "active",
    description: "悬疑推理题材，讲述侦探破解复杂案件的故事",
    episode_count: 16,
    owner: "赵编剧",
    due_date: "2026-08-25",
    is_default: false,
    is_pinned: false,
    created_at: "2026-07-05T12:00:00Z",
    updated_at: "2026-07-09T11:00:00Z",
    storage_path: "/projects/suspense",
    storage_mode: "managed",
    archived_at: "",
  },
  {
    id: "proj-6",
    name: "热血青春校园",
    category: "青春校园剧",
    status: "active",
    description: "青春校园题材，讲述学生们的成长、友情与梦想",
    episode_count: 20,
    owner: "陈导演",
    due_date: "2026-09-15",
    is_default: false,
    is_pinned: false,
    created_at: "2026-06-10T09:30:00Z",
    updated_at: "2026-07-08T16:00:00Z",
    storage_path: "/projects/youth-campus",
    storage_mode: "managed",
    archived_at: "",
  },
  {
    id: "proj-7",
    name: "历史传奇故事",
    category: "历史古装剧",
    status: "active",
    description: "历史题材古装剧，重现古代英雄人物和重大历史事件",
    episode_count: 40,
    owner: "周导演",
    due_date: "2026-11-01",
    is_default: false,
    is_pinned: false,
    created_at: "2026-05-01T10:00:00Z",
    updated_at: "2026-07-06T13:00:00Z",
    storage_path: "/projects/history",
    storage_mode: "managed",
    archived_at: "",
  },
  {
    id: "proj-8",
    name: "搞笑日常漫剧",
    category: "搞笑喜剧剧",
    status: "completed",
    description: "轻松搞笑的日常故事，让观众在欢笑中感受生活乐趣",
    episode_count: 10,
    owner: "吴编剧",
    due_date: "2026-06-30",
    is_default: false,
    is_pinned: false,
    created_at: "2026-03-01T08:00:00Z",
    updated_at: "2026-06-30T17:00:00Z",
    storage_path: "/projects/comedy",
    storage_mode: "managed",
    archived_at: "",
  },
  {
    id: "proj-9",
    name: "恐怖惊悚之夜",
    category: "恐怖惊悚剧",
    status: "completed",
    description: "恐怖惊悚题材，营造紧张刺激的氛围，挑战观众心理承受能力",
    episode_count: 8,
    owner: "郑导演",
    due_date: "2026-07-05",
    is_default: false,
    is_pinned: false,
    created_at: "2026-04-15T14:00:00Z",
    updated_at: "2026-07-05T20:00:00Z",
    storage_path: "/projects/horror",
    storage_mode: "managed",
    archived_at: "",
  },
  {
    id: "proj-10",
    name: "运动竞技风云",
    category: "运动竞技剧",
    status: "completed",
    description: "运动竞技题材，讲述运动员们的拼搏精神和竞技故事",
    episode_count: 15,
    owner: "孙编剧",
    due_date: "2026-06-20",
    is_default: false,
    is_pinned: false,
    created_at: "2026-02-01T10:00:00Z",
    updated_at: "2026-06-20T18:00:00Z",
    storage_path: "/projects/sports",
    storage_mode: "managed",
    archived_at: "",
  },
  {
    id: "proj-11",
    name: "音乐梦想之旅",
    category: "音乐励志剧",
    status: "archived",
    description: "音乐题材励志故事，讲述音乐人追逐梦想的历程",
    episode_count: 12,
    owner: "钱导演",
    due_date: "2026-05-30",
    is_default: false,
    is_pinned: false,
    created_at: "2026-01-10T09:00:00Z",
    updated_at: "2026-05-30T15:00:00Z",
    storage_path: "/projects/music-dream",
    storage_mode: "managed",
    archived_at: "2026-06-01T10:00:00Z",
  },
];

// 角色数据类型
export interface Character {
  id: string;
  project_id: string;
  name: string;
  role: string; // 主角、配角、反派等
  description: string;
  personality: string;
  appearance: string;
  thumbnail?: string;
  created_at: string;
  updated_at: string;
}

// 场景数据类型
export interface Scene {
  id: string;
  project_id: string;
  name: string;
  location: string; // 地点类型：室内、室外、虚拟等
  description: string;
  atmosphere: string; // 氛围：白天、夜晚、阴天等
  thumbnail?: string;
  created_at: string;
  updated_at: string;
}

// 分镜数据类型
export interface Storyboard {
  id: string;
  project_id: string;
  episode: number;
  scene: number;
  shot: number;
  title: string;
  description: string;
  camera_angle: string;
  camera_movement: string;
  duration: number;
  status: "draft" | "reviewing" | "approved" | "completed";
  created_at: string;
  updated_at: string;
}

// 剧本数据类型
export interface Script {
  id: string;
  project_id: string;
  title: string;
  author: string;
  status: "draft" | "active" | "review" | "completed" | "archived";
  description?: string;
  words?: number;
  chapters?: number;
  created_at: string;
  updated_at: string;
}

// 资产数据类型
export interface Asset {
  id: string;
  project_id: string;
  name: string;
  type: "character" | "scene" | "prop" | "music" | "effect";
  file_path: string;
  file_size: number;
  status: "draft" | "active" | "archived";
  created_at: string;
  updated_at: string;
}

// 视频数据类型
export interface Video {
  id: string;
  project_id: string;
  title: string;
  episode: number;
  scene: number;
  duration: number;
  resolution: string;
  status: "draft" | "processing" | "completed" | "failed";
  created_at: string;
  updated_at: string;
}

// 审核数据类型
export interface Review {
  id: string;
  project_id: string;
  target_type: "script" | "storyboard" | "video" | "asset";
  target_id: string;
  reviewer: string;
  status: "pending" | "approved" | "rejected";
  comment: string;
  created_at: string;
  updated_at: string;
}

// 生成角色数据
export function generateCharacters(): Character[] {
  const characters: Character[] = [];
  const roles = ["主角", "配角", "反派", "配角", "配角"];
  const names = [
    ["李星河", "王雪莹", "张明远", "刘芳华", "陈志强"],
    ["林风", "苏婉儿", "慕容复", "王语嫣", "段誉"],
    ["张小雨", "李明轩", "王思思", "赵阳", "刘婷"],
    ["小精灵", "魔法师", "精灵王", "女巫", "王子"],
    ["陈侦探", "李警官", "王法医", "张助手", "刘律师"],
    ["王小明", "李美丽", "张老师", "刘同学", "陈校长"],
    ["秦始皇", "李白", "王昭君", "岳飞", "林则徐"],
  ];

  projects.filter(p => p.status === "active").forEach((project, pIndex) => {
    for (let i = 0; i < 10; i++) {
      characters.push({
        id: `char-${project.id}-${i + 1}`,
        project_id: project.id,
        name: names[pIndex % names.length][i % 5],
        role: roles[i % 5],
        description: `${project.name}中的${roles[i % 5]}角色`,
        personality: "性格鲜明，形象生动",
        appearance: "外貌特征明显，易于识别",
        created_at: project.created_at,
        updated_at: project.updated_at,
      });
    }
  });

  return characters;
}

// 生成场景数据
export function generateScenes(): Scene[] {
  const scenes: Scene[] = [];
  const locations = ["室内", "室外", "虚拟", "混合"];
  const atmospheres = ["白天", "夜晚", "阴天", "黄昏", "黎明"];

  const sceneNames = [
    ["太空舱内部", "外星星球表面", "宇宙飞船驾驶舱", "星际空间站", "科技实验室"],
    ["古代书院", "江湖客栈", "山间竹林", "古城街道", "武林大会场"],
    ["都市公寓", "咖啡厅", "公园长椅", "写字楼办公室", "夜景酒吧"],
    ["魔法森林", "童话城堡", "精灵村庄", "巫师塔楼", "奇幻花园"],
    ["侦探事务所", "案发现场", "警察局", "密室", "城市街道"],
    ["学校教室", "运动场", "学生宿舍", "图书馆", "校园走廊"],
    ["古代皇宫", "战场", "书房", "集市", "码头"],
  ];

  projects.filter(p => p.status === "active").forEach((project, pIndex) => {
    for (let i = 0; i < 10; i++) {
      scenes.push({
        id: `scene-${project.id}-${i + 1}`,
        project_id: project.id,
        name: sceneNames[pIndex % sceneNames.length][i % 5],
        location: locations[i % 4],
        description: `${project.name}的重要场景`,
        atmosphere: atmospheres[i % 5],
        created_at: project.created_at,
        updated_at: project.updated_at,
      });
    }
  });

  return scenes;
}

// 生成分镜数据
export function generateStoryboards(): Storyboard[] {
  const storyboards: Storyboard[] = [];
  const cameraAngles = ["特写", "中景", "全景", "远景", "俯视"];
  const cameraMovements = ["固定", "推镜", "拉镜", "摇镜", "移镜"];
  const statuses: Storyboard["status"][] = ["draft", "reviewing", "approved", "completed"];

  projects.filter(p => p.status === "active").forEach((project) => {
    for (let i = 0; i < 10; i++) {
      const episode = Math.floor(i / 2) + 1;
      const scene = (i % 2) + 1;
      const shot = i + 1;

      storyboards.push({
        id: `sb-${project.id}-${i + 1}`,
        project_id: project.id,
        episode,
        scene,
        shot,
        title: `EP${episode}-场景${scene}-镜头${shot}`,
        description: `${project.name}第${episode}集第${scene}场景第${shot}镜头`,
        camera_angle: cameraAngles[i % 5],
        camera_movement: cameraMovements[i % 5],
        duration: 5 + Math.floor(Math.random() * 10),
        status: statuses[i % 4],
        created_at: project.created_at,
        updated_at: project.updated_at,
      });
    }
  });

  return storyboards;
}

// 生成剧本数据
export function generateScripts(): Script[] {
  const scripts: Script[] = [];
  const statuses: Script["status"][] = ["draft", "active", "review", "completed"];

  const scriptTitles = [
    "星际迷航：新纪元 - 剧本集",
    "江湖风云录 - 剧本集",
    "都市爱情故事 - 剧本集",
    "奇幻童话世界 - 剧本集",
    "悬疑推理剧场 - 剧本集",
    "热血青春校园 - 剧本集",
    "历史传奇故事 - 剧本集",
  ];

  projects.filter(p => p.status === "active").forEach((project, pIndex) => {
    // 每个项目10个剧本（对应10个剧集）
    for (let i = 0; i < 10; i++) {
      scripts.push({
        id: `script-${project.id}-${i + 1}`,
        project_id: project.id,
        title: `${scriptTitles[pIndex % scriptTitles.length]} EP${i + 1}`,
        author: project.owner,
        status: i < 7 ? "completed" : i < 9 ? "active" : "draft",
        description: `${project.name}第${i + 1}集剧本`,
        words: 3000 + Math.floor(Math.random() * 2000),
        chapters: 1,
        created_at: project.created_at,
        updated_at: project.updated_at,
      });
    }
  });

  return scripts;
}

// 生成资产数据
export function generateAssets(): Asset[] {
  const assets: Asset[] = [];
  const types: Asset["type"][] = ["character", "scene", "prop", "music", "effect"];
  const assetNames = ["角色资产", "场景资产", "道具资产", "音乐资产", "特效资产"];

  projects.filter(p => p.status === "active").forEach((project) => {
    for (let i = 0; i < 10; i++) {
      const type = types[i % 5];
      assets.push({
        id: `asset-${project.id}-${i + 1}`,
        project_id: project.id,
        name: `${project.name} ${assetNames[i % 5]} ${Math.floor(i / 5) + 1}`,
        type,
        file_path: `/assets/${project.id}/${type}-${i + 1}`,
        file_size: 1024 * 1024 * (1 + Math.floor(Math.random() * 10)), // 1-10MB
        status: i < 8 ? "active" : i < 9 ? "draft" : "archived",
        created_at: project.created_at,
        updated_at: project.updated_at,
      });
    }
  });

  return assets;
}

// 生成视频数据
export function generateVideos(): Video[] {
  const videos: Video[] = [];
  const resolutions = ["1080p", "2K", "4K"];
  const statuses: Video["status"][] = ["draft", "processing", "completed", "failed"];

  projects.filter(p => p.status === "active").forEach((project) => {
    for (let i = 0; i < 10; i++) {
      const episode = Math.floor(i / 2) + 1;
      const scene = (i % 2) + 1;

      videos.push({
        id: `video-${project.id}-${i + 1}`,
        project_id: project.id,
        title: `${project.name} EP${episode} 场景${scene}`,
        episode,
        scene,
        duration: 60 + Math.floor(Math.random() * 120), // 1-3分钟
        resolution: resolutions[i % 3],
        status: i < 6 ? "completed" : i < 8 ? "processing" : "draft",
        created_at: project.created_at,
        updated_at: project.updated_at,
      });
    }
  });

  return videos;
}

// 生成审核数据
export function generateReviews(): Review[] {
  const reviews: Review[] = [];
  const targetTypes: Review["target_type"][] = ["script", "storyboard", "video", "asset"];
  const statuses: Review["status"][] = ["pending", "approved", "rejected"];
  const reviewers = ["王导演", "李制片", "张编辑", "刘导演", "赵编剧", "陈导演", "周导演"];

  projects.filter(p => p.status === "active").forEach((project, pIndex) => {
    for (let i = 0; i < 10; i++) {
      const targetType = targetTypes[i % 4];
      reviews.push({
        id: `review-${project.id}-${i + 1}`,
        project_id: project.id,
        target_type: targetType,
        target_id: `${targetType}-${project.id}-${i + 1}`,
        reviewer: reviewers[pIndex % reviewers.length],
        status: i < 7 ? "approved" : i < 9 ? "pending" : "rejected",
        comment: i < 7 ? "审核通过" : i < 9 ? "等待审核" : "需要修改",
        created_at: project.created_at,
        updated_at: project.updated_at,
      });
    }
  });

  return reviews;
}