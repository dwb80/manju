/**
 * 测试数据生成脚本
 *
 * 功能：
 * - 创建完整的测试数据集，包含项目、会话、任务、剧本、分镜、资产、审核和发布计划
 * - 支持清除现有测试数据
 * - 按正确的顺序创建数据，确保外键关联完整性
 *
 * 使用方法：
 * - npm run create-test-data        # 创建测试数据
 * - npm run create-test-data --clean # 清除后重新创建测试数据
 */

import path from "node:path";
import { createAppContext, type AppContext } from "../src/services/app.js";
import type { Conversation, Favorite, ImageTask, Message, Project, ProjectAsset, ProjectClip, ProjectEpisode, ProjectIssue, ProjectMember, ProjectMilestone, ProjectReview, ProjectScript, ProjectStoryboard, ProjectTask, PublishPlan, VideoTask } from "../src/types.js";

// ============================================================================
// 工具函数
// ============================================================================

/** 生成唯一ID */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/** 生成ISO格式时间戳 */
function timestamp(daysAgo = 0): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString();
}

/** 延迟执行 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// 测试数据定义
// ============================================================================

interface TestDataConfig {
  projects: Array<{
    name: string;
    category: string;
    description: string;
    episode_count: number;
    owner: string;
    status: string;
  }>;
  conversations: Array<{
    title: string;
    model: string;
    project_index: number;
  }>;
  imageTasks: Array<{
    prompt: string;
    negative: string;
    status: "success" | "processing" | "pending" | "failed";
    conversation_index: number;
  }>;
  videoTasks: Array<{
    prompt: string;
    status: "success" | "processing" | "pending" | "failed";
    conversation_index: number;
  }>;
  scripts: Array<{
    episode: number;
    title: string;
    content: string;
    project_index: number;
  }>;
  storyboards: Array<{
    episode: number;
    scene: string;
    shot: string;
    title: string;
    description: string;
    dialogue: string;
    characters: string[];
    location: string;
    duration: number;
    status: string;
    project_index: number;
  }>;
  characterAssets: Array<{
    name: string;
    prompt: string;
    role_traits: string[];
    project_index: number;
  }>;
  sceneAssets: Array<{
    name: string;
    prompt: string;
    location: string;
    project_index: number;
  }>;
  reviews: Array<{
    target_type: "storyboard" | "image" | "video" | "asset" | "clip";
    reviewer: string;
    status: "open" | "resolved" | "rejected";
    comment: string;
    project_index: number;
  }>;
  publishPlans: Array<{
    name: string;
    status: "draft" | "scheduled" | "publishing" | "published" | "failed" | "cancelled";
    platforms: string[];
    assignee: string;
    notes: string;
  }>;
}

/** 测试数据配置 */
const testDataConfig: TestDataConfig = {
  projects: [
    {
      name: "星际迷航：未知领域",
      category: "科幻",
      description: "一部关于宇宙探索的科幻系列，讲述人类首次接触外星文明的故事。包含太空战斗、异星探险、时间悖论等经典科幻元素。",
      episode_count: 12,
      owner: "张导演",
      status: "in_progress",
    },
    {
      name: "时光里的你",
      category: "爱情",
      description: "穿越时空的爱情故事，男女主角在不同的时代相遇相爱，经历重重困难最终走到一起。温馨治愈的都市奇幻爱情剧。",
      episode_count: 8,
      owner: "李导演",
      status: "planning",
    },
  ],
  conversations: [
    // 项目1：科幻系列
    { title: "角色设计讨论 - 主角林宇", model: "agnes-2.0-flash", project_index: 0 },
    { title: "飞船外观设计", model: "agnes-2.0-pro", project_index: 0 },
    { title: "外星文明设定", model: "agnes-2.0-flash", project_index: 0 },
    { title: "第一集分镜脚本", model: "agnes-2.0-pro", project_index: 0 },
    // 项目2：爱情故事
    { title: "女主角造型设计", model: "agnes-2.0-flash", project_index: 1 },
    { title: "场景设定 - 老街咖啡店", model: "agnes-2.0-pro", project_index: 1 },
    { title: "时间穿越机制讨论", model: "agnes-2.0-flash", project_index: 1 },
    { title: "预告片制作", model: "agnes-2.0-pro", project_index: 1 },
  ],
  imageTasks: [
    // completed: 8个
    { prompt: "科幻风格宇宙飞船，流线型设计，银白色金属外壳，舰桥透明穹顶，背景是璀璨星空", negative: "模糊，低质量，变形", status: "success", conversation_index: 1 },
    { prompt: "英勇的宇航员男性，30岁左右，坚毅的面庞，身穿深蓝色宇航服，肩上有银河徽章", negative: "模糊，丑陋，变形", status: "success", conversation_index: 0 },
    { prompt: "外星人角色，蓝色皮肤，尖耳朵，大眼睛，友善的表情，穿着科技感服饰", negative: "恐怖，恶心，模糊", status: "success", conversation_index: 2 },
    { prompt: "太空战舰内部，指挥室，全息显示屏，船员在忙碌工作，科技感十足", negative: "破旧，脏乱，模糊", status: "success", conversation_index: 1 },
    { prompt: "复古风格咖啡店，温暖的灯光，木质家具，窗外是老街风景，浪漫氛围", negative: "现代，冷淡，模糊", status: "success", conversation_index: 4 },
    { prompt: "美丽女性角色，温柔的笑容，长发飘逸，穿着文艺气质的连衣裙", negative: "浓妆，性感，模糊", status: "success", conversation_index: 3 },
    { prompt: "时光隧道特效，彩色光带环绕，时空扭曲的效果，梦幻科幻感", negative: "恐怖，黑暗，模糊", status: "success", conversation_index: 6 },
    { prompt: "老街夜景，霓虹灯招牌，行人稀少，怀旧电影风格画面", negative: "白天，繁华，模糊", status: "success", conversation_index: 5 },
    // in_progress: 2个
    { prompt: "未来城市俯瞰，高楼大厦林立，飞行汽车穿梭，霓虹灯光闪烁", negative: "破旧，荒凉", status: "processing", conversation_index: 2 },
    { prompt: "浪漫约会场景，两人在樱花树下，花瓣飘落，温馨唯美", negative: "恐怖，血腥", status: "processing", conversation_index: 3 },
    // queued: 2个
    { prompt: "太空战斗场景，飞船交火，激光束交织，爆炸特效", negative: "和平，安静", status: "pending", conversation_index: 1 },
    { prompt: "女主角穿古装的样子，汉服风格，优雅端庄", negative: "现代服装，性感", status: "pending", conversation_index: 5 },
    // failed: 3个
    { prompt: "黑洞吞噬星球的效果，强烈的引力透镜效果", negative: "明亮的星空", status: "failed", conversation_index: 2 },
    { prompt: "时间暂停的特效画面，所有物体静止悬浮", negative: "动态，运动模糊", status: "failed", conversation_index: 6 },
    { prompt: "外星异形生物，恐怖的触手怪物，黑暗洞穴中", negative: "可爱，友善", status: "failed", conversation_index: 2 },
  ],
  videoTasks: [
    // completed: 5个
    { prompt: "宇宙飞船在星空中飞行，推进器喷射蓝色光芒，缓慢推进", status: "success", conversation_index: 1 },
    { prompt: "宇航员走向飞船舱门，回望地球，表情坚定", status: "success", conversation_index: 0 },
    { prompt: "外星人从飞船中走出，友好地向人类挥手", status: "success", conversation_index: 2 },
    { prompt: "女主角推开咖啡店门，阳光洒在脸上，微笑", status: "success", conversation_index: 4 },
    { prompt: "时光隧道中的旋转效果，彩色光芒环绕", status: "success", conversation_index: 6 },
    // in_progress: 2个
    { prompt: "太空战斗场景，飞船机动闪避，激光射击", status: "processing", conversation_index: 1 },
    { prompt: "两人在雨中相遇，撑伞对视，时间仿佛静止", status: "processing", conversation_index: 3 },
    // failed: 1个
    { prompt: "黑洞边缘的时空扭曲效果，光线弯曲", status: "failed", conversation_index: 2 },
  ],
  scripts: [
    {
      episode: 1,
      title: "启程",
      content: "【第一集：启程】\n\n场景1：地球-宇航局总部\n林宇（男主角）：今天是我们踏上星际探索之旅的第一天。作为银河号的首席舰长，我感到无比自豪。\n陈雪（女主角）：舰长，所有系统检查完毕，随时可以出发。\n林宇：很好。通知所有船员，准备启航。\n\n场景2：银河号舰桥\n林宇：推进器启动。目标：仙女座星系。\n船员A：舰长，收到来自未知文明的信号。\n林宇：未知文明？立刻进行解码。\n\n场景3：信号源方向\n一艘银白色外星飞船缓缓靠近，发出友好的光芒...\n\n【本集结束】",
      project_index: 0,
    },
    {
      episode: 1,
      title: "相遇",
      content: "【第一集：相遇】\n\n场景1：现代都市-老街咖啡店\n苏婉（女主角）：这家咖啡店真有味道，像是时光停驻在这里。\n店长：姑娘，你是新搬来的吗？这条街可不比以前热闹了。\n苏婉：我只是...路过。\n\n场景2：咖啡店外-傍晚\n一个男人（顾晨）慌张地跑过来，撞到了苏婉。\n顾晨：抱歉抱歉！\n苏婉注意到他的衣服...很特别。\n苏婉：你的衣服...是八十年代的款式？\n顾晨：你看得见我？\n\n场景3：咖啡店内\n两人坐在窗边，夕阳透过窗户洒进来。\n顾晨：我叫顾晨，来自1985年。我不知道为什么会出现在这里。\n苏婉：1985年？那你...\n顾晨：我一直在找一个人，找了很久很久...\n\n【本集结束】",
      project_index: 1,
    },
    {
      episode: 2,
      title: "第一次接触",
      content: "【第二集：第一次接触】\n\n场景1：银河号-会议室\n外星使者：我们是来自织女星系的塞利亚人。我们观察人类很久了。\n林宇：你们想要什么？\n外星使者：我们想邀请你们加入银河联盟。但首先，你们需要证明人类的智慧与勇气。\n\n场景2：模拟训练室\n陈雪：舰长，这个挑战...太危险了。\n林宇：这是我们融入银河文明的机会，必须接受。\n\n【本集结束】",
      project_index: 0,
    },
    {
      episode: 2,
      title: "时间悖论",
      content: "【第二集：时间悖论】\n\n场景1：苏婉家-现代\n顾晨：我在1985年是个建筑师，正在设计这条老街的改造方案。\n苏婉：可是这条街现在...已经被拆了一半了。\n顾晨：什么？那我必须回去阻止！\n\n场景2：老街-夜晚\n苏婉：怎么才能让你回去？\n顾晨：我不确定...但我感觉，每当我接近你，时间的力量就在波动。\n苏婉：难道...我是关键？\n\n【本集结束】",
      project_index: 1,
    },
  ],
  storyboards: [
    // 项目1：科幻系列 - 分镜
    {
      episode: 1, scene: "1-1", shot: "远景", title: "宇航局总部外景",
      description: "镜头从太空视角缓缓下降，经过云层，最终定格在一座现代化建筑群上",
      dialogue: "", characters: [], location: "地球-宇航局总部",
      duration: 8, status: "done", project_index: 0,
    },
    {
      episode: 1, scene: "1-2", shot: "中景", title: "林宇走进办公室",
      description: "男主角林宇走进办公室，墙上挂着星际探索计划的海报",
      dialogue: "林宇：今天是我们踏上星际探索之旅的第一天。", characters: ["林宇"],
      location: "宇航局-办公室", duration: 6, status: "done", project_index: 0,
    },
    {
      episode: 1, scene: "1-3", shot: "近景", title: "陈雪汇报",
      description: "女主角陈雪站在屏幕前，屏幕显示飞船系统状态",
      dialogue: "陈雪：舰长，所有系统检查完毕，随时可以出发。", characters: ["陈雪"],
      location: "宇航局-指挥中心", duration: 5, status: "done", project_index: 0,
    },
    {
      episode: 1, scene: "1-4", shot: "全景", title: "银河号飞船",
      description: "巨大的银白色飞船静静停泊在太空港，背景是蔚蓝的地球",
      dialogue: "", characters: [], location: "太空港",
      duration: 10, status: "video", project_index: 0,
    },
    {
      episode: 1, scene: "1-5", shot: "特写", title: "林宇坚定的眼神",
      description: "林宇站在舰桥，望向窗外星空，表情坚定",
      dialogue: "林宇：很好。通知所有船员，准备启航。", characters: ["林宇"],
      location: "银河号-舰桥", duration: 4, status: "image", project_index: 0,
    },
    {
      episode: 1, scene: "2-1", shot: "远景", title: "飞船推进",
      description: "飞船尾部喷射出蓝色光芒，缓缓加速",
      dialogue: "", characters: [], location: "太空",
      duration: 8, status: "review", project_index: 0,
    },
    {
      episode: 1, scene: "2-2", shot: "中景", title: "外星信号",
      description: "船员在操作台前，屏幕显示复杂的波形图",
      dialogue: "船员A：舰长，收到来自未知文明的信号。", characters: ["船员A"],
      location: "银河号-舰桥", duration: 6, status: "done", project_index: 0,
    },
    {
      episode: 1, scene: "2-3", shot: "特写", title: "林宇决定",
      description: "林宇眉头紧锁，思考片刻后做出决定",
      dialogue: "林宇：未知文明？立刻进行解码。", characters: ["林宇"],
      location: "银河号-舰桥", duration: 5, status: "done", project_index: 0,
    },
    {
      episode: 2, scene: "1-1", shot: "全景", title: "外星飞船",
      description: "银白色外星飞船从星空中缓缓出现，造型优雅流畅",
      dialogue: "", characters: [], location: "太空",
      duration: 12, status: "scripted", project_index: 0,
    },
    {
      episode: 2, scene: "1-2", shot: "中景", title: "会议室对话",
      description: "林宇与外星使者面对面坐着，气氛紧张但友好",
      dialogue: "外星使者：我们是来自织女星系的塞利亚人。", characters: ["林宇", "外星使者"],
      location: "银河号-会议室", duration: 8, status: "draft", project_index: 0,
    },
    // 项目2：爱情故事 - 分镜
    {
      episode: 1, scene: "1-1", shot: "远景", title: "老街咖啡店",
      description: "镜头缓缓推进，展现复古风格的咖啡店，暖黄色的灯光洒在石板路上",
      dialogue: "", characters: [], location: "老街-咖啡店外",
      duration: 10, status: "done", project_index: 1,
    },
    {
      episode: 1, scene: "1-2", shot: "中景", title: "苏婉进店",
      description: "女主角苏婉推开咖啡店的门，阳光洒在她的侧脸",
      dialogue: "苏婉：这家咖啡店真有味道。", characters: ["苏婉"],
      location: "咖啡店内", duration: 6, status: "done", project_index: 1,
    },
    {
      episode: 1, scene: "1-3", shot: "近景", title: "店长招呼",
      description: "年迈的店长在吧台后擦拭杯子，抬头看向苏婉",
      dialogue: "店长：姑娘，你是新搬来的吗？", characters: ["店长"],
      location: "咖啡店内", duration: 5, status: "video", project_index: 1,
    },
    {
      episode: 1, scene: "1-4", shot: "中景", title: "夕阳街景",
      description: "傍晚时分，老街笼罩在橙红色的夕阳中，行人稀少",
      dialogue: "", characters: [], location: "老街",
      duration: 8, status: "review", project_index: 1,
    },
    {
      episode: 1, scene: "1-5", shot: "特写", title: "顾晨出现",
      description: "一个男人慌张地跑过来，撞到了苏婉，两人对视",
      dialogue: "顾晨：抱歉抱歉！", characters: ["顾晨", "苏婉"],
      location: "老街", duration: 4, status: "done", project_index: 1,
    },
    {
      episode: 1, scene: "1-6", shot: "中景", title: "发现异常",
      description: "苏婉注意到顾晨的衣服，年代感十足，她露出疑惑的表情",
      dialogue: "苏婉：你的衣服...是八十年代的款式？", characters: ["苏婉", "顾晨"],
      location: "老街", duration: 6, status: "image", project_index: 1,
    },
    {
      episode: 1, scene: "1-7", shot: "特写", title: "顾晨震惊",
      description: "顾晨听到苏婉的话，表情震惊，不敢相信",
      dialogue: "顾晨：你看得见我？", characters: ["顾晨"],
      location: "老街", duration: 5, status: "scripted", project_index: 1,
    },
    {
      episode: 1, scene: "2-1", shot: "全景", title: "窗边对话",
      description: "两人坐在咖啡店窗边，夕阳透过窗户洒在他们身上",
      dialogue: "顾晨：我叫顾晨，来自1985年。", characters: ["顾晨", "苏婉"],
      location: "咖啡店内", duration: 10, status: "draft", project_index: 1,
    },
    {
      episode: 2, scene: "1-1", shot: "远景", title: "老街现状",
      description: "镜头展示老街，一半是古朴的老建筑，一半是现代高楼",
      dialogue: "", characters: [], location: "老街",
      duration: 8, status: "done", project_index: 1,
    },
    {
      episode: 2, scene: "1-2", shot: "中景", title: "时间波动",
      description: "苏婉靠近顾晨，周围的空气仿佛微微扭曲，产生时空涟漪",
      dialogue: "顾晨：我感觉，每当我接近你，时间的力量就在波动。", characters: ["顾晨", "苏婉"],
      location: "老街", duration: 6, status: "video", project_index: 1,
    },
  ],
  characterAssets: [
    // 项目1：科幻系列 - 角色
    {
      name: "林宇",
      prompt: "英勇的宇航员男性，30岁左右，坚毅的面庞，身穿深蓝色宇航服，肩上有银河徽章，短发，眼神坚定",
      role_traits: ["勇敢", "智慧", "领导力", "正义感"],
      project_index: 0,
    },
    {
      name: "陈雪",
      prompt: "美丽干练的女性宇航员，28岁，亚洲面孔，马尾发型，穿着白色科研宇航服，专业而温柔",
      role_traits: ["聪明", "细心", "善良", "专业"],
      project_index: 0,
    },
    {
      name: "外星使者-塞利亚",
      prompt: "外星人角色，蓝色皮肤，尖耳朵，大眼睛，友善的表情，穿着科技感银白色服饰，身材修长",
      role_traits: ["神秘", "友善", "智慧", "和平"],
      project_index: 0,
    },
    {
      name: "船员A-张伟",
      prompt: "年轻男性船员，25岁，戴着眼镜，穿着技术员制服，专注认真的表情",
      role_traits: ["认真", "技术宅", "可靠", "幽默"],
      project_index: 0,
    },
    // 项目2：爱情故事 - 角色
    {
      name: "苏婉",
      prompt: "美丽温柔的女性，26岁，长发飘逸，穿着文艺气质的连衣裙，淡雅的妆容，温柔的笑容",
      role_traits: ["温柔", "善良", "独立", "感性"],
      project_index: 1,
    },
    {
      name: "顾晨",
      prompt: "英俊的男性，28岁，80年代复古服装风格，略微皱巴巴的西装，复古发型，眼神中带有忧郁和坚定",
      role_traits: ["执着", "浪漫", "才华", "忧郁"],
      project_index: 1,
    },
    {
      name: "咖啡店老板",
      prompt: "慈祥的老人，60岁左右，白发苍苍，穿着围裙，和蔼可亲的笑容",
      role_traits: ["慈祥", "智慧", "神秘", "善良"],
      project_index: 1,
    },
    {
      name: "苏婉的闺蜜-小美",
      prompt: "活泼开朗的女性，25岁，现代时尚打扮，短发，灿烂的笑容",
      role_traits: ["活泼", "直率", "乐观", "热心"],
      project_index: 1,
    },
  ],
  sceneAssets: [
    // 项目1：科幻系列 - 场景
    {
      name: "银河号舰桥",
      prompt: "科幻风格飞船舰桥，中央是指挥台，周围是多个工作站，全息显示屏，蓝色照明，科技感十足",
      location: "银河号-舰桥",
      project_index: 0,
    },
    {
      name: "太空港",
      prompt: "巨大的环形太空港，停泊着各种飞船，背景是蔚蓝的地球和星空，壮观的科幻场景",
      location: "太空港",
      project_index: 0,
    },
    {
      name: "外星飞船内部",
      prompt: "外星飞船内部，银白色流线型设计，柔和的光线，未知的科技设备，神秘而优雅",
      location: "塞利亚飞船",
      project_index: 0,
    },
    {
      name: "宇航局总部",
      prompt: "现代化的宇航局建筑，大厅里展示着火箭模型，墙上有太空探索的海报，充满科技感",
      location: "地球-宇航局",
      project_index: 0,
    },
    // 项目2：爱情故事 - 场景
    {
      name: "老街咖啡店",
      prompt: "复古风格咖啡店，木质家具，温暖的灯光，窗外是老街风景，墙上挂着老照片，浪漫氛围",
      location: "老街-咖啡店",
      project_index: 1,
    },
    {
      name: "老街夜景",
      prompt: "80年代风格的老街，霓虹灯招牌，昏黄的路灯，行人稀少，怀旧电影风格",
      location: "老街",
      project_index: 1,
    },
    {
      name: "苏婉的家",
      prompt: "现代简约风格的公寓，落地窗外是城市夜景，温馨的布置，书架上有各种书籍",
      location: "苏婉家",
      project_index: 1,
    },
    {
      name: "樱花公园",
      prompt: "春天的樱花公园，粉色花瓣漫天飞舞，长椅上落满花瓣，浪漫唯美的场景",
      location: "公园",
      project_index: 1,
    },
  ],
  reviews: [
    {
      target_type: "storyboard",
      reviewer: "王监制",
      status: "resolved",
      comment: "第1集第1场的远景镜头处理得很好，但时间可以再延长2秒，让观众更好地感受氛围。",
      project_index: 0,
    },
    {
      target_type: "image",
      reviewer: "张美术",
      status: "open",
      comment: "林宇角色的宇航服设计建议增加一些个人化元素，比如特殊的徽章或颜色标识。",
      project_index: 0,
    },
    {
      target_type: "video",
      reviewer: "刘剪辑",
      status: "resolved",
      comment: "飞船推进的视频效果很棒，建议在镜头结尾增加一点镜头晃动，增加真实感。",
      project_index: 0,
    },
    {
      target_type: "storyboard",
      reviewer: "李导演",
      status: "rejected",
      comment: "苏婉和顾晨的初遇场景缺少张力，建议增加更多的眼神交流和肢体语言描述。",
      project_index: 1,
    },
    {
      target_type: "asset",
      reviewer: "赵道具",
      status: "open",
      comment: "咖啡店场景的道具需要更多年代感，比如老式收音机、翻盖手机等。",
      project_index: 1,
    },
    {
      target_type: "image",
      reviewer: "周美术",
      status: "resolved",
      comment: "苏婉的造型很符合角色设定，服装颜色建议使用更柔和的色调。",
      project_index: 1,
    },
    {
      target_type: "storyboard",
      reviewer: "王监制",
      status: "open",
      comment: "第2集的时间波动效果需要更明确的视觉指示，让观众能理解超自然元素。",
      project_index: 1,
    },
    {
      target_type: "video",
      reviewer: "陈特效",
      status: "rejected",
      comment: "时光隧道效果过于华丽，与整体基调不符，建议调整为更温暖的色调。",
      project_index: 1,
    },
    {
      target_type: "asset",
      reviewer: "孙设计",
      status: "resolved",
      comment: "外星使者的角色设计很好，建议增加一些微妙的非人类特征，比如瞳孔颜色。",
      project_index: 0,
    },
    {
      target_type: "clip",
      reviewer: "李剪辑",
      status: "open",
      comment: "第一集结尾的剪辑节奏需要调整，建议在悬念处停留更长时间。",
      project_index: 0,
    },
  ],
  publishPlans: [
    {
      name: "科幻系列第一季发布计划",
      status: "publishing",
      platforms: ["bilibili", "douyin", "xiaohongshu"],
      assignee: "张发行",
      notes: "计划在圣诞节期间发布前3集，后续每周更新一集",
    },
    {
      name: "爱情故事试播集发布",
      status: "scheduled",
      platforms: ["bilibili", "xiaohongshu"],
      assignee: "李发行",
      notes: "先发布第一集测试市场反应，根据反馈调整后续制作",
    },
    {
      name: "科幻系列完整季发布",
      status: "draft",
      platforms: ["youtube", "bilibili", "douyin", "kuaishou"],
      assignee: "王发行",
      notes: "等待第一季全部制作完成，计划明年春季全面上线",
    },
  ],
};

