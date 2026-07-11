/**
 * 独立模块测试数据生成脚本
 *
 * 功能：
 * - 根据项目中心 7 个进行中（active）项目，为 AI 生产中心各独立模块生成真实测试数据
 * - 覆盖模块：剧本、角色、场景、分镜、音频、资产、审核、视频任务
 * - 数据直接写入 SQLite，不依赖前端 mock 数据
 *
 * 使用方法：
 * - npm run build && node dist/scripts/create-module-test-data.js           # 追加数据
 * - npm run build && node dist/scripts/create-module-test-data.js --clean    # 清除后重建
 */

import { createAppContext, type AppContext } from "../src/services/app.js";
import type { Script, Character, Scene, Storyboard, Audio, Asset, Review, ModuleVideoTask } from "../src/types.js";
import { id } from "../src/utils.js";

// ============================================================================
// 7 个进行中项目（与前端项目中心保持一致）
// ============================================================================

interface ProjectTheme {
  id: string;
  name: string;
  category: string;
  owner: string;
  characters: Array<{ name: string; role: string; gender: string; age: number; traits: string[]; description: string }>;
  scenes: Array<{ name: string; type: string; description: string; lighting: string; time_of_day: string; weather: string }>;
  scripts: Array<{ title: string; description: string; words: number; chapters: number; author: string; tags: string[] }>;
  storyboards: Array<{ description: string; duration: number; camera_angle: string; movement: string; dialogue: string; status: string }>;
  audios: Array<{ name: string; type: string; duration: number; speaker: string; tags: string[] }>;
  assets: Array<{ name: string; type: string; format: string; size: number; tags: string[] }>;
  videos: Array<{ title: string; status: string; progress: number; duration: number; resolution: string; fps: number }>;
  reviews: Array<{ content_type: string; content_title: string; result: string; score: number; comment: string; reviewer_name: string }>;
}

