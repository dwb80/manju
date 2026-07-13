const tables = ['projects','characters','scenes','props','scripts','assets','character_image_history','asset_versions','storyboards','audio','clips','videos','images','conversations','favorites','messages','todos','work_items','milestones','issues','episodes','project_members','app_logs','script_documents','script_episodes','script_scenes','script_comments','script_dialogues','project_tasks','image_tasks','video_tasks','publish_plans','model_configs','model_quotas','model_call_logs','project_scripts','project_assets','project_reviews','todo_items'];
const baseUrl = 'http://localhost:3001';
async function count(t) {
  try {
    const r = await fetch(baseUrl + '/api/' + t);
    if (!r.ok) return { table: t, count: 'ERR ' + r.status };
    const j = await r.json();
    const data = j.data ?? j;
    if (Array.isArray(data)) return { table: t, count: data.length };
    return { table: t, count: '?' };
  } catch (e) { return { table: t, count: 'EXC ' + e.message.slice(0,40) }; }
}
(async () => {
  const results = await Promise.all(tables.map(count));
  console.table(results);
})();
