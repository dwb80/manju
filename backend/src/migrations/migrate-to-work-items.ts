/**
 * 迁移脚本占位（评审 P2：状态机收敛 + 评审 P2-C2：CSV 下线）。
 *
 * 原本承担 project_tasks / project_issues / project_milestones / project_reviews
 * → work_items 的迁移工作。随着 CSV 仓储全面下线（2026-07-12），
 * 旧 CSV 目录已删除，业务表统一走 SQLite。
 *
 * 状态映射仍记录在此供历史追溯：
 *   task:    todo → pending；script/storyboard/image/video/review → doing；done → done
 *   issue:   open → pending；doing → doing；resolved → done；closed → dismissed
 *   milestone: planned → pending；doing → doing；done → done；delayed → pending
 *   review:  open → pending；resolved → done；rejected → dismissed
 *
 * 真实初始化请使用 seed-work-items.ts（写入 SQLite）。
 */

async function main(): Promise<void> {
  console.log("[migrate] No legacy data sources to migrate. work_items lives in SQLite (data/sqlite.db).");
  console.log("[migrate] Run `npm run build && node dist/src/migrations/seed-work-items.js` to bootstrap work_items.");
}

main().catch((err) => {
  console.error("[migrate] failed:", err);
  process.exitCode = 1;
});
