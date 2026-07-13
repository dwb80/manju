const Database = require('better-sqlite3');
const db = new Database('data/sqlite.db', { readonly: true });
console.log('--- counts ---');
['projects','characters','scenes','props','scripts','assets','character_image_history','asset_versions','storyboards','audio','clips','videos','images','conversations','favorites','messages','todos','app_logs'].forEach(t => {
  try {
    const c = db.prepare('SELECT count(*) as cnt FROM ' + t).get();
    console.log(t.padEnd(28), c.cnt);
  } catch (e) {
    console.log(t.padEnd(28), 'ERR:', e.message.slice(0, 80));
  }
});
console.log('--- recent 6 projects ---');
const rows = db.prepare("SELECT id, name, status, is_pinned, substr(updated_at,1,16) as upd FROM projects ORDER BY updated_at DESC LIMIT 6").all();
console.table(rows);
console.log('--- sample character_image_history ---');
try {
  const his = db.prepare("SELECT id, character_id, project_id, substr(url,1,40) as url, is_applied, created_at FROM character_image_history ORDER BY created_at DESC LIMIT 3").all();
  console.table(his);
} catch (e) { console.log('ERR', e.message); }