const projectThemes: ProjectTheme[] = [
  // 项目1：星际迷航：新纪元（科幻冒险）
  {
    id: "proj-1",
    name: "星际迷航：新纪元", category: "科幻冒险漫剧", owner: "王导演",
    characters: [
      { name: "林宇舰长", role: "protagonist", gender: "male", age: 35, traits: ["勇敢", "智慧", "领导力", "正义感"], description: "银河号首席舰长，坚毅果敢，肩负人类星际探索使命" },
      { name: "陈雪博士", role: "supporting", gender: "female", age: 30, traits: ["聪明", "细心", "善良", "专业"], description: "飞船首席科学官，负责外星文明研究" },
      { name: "塞利亚使者", role: "supporting", gender: "other", age: 200, traits: ["神秘", "友善", "智慧", "和平"], description: "织女星系塞利亚人外交使者，蓝色皮肤" },
      { name: "张伟技术员", role: "minor", gender: "male", age: 25, traits: ["认真", "技术宅", "可靠", "幽默"], description: "飞船技术部年轻工程师" },
      { name: "暗影指挥官", role: "antagonist", gender: "male", age: 45, traits: ["冷酷", "野心", "战略家", "无情"], description: "敌对势力的军事指挥官" },
    ],
    scenes: [
      { name: "银河号舰桥", type: "indoor", description: "科幻飞船指挥中心，全息显示屏，蓝色照明", lighting: "冷蓝光", time_of_day: "全天", weather: "室内" },
      { name: "太空港", type: "outdoor", description: "巨大环形太空港，停泊各类飞船，背景是蔚蓝地球", lighting: "星光", time_of_day: "太空", weather: "真空" },
      { name: "外星飞船内部", type: "indoor", description: "银白色流线型设计，柔和光线，未知科技设备", lighting: "柔白光", time_of_day: "全天", weather: "室内" },
      { name: "异星地表", type: "outdoor", description: "紫色天空的外星地表，奇异植物和晶体矿脉", lighting: "紫光", time_of_day: "白天", weather: "晴" },
      { name: "宇航局总部", type: "indoor", description: "现代化宇航局建筑，大厅展示火箭模型", lighting: "日光灯", time_of_day: "白天", weather: "室内" },
    ],
    scripts: [
      { title: "星际迷航：新纪元 第1集 - 启程", description: "银河号首次启航，发现未知文明信号", words: 8500, chapters: 3, author: "王导演", tags: ["科幻", "冒险", "第一集"] },
      { title: "星际迷航：新纪元 第2集 - 第一次接触", description: "与塞利亚人首次外交接触，面临银河联盟考验", words: 9200, chapters: 3, author: "王导演", tags: ["科幻", "外交", "外星文明"] },
      { title: "星际迷航：新纪元 第3集 - 暗影来袭", description: "暗影势力偷袭银河号，舰长临危不乱", words: 8800, chapters: 4, author: "李编剧", tags: ["科幻", "战斗", "危机"] },
    ],
    storyboards: [
      { description: "镜头从太空视角缓缓下降，经云层定格在宇航局建筑群", duration: 8, camera_angle: "远景俯拍", movement: "缓慢下降", dialogue: "", status: "completed" },
      { description: "林宇走进办公室，墙上挂着星际探索计划海报", duration: 6, camera_angle: "中景", movement: "跟随", dialogue: "林宇：今天是我们踏上星际探索之旅的第一天。", status: "completed" },
      { description: "陈雪站在屏幕前汇报飞船系统状态", duration: 5, camera_angle: "近景", movement: "固定", dialogue: "陈雪：舰长，所有系统检查完毕。", status: "approved" },
      { description: "银白色飞船静静停泊太空港，背景是蔚蓝地球", duration: 10, camera_angle: "全景", movement: "环绕", dialogue: "", status: "production" },
      { description: "林宇站在舰桥望向星空，眼神坚定", duration: 4, camera_angle: "特写", movement: "推近", dialogue: "林宇：通知所有船员，准备启航。", status: "completed" },
      { description: "飞船尾部喷射蓝色光芒，缓缓加速驶向深空", duration: 8, camera_angle: "远景", movement: "跟随", dialogue: "", status: "approved" },
    ],
    audios: [
      { name: "林宇台词配音 - 第1集", type: "voiceover", duration: 180, speaker: "声优A", tags: ["主角", "第1集"] },
      { name: "陈雪台词配音 - 第1集", type: "voiceover", duration: 120, speaker: "声优B", tags: ["女主角", "第1集"] },
      { name: "太空冒险BGM", type: "bgm", duration: 300, speaker: "", tags: ["背景音乐", "科幻"] },
      { name: "飞船引擎音效", type: "sfx", duration: 15, speaker: "", tags: ["音效", "机械"] },
      { name: "激光射击音效", type: "sfx", duration: 3, speaker: "", tags: ["音效", "战斗"] },
    ],
    assets: [
      { name: "林宇角色立绘", type: "image", format: "png", size: 2048576, tags: ["角色", "主角"] },
      { name: "银河号飞船设计图", type: "image", format: "png", size: 4194304, tags: ["场景", "飞船"] },
      { name: "第1集开场动画", type: "video", format: "mp4", size: 52428800, tags: ["动画", "开场"] },
      { name: "第1集剧本文档", type: "document", format: "docx", size: 102400, tags: ["剧本", "文档"] },
      { name: "太空BGM音频", type: "audio", format: "mp3", size: 8388608, tags: ["音乐", "背景"] },
    ],
    videos: [
      { title: "第1集 - 银河号启航", status: "completed", progress: 100, duration: 300, resolution: "1920x1080", fps: 30 },
      { title: "第1集 - 太空战斗场景", status: "completed", progress: 100, duration: 180, resolution: "1920x1080", fps: 30 },
      { title: "第2集 - 外星接触", status: "processing", progress: 65, duration: 240, resolution: "1920x1080", fps: 30 },
      { title: "第3集 - 暗影来袭预告", status: "queued", progress: 0, duration: 60, resolution: "1920x1080", fps: 30 },
      { title: "角色介绍 - 林宇", status: "completed", progress: 100, duration: 45, resolution: "1280x720", fps: 24 },
    ],
    reviews: [
      { content_type: "script", content_title: "第1集剧本审核", result: "approved", score: 92, comment: "剧本结构完整，角色塑造鲜明，建议增加科幻设定细节", reviewer_name: "王监制" },
      { content_type: "image", content_title: "林宇角色立绘审核", result: "approved", score: 88, comment: "角色设计符合设定，宇航服细节到位", reviewer_name: "张美术" },
      { content_type: "video", content_title: "第1集开场动画审核", result: "pending", score: 0, comment: "等待最终审核", reviewer_name: "刘剪辑" },
      { content_type: "audio", content_title: "太空BGM审核", result: "approved", score: 90, comment: "音乐氛围契合科幻主题", reviewer_name: "陈音乐" },
      { content_type: "script", content_title: "第3集剧本审核", result: "rejected", score: 65, comment: "战斗场景描写过于简单，需加强紧张感", reviewer_name: "王监制" },
    ],
  },
  // 项目2：江湖风云录（古风武侠）
  {
    id: "proj-2",
    name: "江湖风云录", category: "古风武侠剧", owner: "李制片",
    characters: [
      { name: "叶轻舟", role: "protagonist", gender: "male", age: 28, traits: ["侠义", "洒脱", "剑术超群", "重情义"], description: "江湖第一剑客，浪迹天涯的侠士" },
      { name: "苏婉清", role: "supporting", gender: "female", age: 24, traits: ["聪慧", "冷艳", "医术精湛", "神秘"], description: "神医传人，与叶轻舟有纠葛" },
      { name: "风无痕", role: "antagonist", gender: "male", age: 40, traits: ["阴险", "武功高强", "野心勃勃", "心狠手辣"], description: "魔教教主，江湖第一反派" },
      { name: "老酒鬼", role: "supporting", gender: "male", age: 60, traits: ["嗜酒", "深藏不露", "智慧", "幽默"], description: "叶轻舟的师父，隐世高手" },
      { name: "小石头", role: "minor", gender: "male", age: 15, traits: ["忠诚", "机灵", "勇敢", "成长"], description: "叶轻舟收留的小徒弟" },
    ],
    scenes: [
      { name: "竹林密境", type: "outdoor", description: "翠竹成林，微风沙沙，剑客比武之地", lighting: "斑驳日光", time_of_day: "白天", weather: "晴" },
      { name: "江湖客栈", type: "indoor", description: "古色古香的客栈，江湖人士聚集之地", lighting: "暖黄灯光", time_of_day: "傍晚", weather: "室内" },
      { name: "雪山顶峰", type: "outdoor", description: "白雪皑皑的高山峰顶，决战的舞台", lighting: "冷白光", time_of_day: "白天", weather: "雪" },
      { name: "魔教总坛", type: "indoor", description: "阴暗诡异的地下宫殿，烛火摇曳", lighting: "暗红烛光", time_of_day: "夜晚", weather: "室内" },
      { name: "江南水乡", type: "outdoor", description: "小桥流水人家，烟雨朦胧的江南景色", lighting: "柔光", time_of_day: "白天", weather: "雨" },
    ],
    scripts: [
      { title: "江湖风云录 第1集 - 剑出竹林", description: "叶轻舟竹林初现，一战成名", words: 7800, chapters: 4, author: "李制片", tags: ["武侠", "首集", "剑客"] },
      { title: "江湖风云录 第2集 - 客栈惊变", description: "客栈偶遇苏婉清，卷入江湖阴谋", words: 8200, chapters: 3, author: "李制片", tags: ["武侠", "悬疑", "相遇"] },
      { title: "江湖风云录 第3集 - 魔教现世", description: "魔教教主风无痕现身，江湖大乱", words: 9000, chapters: 5, author: "赵编剧", tags: ["武侠", "反派", "冲突"] },
    ],
    storyboards: [
      { description: "竹林中剑光闪烁，叶轻舟拔剑而出", duration: 6, camera_angle: "中景", movement: "快速推近", dialogue: "叶轻舟：在下叶轻舟，请教了。", status: "completed" },
      { description: "客栈内众人举杯，气氛热闹", duration: 8, camera_angle: "全景", movement: "平移", dialogue: "", status: "approved" },
      { description: "苏婉清倚窗而立，冷艳动人", duration: 5, camera_angle: "近景", movement: "固定", dialogue: "苏婉清：这里不欢迎江湖人。", status: "production" },
      { description: "雪山顶峰两人对峙，风雪交加", duration: 10, camera_angle: "远景", movement: "环绕", dialogue: "", status: "draft" },
      { description: "魔教总坛内烛火摇曳，风无痕端坐", duration: 7, camera_angle: "仰拍", movement: "缓慢上升", dialogue: "风无痕：江湖，该变天了。", status: "approved" },
      { description: "小桥流水旁，叶轻舟与苏婉清并肩而行", duration: 8, camera_angle: "中景", movement: "跟随", dialogue: "", status: "completed" },
    ],
    audios: [
      { name: "叶轻舟台词配音", type: "voiceover", duration: 200, speaker: "声优C", tags: ["主角", "武侠"] },
      { name: "苏婉清台词配音", type: "voiceover", duration: 150, speaker: "声优D", tags: ["女主角"] },
      { name: "古风武侠BGM", type: "bgm", duration: 280, speaker: "", tags: ["背景音乐", "古风"] },
      { name: "剑击音效", type: "sfx", duration: 2, speaker: "", tags: ["音效", "兵器"] },
      { name: "竹林风声", type: "sfx", duration: 30, speaker: "", tags: ["音效", "环境"] },
    ],
    assets: [
      { name: "叶轻舟角色立绘", type: "image", format: "png", size: 1843200, tags: ["角色", "主角"] },
      { name: "竹林场景图", type: "image", format: "jpg", size: 3145728, tags: ["场景", "竹林"] },
      { name: "第1集武侠打斗视频", type: "video", format: "mp4", size: 62914560, tags: ["视频", "动作"] },
      { name: "江湖地图设计稿", type: "document", format: "pdf", size: 204800, tags: ["设定", "地图"] },
      { name: "古风BGM合集", type: "audio", format: "flac", size: 16777216, tags: ["音乐", "古风"] },
    ],
    videos: [
      { title: "第1集 - 竹林比剑", status: "completed", progress: 100, duration: 360, resolution: "1920x1080", fps: 30 },
      { title: "第2集 - 客栈风云", status: "completed", progress: 100, duration: 320, resolution: "1920x1080", fps: 30 },
      { title: "第3集 - 雪山决战", status: "processing", progress: 45, duration: 420, resolution: "1920x1080", fps: 30 },
      { title: "角色介绍 - 叶轻舟", status: "completed", progress: 100, duration: 50, resolution: "1280x720", fps: 24 },
      { title: "江湖风景宣传片", status: "failed", progress: 0, duration: 120, resolution: "1920x1080", fps: 30 },
    ],
    reviews: [
      { content_type: "script", content_title: "第1集剧本审核", result: "approved", score: 95, comment: "武侠氛围浓厚，人物刻画到位", reviewer_name: "李监制" },
      { content_type: "image", content_title: "叶轻舟立绘审核", result: "approved", score: 91, comment: "剑客气质完美呈现", reviewer_name: "王美术" },
      { content_type: "video", content_title: "竹林比剑视频审核", result: "approved", score: 89, comment: "动作流畅，节奏紧凑", reviewer_name: "张剪辑" },
      { content_type: "audio", content_title: "古风BGM审核", result: "pending", score: 0, comment: "待最终确认", reviewer_name: "陈音乐" },
      { content_type: "script", content_title: "第3集剧本审核", result: "pending", score: 0, comment: "决战场景待细化", reviewer_name: "李监制" },
    ],
  },
  // 项目3：都市爱情故事
  {
    id: "proj-3",
    name: "都市爱情故事", category: "现代都市爱情剧", owner: "张编辑",
    characters: [
      { name: "顾晨", role: "protagonist", gender: "male", age: 28, traits: ["执着", "浪漫", "才华横溢", "忧郁"], description: "来自1985年的建筑师，穿越时空寻找爱人" },
      { name: "苏婉", role: "supporting", gender: "female", age: 26, traits: ["温柔", "善良", "独立", "感性"], description: "现代都市女孩，与顾晨有命中注定的缘分" },
      { name: "咖啡店老板", role: "minor", gender: "male", age: 60, traits: ["慈祥", "智慧", "神秘", "善良"], description: "老街咖啡店老板，似乎知道时间秘密" },
      { name: "小美", role: "supporting", gender: "female", age: 25, traits: ["活泼", "直率", "乐观", "热心"], description: "苏婉的闺蜜，感情军师" },
      { name: "李总", role: "antagonist", gender: "male", age: 42, traits: ["精明", "强势", "占有欲强", "现实"], description: "公司高管，追求苏婉" },
    ],
    scenes: [
      { name: "老街咖啡店", type: "indoor", description: "复古风格咖啡店，木质家具，暖黄灯光", lighting: "暖黄光", time_of_day: "傍晚", weather: "室内" },
      { name: "都市夜景街道", type: "outdoor", description: "霓虹灯闪烁的现代都市街道", lighting: "霓虹灯", time_of_day: "夜晚", weather: "晴" },
      { name: "苏婉的公寓", type: "indoor", description: "现代简约风格公寓，落地窗对着城市夜景", lighting: "柔光", time_of_day: "夜晚", weather: "室内" },
      { name: "樱花公园", type: "outdoor", description: "春天樱花盛开的公园，花瓣漫天飞舞", lighting: "日光", time_of_day: "白天", weather: "晴" },
      { name: "80年代老街", type: "virtual", description: "顾晨记忆中的80年代老街，怀旧氛围", lighting: "暖光", time_of_day: "白天", weather: "晴" },
    ],
    scripts: [
      { title: "都市爱情故事 第1集 - 相遇", description: "苏婉与穿越而来的顾晨在咖啡店相遇", words: 7200, chapters: 3, author: "张编辑", tags: ["爱情", "穿越", "相遇"] },
      { title: "都市爱情故事 第2集 - 时间悖论", description: "顾晨发现苏婉是回到过去的关键", words: 8000, chapters: 4, author: "张编辑", tags: ["爱情", "穿越", "悬疑"] },
      { title: "都市爱情故事 第3集 - 抉择", description: "顾晨面临回到过去还是留下的抉择", words: 8500, chapters: 4, author: "刘编剧", tags: ["爱情", "抉择", "高潮"] },
    ],
    storyboards: [
      { description: "苏婉推开咖啡店门，阳光洒在侧脸", duration: 6, camera_angle: "中景", movement: "跟随", dialogue: "苏婉：这家咖啡店真有味道。", status: "completed" },
      { description: "顾晨慌张跑来撞到苏婉，两人对视", duration: 4, camera_angle: "近景", movement: "快速推近", dialogue: "顾晨：抱歉抱歉！", status: "approved" },
      { description: "两人窗边对坐，夕阳洒入", duration: 10, camera_angle: "中景", movement: "固定", dialogue: "顾晨：我叫顾晨，来自1985年。", status: "completed" },
      { description: "都市夜景，霓虹灯下两人并肩而行", duration: 8, camera_angle: "全景", movement: "跟随", dialogue: "", status: "production" },
      { description: "樱花树下两人相拥，花瓣飘落", duration: 6, camera_angle: "特写", movement: "环绕", dialogue: "苏婉：不管你来自哪里，我都要找到你。", status: "approved" },
      { description: "时间扭曲特效，周围空气涟漪", duration: 5, camera_angle: "特写", movement: "推近", dialogue: "", status: "draft" },
    ],
    audios: [
      { name: "顾晨台词配音", type: "voiceover", duration: 190, speaker: "声优E", tags: ["主角", "爱情"] },
      { name: "苏婉台词配音", type: "voiceover", duration: 175, speaker: "声优F", tags: ["女主角"] },
      { name: "都市爱情BGM", type: "bgm", duration: 260, speaker: "", tags: ["背景音乐", "爱情"] },
      { name: "咖啡店环境音", type: "sfx", duration: 60, speaker: "", tags: ["音效", "环境"] },
      { name: "樱花飘落音效", type: "sfx", duration: 10, speaker: "", tags: ["音效", "自然"] },
    ],
    assets: [
      { name: "顾晨角色立绘", type: "image", format: "png", size: 1638400, tags: ["角色", "主角"] },
      { name: "咖啡店场景图", type: "image", format: "jpg", size: 2949120, tags: ["场景", "咖啡店"] },
      { name: "第1集预告片", type: "video", format: "mp4", size: 41943040, tags: ["预告", "爱情"] },
      { name: "角色关系图", type: "document", format: "pdf", size: 153600, tags: ["设定", "关系图"] },
      { name: "都市爱情BGM", type: "audio", format: "mp3", size: 7340032, tags: ["音乐", "爱情"] },
    ],
    videos: [
      { title: "第1集 - 咖啡店相遇", status: "completed", progress: 100, duration: 280, resolution: "1920x1080", fps: 30 },
      { title: "第2集 - 时间涟漪", status: "completed", progress: 100, duration: 300, resolution: "1920x1080", fps: 30 },
      { title: "第3集 - 最终抉择", status: "processing", progress: 70, duration: 350, resolution: "1920x1080", fps: 30 },
      { title: "角色介绍 - 顾晨与苏婉", status: "completed", progress: 100, duration: 60, resolution: "1280x720", fps: 24 },
      { title: "樱花场景特写", status: "queued", progress: 0, duration: 30, resolution: "1920x1080", fps: 30 },
    ],
    reviews: [
      { content_type: "script", content_title: "第1集剧本审核", result: "approved", score: 90, comment: "爱情氛围到位，穿越设定新颖", reviewer_name: "张监制" },
      { content_type: "image", content_title: "顾晨立绘审核", result: "approved", score: 87, comment: "复古气质与忧郁感兼具", reviewer_name: "李美术" },
      { content_type: "video", content_title: "第1集预告片审核", result: "pending", score: 0, comment: "节奏待优化", reviewer_name: "王剪辑" },
      { content_type: "audio", content_title: "爱情BGM审核", result: "approved", score: 93, comment: "旋律优美，契合主题", reviewer_name: "陈音乐" },
      { content_type: "script", content_title: "第3集剧本审核", result: "pending", score: 0, comment: "结局待讨论", reviewer_name: "张监制" },
    ],
  },
  // 项目4：奇幻童话世界
  {
    id: "proj-4",
    name: "奇幻童话世界", category: "奇幻儿童剧", owner: "刘导演",
    characters: [
      { name: "小星精灵", role: "protagonist", gender: "other", age: 100, traits: ["可爱", "好奇", "善良", "魔法"], description: "森林里的小精灵，拥有星光的魔法" },
      { name: "兔子先生", role: "supporting", gender: "male", age: 50, traits: ["绅士", "幽默", "勇敢", "忠诚"], description: "穿西装的兔子，小星的冒险伙伴" },
      { name: "森林女王", role: "supporting", gender: "female", age: 500, traits: ["威严", "慈爱", "智慧", "强大"], description: "森林的守护者，掌管自然魔法" },
      { name: "小熊布布", role: "minor", gender: "male", age: 8, traits: ["憨厚", "勇敢", "贪吃", "可爱"], description: "小熊伙伴，力大无穷但胆小" },
      { name: "暗影巫师", role: "antagonist", gender: "male", age: 300, traits: ["狡猾", "强大", "贪婪", "嫉妒"], description: "企图夺走森林魔法的反派" },
    ],
    scenes: [
      { name: "魔法森林", type: "outdoor", description: "发光蘑菇和彩色花朵的奇幻森林", lighting: "荧光", time_of_day: "夜晚", weather: "雾" },
      { name: "糖果城堡", type: "indoor", description: "用糖果和巧克力建造的梦幻城堡", lighting: "暖光", time_of_day: "白天", weather: "室内" },
      { name: "星空湖畔", type: "outdoor", description: "倒映星空的平静湖面，萤火虫飞舞", lighting: "星光", time_of_day: "夜晚", weather: "晴" },
      { name: "树屋村庄", type: "indoor", description: "森林深处树上的小屋村庄", lighting: "暖黄光", time_of_day: "白天", weather: "室内" },
      { name: "暗影洞穴", type: "indoor", description: "阴暗潮湿的地下洞穴，弥漫黑雾", lighting: "暗绿光", time_of_day: "全天", weather: "室内" },
    ],
    scripts: [
      { title: "奇幻童话世界 第1集 - 小星诞生", description: "小星精灵在魔法森林中诞生并结识伙伴", words: 6000, chapters: 3, author: "刘导演", tags: ["童话", "奇幻", "诞生"] },
      { title: "奇幻童话世界 第2集 - 糖果城堡冒险", description: "小伙伴们前往糖果城堡寻找魔法宝石", words: 6500, chapters: 4, author: "刘导演", tags: ["童话", "冒险", "宝石"] },
      { title: "奇幻童话世界 第3集 - 暗影来袭", description: "暗影巫师偷走森林魔法，小星出发拯救", words: 7000, chapters: 4, author: "王编剧", tags: ["童话", "危机", "勇气"] },
    ],
    storyboards: [
      { description: "小星从发光蘑菇中诞生，星光闪烁", duration: 8, camera_angle: "特写", movement: "缓慢拉远", dialogue: "小星：哇，这个世界好美！", status: "completed" },
      { description: "兔子先生鞠躬自我介绍", duration: 5, camera_angle: "中景", movement: "固定", dialogue: "兔子先生：很高兴认识你，小星。", status: "approved" },
      { description: "糖果城堡全景，色彩缤纷", duration: 10, camera_angle: "全景", movement: "环绕", dialogue: "", status: "production" },
      { description: "星空湖畔萤火虫围绕小星", duration: 7, camera_angle: "中景", movement: "跟随", dialogue: "", status: "completed" },
      { description: "暗影巫师在洞穴中施法，黑雾弥漫", duration: 6, camera_angle: "仰拍", movement: "推近", dialogue: "暗影巫师：森林的魔法将属于我！", status: "approved" },
      { description: "小星和伙伴们手拉手面对挑战", duration: 5, camera_angle: "中景", movement: "固定", dialogue: "小星：我们一起，一定可以！", status: "draft" },
    ],
    audios: [
      { name: "小星精灵配音", type: "voiceover", duration: 160, speaker: "声优G", tags: ["主角", "童话"] },
      { name: "兔子先生配音", type: "voiceover", duration: 130, speaker: "声优H", tags: ["配角"] },
      { name: "梦幻童话BGM", type: "bgm", duration: 240, speaker: "", tags: ["背景音乐", "童话"] },
      { name: "魔法音效", type: "sfx", duration: 3, speaker: "", tags: ["音效", "魔法"] },
      { name: "森林动物声", type: "sfx", duration: 45, speaker: "", tags: ["音效", "自然"] },
    ],
    assets: [
      { name: "小星精灵立绘", type: "image", format: "png", size: 1228800, tags: ["角色", "主角"] },
      { name: "魔法森林场景图", type: "image", format: "jpg", size: 2457600, tags: ["场景", "森林"] },
      { name: "第1集动画视频", type: "video", format: "mp4", size: 36700160, tags: ["动画", "童话"] },
      { name: "童话设定集", type: "document", format: "pdf", size: 102400, tags: ["设定", "文档"] },
      { name: "梦幻BGM合集", type: "audio", format: "mp3", size: 6291456, tags: ["音乐", "童话"] },
    ],
    videos: [
      { title: "第1集 - 小星诞生", status: "completed", progress: 100, duration: 240, resolution: "1920x1080", fps: 24 },
      { title: "第2集 - 糖果城堡", status: "completed", progress: 100, duration: 260, resolution: "1920x1080", fps: 24 },
      { title: "第3集 - 暗影来袭", status: "processing", progress: 55, duration: 280, resolution: "1920x1080", fps: 24 },
      { title: "角色介绍 - 小星与伙伴", status: "completed", progress: 100, duration: 40, resolution: "1280x720", fps: 24 },
      { title: "魔法森林风景片", status: "queued", progress: 0, duration: 90, resolution: "1920x1080", fps: 30 },
    ],
    reviews: [
      { content_type: "script", content_title: "第1集剧本审核", result: "approved", score: 94, comment: "童话风格鲜明，适合儿童观看", reviewer_name: "刘监制" },
      { content_type: "image", content_title: "小星精灵立绘审核", result: "approved", score: 96, comment: "角色设计可爱，色彩明亮", reviewer_name: "王美术" },
      { content_type: "video", content_title: "第1集动画审核", result: "approved", score: 90, comment: "动画流畅，配乐合适", reviewer_name: "张剪辑" },
      { content_type: "audio", content_title: "童话BGM审核", result: "pending", score: 0, comment: "等待最终确认", reviewer_name: "陈音乐" },
      { content_type: "script", content_title: "第3集剧本审核", result: "pending", score: 0, comment: "反派描写需谨慎，避免吓到儿童", reviewer_name: "刘监制" },
    ],
  },
  // 项目5：悬疑推理剧场
  {
    id: "proj-5",
    name: "悬疑推理剧场", category: "悬疑推理剧", owner: "赵编剧",
    characters: [
      { name: "沈墨探长", role: "protagonist", gender: "male", age: 38, traits: ["冷静", "洞察力强", "逻辑严密", "孤独"], description: "天才侦探，破案率百分之百" },
      { name: "林小雨", role: "supporting", gender: "female", age: 28, traits: ["敏锐", "正义", "勇敢", "热血"], description: "年轻女警探，沈墨的搭档" },
      { name: "方教授", role: "antagonist", gender: "male", age: 55, traits: ["高智商", "伪善", "控制欲", "残忍"], description: "心理学教授，幕后黑手" },
      { name: "老陈法医", role: "supporting", gender: "male", age: 50, traits: ["专业", "沉稳", "细心", "幽默"], description: "资深法医，提供关键线索" },
      { name: "神秘女子", role: "minor", gender: "female", age: 30, traits: ["神秘", "冷静", "矛盾", "悲剧"], description: "案件的关键证人，身份成谜" },
    ],
    scenes: [
      { name: "凶案现场 - 废弃工厂", type: "indoor", description: "昏暗废弃工厂，警戒线围绕，血迹斑斑", lighting: "冷白光", time_of_day: "夜晚", weather: "室内" },
      { name: "警察局办公室", type: "indoor", description: "堆满案卷的办公室，白板上贴满线索", lighting: "日光灯", time_of_day: "白天", weather: "室内" },
      { name: "大学校园", type: "outdoor", description: "阴沉的大学校园，教学楼若隐若现", lighting: "阴天灰光", time_of_day: "白天", weather: "阴" },
      { name: "审讯室", type: "indoor", description: "灰白墙壁的审讯室，单面镜后面是观察室", lighting: "强白光", time_of_day: "全天", weather: "室内" },
      { name: "雨夜街道", type: "outdoor", description: "暴雨中的空旷街道，路灯昏暗", lighting: "昏黄路灯", time_of_day: "夜晚", weather: "暴雨" },
    ],
    scripts: [
      { title: "悬疑推理剧场 第1集 - 连环失踪", description: "大学城发生连环失踪案，沈墨介入调查", words: 8800, chapters: 5, author: "赵编剧", tags: ["悬疑", "推理", "首集"] },
      { title: "悬疑推理剧场 第2集 - 心理陷阱", description: "方教授介入案件，心理博弈开始", words: 9500, chapters: 4, author: "赵编剧", tags: ["悬疑", "心理", "博弈"] },
      { title: "悬疑推理剧场 第3集 - 真相大白", description: "沈墨揭开真相，方教授真面目暴露", words: 9200, chapters: 5, author: "钱编剧", tags: ["悬疑", "结局", "真相"] },
    ],
    storyboards: [
      { description: "废棄工厂内警灯闪烁，沈墨走进现场", duration: 8, camera_angle: "跟随中景", movement: "跟随", dialogue: "沈墨：保护好现场，不要遗漏任何细节。", status: "completed" },
      { description: "林小雨蹲下检查地面的痕迹", duration: 5, camera_angle: "近景", movement: "固定", dialogue: "林小雨：探长，这里有新发现。", status: "approved" },
      { description: "白板上贴满照片和线索，沈墨沉思", duration: 6, camera_angle: "中景", movement: "缓慢推近", dialogue: "", status: "production" },
      { description: "审讯室内方教授面带微笑", duration: 7, camera_angle: "特写", movement: "固定", dialogue: "方教授：探长，你确定是我吗？", status: "approved" },
      { description: "暴雨夜街道，神秘女子撑伞而行", duration: 10, camera_angle: "远景", movement: "跟随", dialogue: "", status: "draft" },
      { description: "沈墨在雨中凝视证据，眼神锐利", duration: 5, camera_angle: "特写", movement: "推近", dialogue: "沈墨：真相只有一个。", status: "completed" },
    ],
    audios: [
      { name: "沈墨台词配音", type: "voiceover", duration: 210, speaker: "声优I", tags: ["主角", "悬疑"] },
      { name: "林小雨台词配音", type: "voiceover", duration: 165, speaker: "声优J", tags: ["女主角"] },
      { name: "悬疑推理BGM", type: "bgm", duration: 320, speaker: "", tags: ["背景音乐", "悬疑"] },
      { name: "雨声环境音", type: "sfx", duration: 120, speaker: "", tags: ["音效", "环境"] },
      { name: "心跳紧张音效", type: "sfx", duration: 5, speaker: "", tags: ["音效", "紧张"] },
    ],
    assets: [
      { name: "沈墨探长立绘", type: "image", format: "png", size: 1433600, tags: ["角色", "主角"] },
      { name: "凶案现场图", type: "image", format: "jpg", size: 2744320, tags: ["场景", "案发现场"] },
      { name: "第1集正片", type: "video", format: "mp4", size: 47185920, tags: ["正片", "悬疑"] },
      { name: "案件线索文档", type: "document", format: "pdf", size: 184320, tags: ["设定", "线索"] },
      { name: "悬疑BGM合集", type: "audio", format: "mp3", size: 9437184, tags: ["音乐", "悬疑"] },
    ],
    videos: [
      { title: "第1集 - 连环失踪", status: "completed", progress: 100, duration: 340, resolution: "1920x1080", fps: 30 },
      { title: "第2集 - 心理陷阱", status: "completed", progress: 100, duration: 360, resolution: "1920x1080", fps: 30 },
      { title: "第3集 - 真相大白", status: "processing", progress: 80, duration: 380, resolution: "1920x1080", fps: 30 },
      { title: "角色介绍 - 沈墨探长", status: "completed", progress: 100, duration: 55, resolution: "1280x720", fps: 24 },
      { title: "悬疑预告片", status: "failed", progress: 0, duration: 90, resolution: "1920x1080", fps: 30 },
    ],
    reviews: [
      { content_type: "script", content_title: "第1集剧本审核", result: "approved", score: 96, comment: "悬疑氛围营造到位，线索铺设精妙", reviewer_name: "赵监制" },
      { content_type: "image", content_title: "凶案现场图审核", result: "approved", score: 88, comment: "场景还原度高，氛围阴郁", reviewer_name: "李美术" },
      { content_type: "video", content_title: "第1集正片审核", result: "approved", score: 92, comment: "节奏紧凑，推理过程清晰", reviewer_name: "王剪辑" },
      { content_type: "audio", content_title: "悬疑BGM审核", result: "approved", score: 91, comment: "音乐烘托紧张氛围", reviewer_name: "陈音乐" },
      { content_type: "script", content_title: "第3集剧本审核", result: "pending", score: 0, comment: "结局反转需再推敲", reviewer_name: "赵监制" },
    ],
  },
  // 项目6：热血青春校园
  {
    id: "proj-6",
    name: "热血青春校园", category: "青春校园剧", owner: "陈导演",
    characters: [
      { name: "林风", role: "protagonist", gender: "male", age: 17, traits: ["热血", "正义", "篮球天才", "直率"], description: "转学生，篮球场上的一匹黑马" },
      { name: "夏晴", role: "supporting", gender: "female", age: 16, traits: ["学霸", "温柔", "坚韧", "开朗"], description: "班长，林风的同桌和暗恋对象" },
      { name: "赵天", role: "antagonist", gender: "male", age: 18, traits: ["好胜", "强势", "嫉妒", "内心脆弱"], description: "校篮球队队长，视林风为对手" },
      { name: "老周教练", role: "supporting", gender: "male", age: 45, traits: ["严格", "经验丰富", "幽默", "关爱学生"], description: "体育老师兼篮球队教练" },
      { name: "小胖阿明", role: "minor", gender: "male", age: 17, traits: ["搞笑", "贪吃", "忠诚", "乐观"], description: "林风的好兄弟，球队开心果" },
    ],
    scenes: [
      { name: "学校篮球场", type: "outdoor", description: "标准化篮球场，周围看台坐满学生", lighting: "日光", time_of_day: "白天", weather: "晴" },
      { name: "高三教室", type: "indoor", description: "堆满书本的教室，黑板写着高考倒计时", lighting: "日光灯", time_of_day: "白天", weather: "室内" },
      { name: "校园操场", type: "outdoor", description: "红色跑道和绿色草坪，学生课间活动", lighting: "日光", time_of_day: "白天", weather: "晴" },
      { name: "天台", type: "outdoor", description: "学校天台，可以眺望城市天际线", lighting: "夕阳", time_of_day: "傍晚", weather: "晴" },
      { name: "学校体育馆", type: "indoor", description: "室内篮球馆，木质地板，灯光明亮", lighting: "强白光", time_of_day: "全天", weather: "室内" },
    ],
    scripts: [
      { title: "热血青春校园 第1集 - 转学生", description: "林风转入新学校，与夏晴成为同桌", words: 7000, chapters: 4, author: "陈导演", tags: ["青春", "校园", "转学"] },
      { title: "热血青春校园 第2集 - 篮球对决", description: "林风与赵天在篮球场上一较高下", words: 7500, chapters: 3, author: "陈导演", tags: ["青春", "篮球", "对决"] },
      { title: "热血青春校园 第3集 - 全国大赛", description: "校队出征全国大赛，热血青春燃烧", words: 8200, chapters: 5, author: "孙编剧", tags: ["青春", "比赛", "热血"] },
    ],
    storyboards: [
      { description: "林风背着书包走进新学校大门", duration: 6, camera_angle: "中景", movement: "跟随", dialogue: "林风：新的开始！", status: "completed" },
      { description: "教室里夏晴抬头看向新同桌", duration: 5, camera_angle: "近景", movement: "固定", dialogue: "夏晴：你好，我是班长夏晴。", status: "approved" },
      { description: "篮球场全景，林风运球突破", duration: 8, camera_angle: "全景", movement: "跟随", dialogue: "", status: "production" },
      { description: "赵天跳投，球划出弧线入网", duration: 4, camera_angle: "特写", movement: "慢动作", dialogue: "赵天：你赢不了我。", status: "completed" },
      { description: "天台上林风和夏晴并肩看夕阳", duration: 10, camera_angle: "中景", movement: "固定", dialogue: "夏晴：加油，你一定可以的。", status: "approved" },
      { description: "体育馆内全国大赛决赛，全队欢呼", duration: 8, camera_angle: "全景", movement: "环绕", dialogue: "林风：我们赢了！", status: "draft" },
    ],
    audios: [
      { name: "林风台词配音", type: "voiceover", duration: 185, speaker: "声优K", tags: ["主角", "青春"] },
      { name: "夏晴台词配音", type: "voiceover", duration: 140, speaker: "声优L", tags: ["女主角"] },
      { name: "热血青春BGM", type: "bgm", duration: 250, speaker: "", tags: ["背景音乐", "热血"] },
      { name: "篮球运球音效", type: "sfx", duration: 20, speaker: "", tags: ["音效", "运动"] },
      { name: "欢呼声环境音", type: "sfx", duration: 30, speaker: "", tags: ["音效", "人群"] },
    ],
    assets: [
      { name: "林风角色立绘", type: "image", format: "png", size: 1536000, tags: ["角色", "主角"] },
      { name: "篮球场场景图", type: "image", format: "jpg", size: 2867200, tags: ["场景", "运动场"] },
      { name: "第1集正片", type: "video", format: "mp4", size: 39845888, tags: ["正片", "青春"] },
      { name: "角色设定集", type: "document", format: "pdf", size: 143360, tags: ["设定", "文档"] },
      { name: "热血BGM合集", type: "audio", format: "mp3", size: 7340032, tags: ["音乐", "热血"] },
    ],
    videos: [
      { title: "第1集 - 转学生", status: "completed", progress: 100, duration: 290, resolution: "1920x1080", fps: 30 },
      { title: "第2集 - 篮球对决", status: "completed", progress: 100, duration: 310, resolution: "1920x1080", fps: 30 },
      { title: "第3集 - 全国大赛", status: "processing", progress: 60, duration: 350, resolution: "1920x1080", fps: 30 },
      { title: "角色介绍 - 林风", status: "completed", progress: 100, duration: 45, resolution: "1280x720", fps: 24 },
      { title: "篮球精彩集锦", status: "queued", progress: 0, duration: 120, resolution: "1920x1080", fps: 30 },
    ],
    reviews: [
      { content_type: "script", content_title: "第1集剧本审核", result: "approved", score: 89, comment: "青春气息浓厚，角色有代入感", reviewer_name: "陈监制" },
      { content_type: "image", content_title: "林风立绘审核", result: "approved", score: 85, comment: "角色充满活力，适合青春主题", reviewer_name: "王美术" },
      { content_type: "video", content_title: "第1集正片审核", result: "pending", score: 0, comment: "部分镜头节奏待优化", reviewer_name: "张剪辑" },
      { content_type: "audio", content_title: "热血BGM审核", result: "approved", score: 88, comment: "音乐充满活力，契合主题", reviewer_name: "陈音乐" },
      { content_type: "script", content_title: "第3集剧本审核", result: "pending", score: 0, comment: "比赛高潮待加强", reviewer_name: "陈监制" },
    ],
  },
  // 项目7：历史传奇故事
  {
    id: "proj-7",
    name: "历史传奇故事", category: "历史古装剧", owner: "周导演",
    characters: [
      { name: "李世民", role: "protagonist", gender: "male", age: 30, traits: ["英明", "果断", "雄才大略", "重情义"], description: "秦王，后为唐太宗，开创贞观之治" },
      { name: "长孙皇后", role: "supporting", gender: "female", age: 26, traits: ["贤德", "聪慧", "温婉", "大度"], description: "李世民的贤内助，母仪天下" },
      { name: "魏征", role: "supporting", gender: "male", age: 50, traits: ["刚正", "直言敢谏", "忠诚", "睿智"], description: "敢于直谏的名臣，李世民的镜子" },
      { name: "李建成", role: "antagonist", gender: "male", age: 35, traits: ["嫉妒", "阴险", "权欲", "短视"], description: "太子，李世民的政治对手" },
      { name: "尉迟敬德", role: "minor", gender: "male", age: 40, traits: ["勇猛", "忠诚", "粗犷", "重义"], description: "猛将，李世民的得力战将" },
    ],
    scenes: [
      { name: "太极宫大殿", type: "indoor", description: "金碧辉煌的皇宫大殿，龙椅高悬", lighting: "金黄光", time_of_day: "白天", weather: "室内" },
      { name: "玄武门", type: "outdoor", description: "长安城玄武门，历史的转折点", lighting: "晨光", time_of_day: "清晨", weather: "晴" },
      { name: "军营帐内", type: "indoor", description: "行军打仗的军帐，地图铺开", lighting: "烛光", time_of_day: "夜晚", weather: "室内" },
      { name: "御花园", type: "outdoor", description: "皇宫御花园，亭台楼阁，花木扶疏", lighting: "日光", time_of_day: "白天", weather: "晴" },
      { name: "长安城街道", type: "outdoor", description: "繁华的长安城街道，商贩云集", lighting: "日光", time_of_day: "白天", weather: "晴" },
    ],
    scripts: [
      { title: "历史传奇故事 第1集 - 秦王崛起", description: "李世民征战四方，功勋卓著", words: 9500, chapters: 5, author: "周导演", tags: ["历史", "古装", "崛起"] },
      { title: "历史传奇故事 第2集 - 玄武门之变", description: "玄武门之变，李世民夺位", words: 10200, chapters: 4, author: "周导演", tags: ["历史", "政变", "转折"] },
      { title: "历史传奇故事 第3集 - 贞观之治", description: "李世民登基，开创盛世", words: 9800, chapters: 5, author: "吴编剧", tags: ["历史", "盛世", "治国"] },
    ],
    storyboards: [
      { description: "李世民身披铠甲骑马出征，旌旗招展", duration: 10, camera_angle: "全景", movement: "跟随", dialogue: "李世民：将士们，随我出征！", status: "completed" },
      { description: "太极宫大殿内群臣朝拜", duration: 8, camera_angle: "仰拍", movement: "固定", dialogue: "", status: "approved" },
      { description: "玄武门前紧张对峙，李世民拔剑", duration: 6, camera_angle: "中景", movement: "推近", dialogue: "李世民：今日，便做个了断！", status: "production" },
      { description: "魏征在朝堂上直言进谏", duration: 7, camera_angle: "近景", movement: "固定", dialogue: "魏征：陛下，水能载舟亦能覆舟。", status: "approved" },
      { description: "长孙皇后在御花园与李世民散步", duration: 8, camera_angle: "中景", movement: "跟随", dialogue: "长孙皇后：陛下应以天下为重。", status: "completed" },
      { description: "长安城繁华街道，百姓安居乐业", duration: 10, camera_angle: "全景", movement: "平移", dialogue: "", status: "draft" },
    ],
    audios: [
      { name: "李世民台词配音", type: "voiceover", duration: 230, speaker: "声优M", tags: ["主角", "历史"] },
      { name: "长孙皇后台词配音", type: "voiceover", duration: 170, speaker: "声优N", tags: ["女主角"] },
      { name: "史诗历史BGM", type: "bgm", duration: 350, speaker: "", tags: ["背景音乐", "史诗"] },
      { name: "战场厮杀音效", type: "sfx", duration: 40, speaker: "", tags: ["音效", "战争"] },
      { name: "古风宫廷乐", type: "bgm", duration: 200, speaker: "", tags: ["背景音乐", "宫廷"] },
    ],
    assets: [
      { name: "李世民角色立绘", type: "image", format: "png", size: 2252800, tags: ["角色", "主角"] },
      { name: "太极宫场景图", type: "image", format: "jpg", size: 3670016, tags: ["场景", "宫殿"] },
      { name: "第1集正片", type: "video", format: "mp4", size: 57671680, tags: ["正片", "历史"] },
      { name: "历史设定文档", type: "document", format: "pdf", size: 256000, tags: ["设定", "历史"] },
      { name: "史诗BGM合集", type: "audio", format: "flac", size: 18874368, tags: ["音乐", "史诗"] },
    ],
    videos: [
      { title: "第1集 - 秦王崛起", status: "completed", progress: 100, duration: 380, resolution: "1920x1080", fps: 30 },
      { title: "第2集 - 玄武门之变", status: "completed", progress: 100, duration: 400, resolution: "1920x1080", fps: 30 },
      { title: "第3集 - 贞观之治", status: "processing", progress: 75, duration: 420, resolution: "1920x1080", fps: 30 },
      { title: "角色介绍 - 李世民", status: "completed", progress: 100, duration: 60, resolution: "1280x720", fps: 24 },
      { title: "大唐风华宣传片", status: "completed", progress: 100, duration: 180, resolution: "1920x1080", fps: 30 },
    ],
    reviews: [
      { content_type: "script", content_title: "第1集剧本审核", result: "approved", score: 97, comment: "历史还原度高，人物刻画深刻", reviewer_name: "周监制" },
      { content_type: "image", content_title: "李世民立绘审核", result: "approved", score: 94, comment: "帝王气质非凡，服饰考究", reviewer_name: "李美术" },
      { content_type: "video", content_title: "第1集正片审核", result: "approved", score: 93, comment: "场面恢弘，配乐大气", reviewer_name: "张剪辑" },
      { content_type: "audio", content_title: "史诗BGM审核", result: "approved", score: 95, comment: "音乐气势磅礴，契合历史题材", reviewer_name: "陈音乐" },
      { content_type: "script", content_title: "第3集剧本审核", result: "pending", score: 0, comment: "治国细节待补充", reviewer_name: "周监制" },
    ],
  },
];