// ============================================================================
// 数据生成函数
// ============================================================================

interface GeneratedIds {
  projects: string[];
  conversations: string[];
  imageTasks: string[];
  videoTasks: string[];
  scripts: string[];
  storyboards: string[];
  characterAssets: string[];
  sceneAssets: string[];
}

/** 清除现有测试数据 */
async function cleanTestData(ctx: AppContext): Promise<void> {
  console.log("🗑️  清除现有测试数据...");

  // 获取所有测试项目
  const projects = await ctx.projects.findMany();
  const testProjects = projects.filter(p =>
    p.name.includes("星际迷航") || p.name.includes("时光里的你")
  );

  if (testProjects.length === 0) {
    console.log("  未找到测试数据，跳过清除");
    return;
  }

  const projectIds = testProjects.map(p => p.id);

  // 清除各表数据
  for (const id of projectIds) {
    // 清除会话和消息
    const conversations = await ctx.conversations.findMany({ project_id: id });
    for (const conv of conversations) {
      const messages = await ctx.messages.findMany({ conversation_id: conv.id });
      for (const msg of messages) {
        await ctx.messages.delete(msg.id);
      }
      await ctx.conversations.delete(conv.id);
    }

    // 清除项目相关数据
    const tasks = await ctx.projectTasks.findMany({ project_id: id });
    for (const task of tasks) await ctx.projectTasks.delete(task.id);

    const members = await ctx.projectMembers.findMany({ project_id: id });
    for (const member of members) await ctx.projectMembers.delete(member.id);

    const episodes = await ctx.projectEpisodes.findMany({ project_id: id });
    for (const ep of episodes) await ctx.projectEpisodes.delete(ep.id);

    const issues = await ctx.projectIssues.findMany({ project_id: id });
    for (const issue of issues) await ctx.projectIssues.delete(issue.id);

    const milestones = await ctx.projectMilestones.findMany({ project_id: id });
    for (const milestone of milestones) await ctx.projectMilestones.delete(milestone.id);

    const scripts = await ctx.projectScripts.findMany({ project_id: id });
    for (const script of scripts) await ctx.projectScripts.delete(script.id);

    const reviews = await ctx.projectReviews.findMany({ project_id: id });
    for (const review of reviews) await ctx.projectReviews.delete(review.id);

    const clips = await ctx.projectClips.findMany({ project_id: id });
    for (const clip of clips) await ctx.projectClips.delete(clip.id);

    const storyboards = await ctx.projectStoryboards.findMany({ project_id: id });
    for (const sb of storyboards) await ctx.projectStoryboards.delete(sb.id);

    const assets = await ctx.projectAssets.findMany({ project_id: id });
    for (const asset of assets) await ctx.projectAssets.delete(asset.id);

    // 清除项目
    await ctx.projects.delete(id);
  }

  // 清除独立的任务和收藏
  const allImages = await ctx.images.findMany();
  for (const img of allImages) {
    if (img.prompt && (img.prompt.includes("科幻") || img.prompt.includes("爱情") || img.prompt.includes("宇宙飞船"))) {
      await ctx.images.delete(img.id);
    }
  }

  const allVideos = await ctx.videos.findMany();
  for (const vid of allVideos) {
    if (vid.prompt && (vid.prompt.includes("宇宙飞船") || vid.prompt.includes("宇航员") || vid.prompt.includes("女主角"))) {
      await ctx.videos.delete(vid.id);
    }
  }

  // 清除发布计划
  const plans = await ctx.publishPlans.findMany();
  for (const plan of plans) {
    if (plan.name.includes("科幻系列") || plan.name.includes("爱情故事")) {
      await ctx.publishPlans.delete(plan.id);
    }
  }

  console.log(`  ✓ 已清除 ${testProjects.length} 个测试项目及相关数据`);
}

