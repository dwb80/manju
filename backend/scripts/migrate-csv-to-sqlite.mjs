import path from "node:path";
import { existsSync } from "node:fs";
import { CsvRepository, SettingsRepository } from "../dist/src/storage/csv.js";
import {
  conversationFields,
  favoriteFields,
  imageTaskFields,
  messageFields,
  projectAssetFields,
  projectClipFields,
  projectEpisodeFields,
  projectFields,
  projectIssueFields,
  projectMemberFields,
  projectMilestoneFields,
  projectReviewFields,
  projectScriptFields,
  projectStoryboardFields,
  projectTaskFields,
  videoTaskFields,
} from "../dist/src/storage/schema.js";
import { createAppContext, defaultSettings } from "../dist/src/services/app.js";

const root = path.resolve(process.argv[2] ?? process.cwd());
const csvRoot = path.join(root, "data", "csv");

const entities = [
  ["conversations", conversationFields, "conversations"],
  ["projects", projectFields, "projects"],
  ["project_episodes", projectEpisodeFields, "projectEpisodes"],
  ["project_issues", projectIssueFields, "projectIssues"],
  ["project_milestones", projectMilestoneFields, "projectMilestones"],
  ["project_scripts", projectScriptFields, "projectScripts"],
  ["project_members", projectMemberFields, "projectMembers"],
  ["project_tasks", projectTaskFields, "projectTasks"],
  ["project_reviews", projectReviewFields, "projectReviews"],
  ["project_clips", projectClipFields, "projectClips"],
  ["project_storyboards", projectStoryboardFields, "projectStoryboards"],
  ["project_assets", projectAssetFields, "projectAssets"],
  ["messages", messageFields, "messages"],
  ["image_tasks", imageTaskFields, "images"],
  ["video_tasks", videoTaskFields, "videos"],
  ["favorites", favoriteFields, "favorites"],
];

async function migrateEntity(ctx, [entity, fields, contextKey]) {
  const source = new CsvRepository(csvRoot, entity, fields);
  const target = ctx[contextKey];
  const records = await source.findMany({}, { sort: "asc" });
  let inserted = 0;
  let skipped = 0;

  for (const record of records) {
    if (await target.findById(record.id)) {
      skipped += 1;
      continue;
    }
    await target.insert(record);
    inserted += 1;
  }

  return { entity, inserted, skipped, total: records.length };
}

async function main() {
  if (!existsSync(csvRoot)) {
    console.log(`CSV directory not found: ${csvRoot}`);
    return;
  }

  const ctx = createAppContext(root, { mediaCacheEnabled: false });
  try {
    const results = [];
    for (const entity of entities) {
      results.push(await migrateEntity(ctx, entity));
    }

    const settings = await new SettingsRepository(csvRoot, defaultSettings).get();
    await ctx.settings.set(settings);

    console.table(results);
    console.log(`Migration complete. SQLite database: ${path.join(root, "data", "app.sqlite")}`);
  } finally {
    ctx.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