// ============================================================================
// 工具函数
// ============================================================================

function timestamp(daysAgo = 0): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString();
}

// ============================================================================
// 清除现有独立模块数据
// ============================================================================

async function cleanModuleData(ctx: AppContext): Promise<void> {
  console.log("🗑️  清除现有独立模块数据...");

  const scripts = await ctx.scripts.findMany();
  for (const s of scripts) await ctx.scripts.delete(s.id);

  const characters = await ctx.characters.findMany();
  for (const c of characters) await ctx.characters.delete(c.id);

  const scenes = await ctx.scenes.findMany();
  for (const s of scenes) await ctx.scenes.delete(s.id);

  const storyboards = await ctx.storyboards.findMany();
  for (const s of storyboards) await ctx.storyboards.delete(s.id);

  const audios = await ctx.audios.findMany();
  for (const a of audios) await ctx.audios.delete(a.id);

  const assets = await ctx.assets.findMany();
  for (const a of assets) await ctx.assets.delete(a.id);

  const reviews = await ctx.reviews.findMany();
  for (const r of reviews) await ctx.reviews.delete(r.id);

  const videos = await ctx.moduleVideoTasks.findMany();
  for (const v of videos) await ctx.moduleVideoTasks.delete(v.id);

  console.log("  ✓ 已清除所有独立模块数据");
}