/** 创建测试项目 */
async function createProjects(ctx: AppContext): Promise<string[]> {
  console.log("\n📦 创建测试项目...");

  const ids: string[] = [];
  for (let i = 0; i < testDataConfig.projects.length; i++) {
    const config = testDataConfig.projects[i];
    const id = generateId();
    const now = timestamp(i);

    const project: Project = {
      id,
      name: config.name,
      category: config.category,
      status: config.status,
      description: config.description,
      episode_count: config.episode_count,
      owner: config.owner,
      due_date: "",
      is_default: false,
      is_pinned: false,
      created_at: now,
      updated_at: now,
      storage_path: "",
      storage_mode: "sqlite",
      archived_at: "",
    };

    await ctx.projects.insert(project);
    ids.push(id);
    console.log(`  ✓ 创建项目: ${config.name}`);
  }

  return ids;
}

/** 创建测试会话 */
async function createConversations(ctx: AppContext, projectIds: string[]): Promise<string[]> {
  console.log("\n💬 创建测试会话...");

  const ids: string[] = [];
  for (let i = 0; i < testDataConfig.conversations.length; i++) {
    const config = testDataConfig.conversations[i];
    const id = generateId();
    const now = timestamp(testDataConfig.conversations.length - i);

    const conversation: Conversation = {
      id,
      title: config.title,
      model: config.model,
      is_pinned: false,
      created_at: now,
      updated_at: now,
      project_id: projectIds[config.project_index],
    };

    await ctx.conversations.insert(conversation);
    ids.push(id);
    console.log(`  ✓ 创建会话: ${config.title}`);
  }

  return ids;
}