// ============================================================================
// 数据生成函数
// ============================================================================

async function createAllData(ctx: AppContext): Promise<void> {
  let scriptCount = 0, charCount = 0, sceneCount = 0, sbCount = 0;
  let audioCount = 0, assetCount = 0, reviewCount = 0, videoCount = 0;
  const sceneIdMap: Record<string, string> = {};

  for (let pi = 0; pi < projectThemes.length; pi++) {
    const theme = projectThemes[pi];
    console.log(`\n📦 项目 ${pi + 1}/${projectThemes.length}: ${theme.name} (${theme.category})`);

    // ---- 剧本 ----
    const scriptRecords: Script[] = theme.scripts.map((s, idx) => ({
      id: id("script"),
      project_id: theme.id,
      title: s.title,
      description: s.description,
      status: (idx === 0 ? "active" : idx === 1 ? "review" : "draft") as Script["status"],
      words: s.words,
      chapters: s.chapters,
      author: s.author,
      tags: s.tags,
      version: 1,
      created_at: timestamp(projectThemes.length - pi),
      updated_at: timestamp(pi),
    }));
    await ctx.scripts.insertBatch(scriptRecords);
    scriptCount += scriptRecords.length;
    console.log(`  ✓ 剧本: ${scriptRecords.length} 条`);

    // ---- 角色 ----
    const charRecords: Character[] = theme.characters.map((c) => ({
      id: id("char"),
      project_id: theme.id,
      name: c.name,
      role: c.role as Character["role"],
      gender: c.gender as Character["gender"],
      age: c.age,
      traits: c.traits,
      description: c.description,
      image: "",
      tags: [theme.category],
      created_at: timestamp(projectThemes.length - pi),
      updated_at: timestamp(pi),
    }));
    await ctx.characters.insertBatch(charRecords);
    charCount += charRecords.length;
    console.log(`  ✓ 角色: ${charRecords.length} 条`);

    // ---- 场景 ----
    const sceneRecords: Scene[] = theme.scenes.map((s) => ({
      id: id("scene"),
      project_id: theme.id,
      name: s.name,
      type: s.type as Scene["type"],
      description: s.description,
      image: "",
      tags: [theme.category],
      lighting: s.lighting,
      time_of_day: s.time_of_day,
      weather: s.weather,
      created_at: timestamp(projectThemes.length - pi),
      updated_at: timestamp(pi),
    }));
    await ctx.scenes.insertBatch(sceneRecords);
    sceneCount += sceneRecords.length;
    // 记录第一个场景ID供分镜引用
    sceneIdMap[theme.name] = sceneRecords[0]?.id ?? "";
    console.log(`  ✓ 场景: ${sceneRecords.length} 条`);

    // ---- 分镜 ----
    const sbRecords: Storyboard[] = theme.storyboards.map((s, idx) => ({
      id: id("sb"),
      project_id: theme.id,
      scene_id: sceneIdMap[theme.name],
      shot_number: idx + 1,
      description: s.description,
      duration: s.duration,
      camera_angle: s.camera_angle,
      movement: s.movement,
      dialogue: s.dialogue,
      notes: "",
      status: s.status as Storyboard["status"],
      order: idx + 1,
      created_at: timestamp(projectThemes.length - pi),
      updated_at: timestamp(pi),
    }));
    await ctx.storyboards.insertBatch(sbRecords);
    sbCount += sbRecords.length;
    console.log(`  ✓ 分镜: ${sbRecords.length} 条`);

    // ---- 音频 ----
    const audioRecords: Audio[] = theme.audios.map((a) => ({
      id: id("audio"),
      project_id: theme.id,
      name: a.name,
      type: a.type as Audio["type"],
      duration: a.duration,
      file_url: "",
      speaker: a.speaker,
      tags: a.tags,
      format: "mp3",
      size: 0,
      created_at: timestamp(projectThemes.length - pi),
      updated_at: timestamp(pi),
    }));
    await ctx.audios.insertBatch(audioRecords);
    audioCount += audioRecords.length;
    console.log(`  ✓ 音频: ${audioRecords.length} 条`);

    // ---- 资产 ----
    const assetRecords: Asset[] = theme.assets.map((a) => ({
      id: id("asset"),
      project_id: theme.id,
      name: a.name,
      type: a.type as Asset["type"],
      file_url: "",
      size: a.size,
      format: a.format,
      tags: a.tags,
      metadata: {},
      created_at: timestamp(projectThemes.length - pi),
      updated_at: timestamp(pi),
    }));
    await ctx.assets.insertBatch(assetRecords);
    assetCount += assetRecords.length;
    console.log(`  ✓ 资产: ${assetRecords.length} 条`);

    // ---- 视频任务 ----
    const videoRecords: ModuleVideoTask[] = theme.videos.map((v) => ({
      id: id("vt"),
      project_id: theme.id,
      title: v.title,
      status: v.status as ModuleVideoTask["status"],
      progress: v.progress,
      duration: v.duration,
      resolution: v.resolution,
      fps: v.fps,
      format: "mp4",
      file_url: v.status === "completed" ? "" : undefined,
      created_at: timestamp(projectThemes.length - pi),
      updated_at: timestamp(pi),
    }));
    await ctx.moduleVideoTasks.insertBatch(videoRecords);
    videoCount += videoRecords.length;
    console.log(`  ✓ 视频任务: ${videoRecords.length} 条`);

    // ---- 审核 ----
    const reviewRecords: Review[] = theme.reviews.map((r) => ({
      id: id("review"),
      project_id: theme.id,
      content_type: r.content_type as Review["content_type"],
      content_id: id("content"),
      content_title: r.content_title,
      result: r.result as Review["result"],
      score: r.score,
      comment: r.comment,
      reviewer_id: id("user"),
      reviewer_name: r.reviewer_name,
      created_at: timestamp(projectThemes.length - pi),
      updated_at: timestamp(pi),
    }));
    await ctx.reviews.insertBatch(reviewRecords);
    reviewCount += reviewRecords.length;
    console.log(`  ✓ 审核: ${reviewRecords.length} 条`);
  }

  // ---- 统计输出 ----
  console.log("\n" + "=".repeat(60));
  console.log("  ✅ 独立模块测试数据创建完成！");
  console.log("=".repeat(60));
  console.log("\n📊 数据统计：");
  console.log(`  - 剧本模块:     ${scriptCount} 条`);
  console.log(`  - 角色模块:     ${charCount} 条`);
  console.log(`  - 场景模块:     ${sceneCount} 条`);
  console.log(`  - 分镜模块:     ${sbCount} 条`);
  console.log(`  - 音频模块:     ${audioCount} 条`);
  console.log(`  - 资产模块:     ${assetCount} 条`);
  console.log(`  - 审核模块:     ${reviewCount} 条`);
  console.log(`  - 视频任务模块: ${videoCount} 条`);
  console.log(`  - 总计:         ${scriptCount + charCount + sceneCount + sbCount + audioCount + assetCount + reviewCount + videoCount} 条`);
  console.log(`  - 覆盖项目:     ${projectThemes.length} 个进行中项目`);
  console.log("=".repeat(60) + "\n");
}

// ============================================================================
// 主函数
// ============================================================================

async function main(): Promise<void> {
  console.log("=".repeat(60));
  console.log("  Agnes AI Studio - 独立模块测试数据生成脚本");
  console.log("  基于 7 个进行中项目，为 AI 生产中心各模块生成真实数据");
  console.log("=".repeat(60));

  const ctx = createAppContext(process.cwd());

  try {
    const shouldClean = process.argv.includes("--clean");
    if (shouldClean) {
      await cleanModuleData(ctx);
    }

    console.log("\n🚀 开始创建独立模块测试数据...\n");
    await createAllData(ctx);
  } catch (error) {
    console.error("\n❌ 创建数据时出错：", error);
    process.exit(1);
  } finally {
    ctx.close();
  }
}

main().catch(console.error);