/** 创建图片生成任务 */
async function createImageTasks(ctx: AppContext, conversationIds: string[]): Promise<string[]> {
  console.log("\n🖼️  创建图片生成任务...");

  const ids: string[] = [];
  for (let i = 0; i < testDataConfig.imageTasks.length; i++) {
    const config = testDataConfig.imageTasks[i];
    const id = generateId();
    const now = timestamp(testDataConfig.imageTasks.length - i);

    const task: ImageTask = {
      id,
      prompt: config.prompt,
      negative: config.negative,
      params: {
        prompt: config.prompt,
        negative_prompt: config.negative,
        size: "1024x768",
        n: 1,
      },
      image_urls: config.status === "success"
        ? [`https://example.com/images/test-${i + 1}.jpg`]
        : [],
      status: config.status,
      error: config.status === "failed" ? "生成超时或参数错误" : "",
      created_at: now,
      conversation_id: conversationIds[config.conversation_index],
    };

    await ctx.images.insert(task);
    ids.push(id);
    console.log(`  ✓ 创建图片任务 [${config.status}]: ${config.prompt.substring(0, 30)}...`);
  }

  return ids;
}

/** 创建视频生成任务 */
async function createVideoTasks(ctx: AppContext, conversationIds: string[]): Promise<string[]> {
  console.log("\n🎬 创建视频生成任务...");

  const ids: string[] = [];
  for (let i = 0; i < testDataConfig.videoTasks.length; i++) {
    const config = testDataConfig.videoTasks[i];
    const id = generateId();
    const now = timestamp(testDataConfig.videoTasks.length - i);

    const task: VideoTask = {
      id,
      task_id: config.status === "success" ? `task-${id}` : "",
      video_id: config.status === "success" ? `video-${id}` : "",
      prompt: config.prompt,
      image_url: config.status === "success" ? `https://example.com/images/source-${i + 1}.jpg` : "",
      params: {
        prompt: config.prompt,
        ratio: "16:9",
        duration: 5,
      },
      video_url: config.status === "success"
        ? `https://example.com/videos/test-${i + 1}.mp4`
        : "",
      status: config.status,
      progress: config.status === "success" ? 100 : config.status === "processing" ? 45 : 0,
      seconds: "5",
      size: "1920x1080",
      error: config.status === "failed" ? "视频生成失败：内存不足" : "",
      created_at: now,
      conversation_id: conversationIds[config.conversation_index],
    };

    await ctx.videos.insert(task);
    ids.push(id);
    console.log(`  ✓ 创建视频任务 [${config.status}]: ${config.prompt.substring(0, 30)}...`);
  }

  return ids;
}

/** 创建剧本版本 */
async function createScripts(ctx: AppContext, projectIds: string[]): Promise<string[]> {
  console.log("\n📝 创建剧本版本...");

  const ids: string[] = [];
  for (let i = 0; i < testDataConfig.scripts.length; i++) {
    const config = testDataConfig.scripts[i];
    const id = generateId();
    const now = timestamp(testDataConfig.scripts.length - i);

    const script: ProjectScript = {
      id,
      project_id: projectIds[config.project_index],
      episode: config.episode,
      title: config.title,
      content: config.content,
      status: i < 2 ? "ready" : "draft",
      notes: "",
      created_at: now,
      updated_at: now,
    };

    await ctx.projectScripts.insert(script);
    ids.push(id);
    console.log(`  ✓ 创建剧本: 第${config.episode}集 - ${config.title}`);
  }

  return ids;
}

/** 创建分镜 */
async function createStoryboards(ctx: AppContext, projectIds: string[]): Promise<string[]> {
  console.log("\n🎞️  创建分镜...");

  const ids: string[] = [];
  for (let i = 0; i < testDataConfig.storyboards.length; i++) {
    const config = testDataConfig.storyboards[i];
    const id = generateId();
    const now = timestamp(testDataConfig.storyboards.length - i);

    const storyboard: ProjectStoryboard = {
      id,
      project_id: projectIds[config.project_index],
      episode: config.episode,
      scene: config.scene,
      shot: config.shot,
      title: config.title,
      description: config.description,
      dialogue: config.dialogue,
      characters: config.characters,
      character_asset_ids: [],
      location: config.location,
      scene_asset_id: "",
      shot_size: config.shot,
      camera_move: "固定",
      duration: config.duration,
      prompt: config.description,
      image_task_id: "",
      image_url: config.status === "done" || config.status === "video" || config.status === "review"
        ? `https://example.com/storyboards/${id}.jpg`
        : "",
      video_task_id: config.status === "video" || config.status === "review"
        ? generateId()
        : "",
      video_url: config.status === "video" || config.status === "review"
        ? `https://example.com/videos/${id}.mp4`
        : "",
      status: config.status as any,
      notes: "",
      created_at: now,
      updated_at: now,
    };

    await ctx.projectStoryboards.insert(storyboard);
    ids.push(id);
  }

  console.log(`  ✓ 已创建 ${ids.length} 个分镜`);
  return ids;
}

/** 创建角色资产 */
async function createCharacterAssets(ctx: AppContext, projectIds: string[]): Promise<string[]> {
  console.log("\n👤 创建角色资产...");

  const ids: string[] = [];
  for (let i = 0; i < testDataConfig.characterAssets.length; i++) {
    const config = testDataConfig.characterAssets[i];
    const id = generateId();
    const now = timestamp(testDataConfig.characterAssets.length - i);

    const asset: ProjectAsset = {
      id,
      project_id: projectIds[config.project_index],
      kind: "character",
      name: config.name,
      prompt: config.prompt,
      image_url: `https://example.com/characters/${id}.jpg`,
      video_url: "",
      folder: "角色",
      tags: ["角色", "主要"],
      is_favorite: i < 2,
      resolution: "1024x1024",
      duration: "",
      role_images: [],
      role_traits: config.role_traits,
      style_keywords: [],
      notes: "",
      created_at: now,
      updated_at: now,
    };

    await ctx.projectAssets.insert(asset);
    ids.push(id);
    console.log(`  ✓ 创建角色资产: ${config.name}`);
  }

  return ids;
}

/** 创建场景资产 */
async function createSceneAssets(ctx: AppContext, projectIds: string[]): Promise<string[]> {
  console.log("\n🏞️  创建场景资产...");

  const ids: string[] = [];
  for (let i = 0; i < testDataConfig.sceneAssets.length; i++) {
    const config = testDataConfig.sceneAssets[i];
    const id = generateId();
    const now = timestamp(testDataConfig.sceneAssets.length - i);

    const asset: ProjectAsset = {
      id,
      project_id: projectIds[config.project_index],
      kind: "scene",
      name: config.name,
      prompt: config.prompt,
      image_url: `https://example.com/scenes/${id}.jpg`,
      video_url: "",
      folder: "场景",
      tags: ["场景"],
      is_favorite: false,
      resolution: "1920x1080",
      duration: "",
      role_images: [],
      role_traits: [],
      style_keywords: [],
      notes: "",
      created_at: now,
      updated_at: now,
    };

    await ctx.projectAssets.insert(asset);
    ids.push(id);
    console.log(`  ✓ 创建场景资产: ${config.name}`);
  }

  return ids;
}

/** 创建审核记录 */
async function createReviews(ctx: AppContext, projectIds: string[], storyboardIds: string[]): Promise<string[]> {
  console.log("\n✅ 创建审核记录...");

  const ids: string[] = [];
  for (let i = 0; i < testDataConfig.reviews.length; i++) {
    const config = testDataConfig.reviews[i];
    const id = generateId();
    const now = timestamp(testDataConfig.reviews.length - i);

    let targetId = "";
    if (config.target_type === "storyboard") {
      targetId = storyboardIds[i % storyboardIds.length];
    } else if (config.target_type === "image") {
      targetId = `image-${generateId()}`;
    } else if (config.target_type === "video") {
      targetId = `video-${generateId()}`;
    } else if (config.target_type === "asset") {
      targetId = `asset-${generateId()}`;
    } else {
      targetId = `clip-${generateId()}`;
    }

    const review: ProjectReview = {
      id,
      project_id: projectIds[config.project_index],
      target_type: config.target_type,
      target_id: targetId,
      reviewer: config.reviewer,
      status: config.status,
      comment: config.comment,
      created_at: now,
      updated_at: now,
    };

    await ctx.projectReviews.insert(review);
    ids.push(id);
    console.log(`  ✓ 创建审核记录 [${config.status}]: ${config.reviewer}`);
  }

  return ids;
}

/** 创建发布计划 */
async function createPublishPlans(ctx: AppContext): Promise<string[]> {
  console.log("\n📢 创建发布计划...");

  const ids: string[] = [];
  for (let i = 0; i < testDataConfig.publishPlans.length; i++) {
    const config = testDataConfig.publishPlans[i];
    const id = generateId();
    const now = timestamp(testDataConfig.publishPlans.length - i);

    const plan: PublishPlan = {
      id,
      name: config.name,
      status: config.status,
      plannedDate: i === 0 ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() :
                    i === 1 ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString() : "",
      publishedDate: i === 0 && config.status === "published" ? timestamp(2) : "",
      videos: [],
      platforms: config.platforms as any,
      assignee: config.assignee,
      notes: config.notes,
      created_at: now,
      updated_at: now,
    };

    await ctx.publishPlans.insert(plan);
    ids.push(id);
    console.log(`  ✓ 创建发布计划 [${config.status}]: ${config.name}`);
  }

  return ids;
}

// ============================================================================
// 主函数
// ============================================================================

async function main(): Promise<void> {
  console.log("=".repeat(60));
  console.log("  Agnes AI Studio - 测试数据生成脚本");
  console.log("=".repeat(60));

  // 创建应用上下文
  const ctx = await createAppContext(process.cwd());

  try {
    // 检查是否需要清除现有数据
    const shouldClean = process.argv.includes("--clean");
    if (shouldClean) {
      await cleanTestData(ctx);
    }

    console.log("\n🚀 开始创建测试数据...\n");

    // 按顺序创建数据，确保外键关联正确
    const projectIds = await createProjects(ctx);
    const conversationIds = await createConversations(ctx, projectIds);
    const imageTaskIds = await createImageTasks(ctx, conversationIds);
    const videoTaskIds = await createVideoTasks(ctx, conversationIds);
    const scriptIds = await createScripts(ctx, projectIds);
    const storyboardIds = await createStoryboards(ctx, projectIds);
    const characterAssetIds = await createCharacterAssets(ctx, projectIds);
    const sceneAssetIds = await createSceneAssets(ctx, projectIds);
    const reviewIds = await createReviews(ctx, projectIds, storyboardIds);
    const publishPlanIds = await createPublishPlans(ctx);

    // 输出统计
    console.log("\n" + "=".repeat(60));
    console.log("  ✅ 测试数据创建完成！");
    console.log("=".repeat(60));
    console.log("\n📊 数据统计：");
    console.log(`  - 项目:        ${projectIds.length} 个`);
    console.log(`  - 会话:        ${conversationIds.length} 个`);
    console.log(`  - 图片任务:    ${imageTaskIds.length} 个 (完成: 8, 进行中: 2, 排队: 2, 失败: 3)`);
    console.log(`  - 视频任务:    ${videoTaskIds.length} 个 (完成: 5, 进行中: 2, 失败: 1)`);
    console.log(`  - 剧本版本:    ${scriptIds.length} 个`);
    console.log(`  - 分镜:        ${storyboardIds.length} 个`);
    console.log(`  - 角色资产:    ${characterAssetIds.length} 个`);
    console.log(`  - 场景资产:    ${sceneAssetIds.length} 个`);
    console.log(`  - 审核记录:    ${reviewIds.length} 个`);
    console.log(`  - 发布计划:    ${publishPlanIds.length} 个`);
    console.log("\n💡 提示：");
    console.log("  - 使用 --clean 参数可以清除现有测试数据后重新创建");
    console.log("  - 所有数据已保存到 SQLite 数据库中");
    console.log("=".repeat(60) + "\n");

  } catch (error) {
    console.error("\n❌ 创建测试数据时出错：", error);
    process.exit(1);
  } finally {
    ctx.close();
  }
}

// 执行主函数
main().catch(console.error);