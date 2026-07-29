-- Manju target physical schema (SQLite, design baseline v1)
-- This schema is validated on an empty in-memory database. Production rollout must
-- follow migration-plan.md; never execute this file directly against an existing DB.

PRAGMA foreign_keys = ON;

CREATE TABLE schema_migrations (
  id TEXT PRIMARY KEY,
  checksum TEXT NOT NULL,
  applied_at TEXT NOT NULL,
  execution_ms INTEGER NOT NULL CHECK (execution_ms >= 0),
  app_version TEXT NOT NULL
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  normalized_username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  normalized_email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  status TEXT NOT NULL CHECK (status IN ('invited','active','disabled','locked')),
  source TEXT NOT NULL CHECK (source IN ('admin','sso','migration')),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE user_system_roles (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  role TEXT NOT NULL,
  granted_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  granted_at TEXT NOT NULL,
  PRIMARY KEY (user_id, role)
);

CREATE TABLE invitations (
  id TEXT PRIMARY KEY,
  normalized_email TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  system_roles_json TEXT NOT NULL CHECK (json_valid(system_roles_json)),
  status TEXT NOT NULL CHECK (status IN ('pending','accepted','expired','revoked')),
  expires_at TEXT NOT NULL,
  accepted_at TEXT,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  csrf_secret_hash TEXT NOT NULL,
  device_digest TEXT,
  ip_prefix TEXT,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT
);
CREATE INDEX idx_sessions_user_active ON sessions(user_id, revoked_at, expires_at);

CREATE TABLE auth_attempts (
  id TEXT PRIMARY KEY,
  principal_hash TEXT NOT NULL,
  result TEXT NOT NULL,
  reason TEXT,
  ip_prefix TEXT,
  occurred_at TEXT NOT NULL
);
CREATE INDEX idx_auth_attempts_principal_time ON auth_attempts(principal_hash, occurred_at DESC);

CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  type TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active','archived')),
  current_presentation_spec_version INTEGER NOT NULL DEFAULT 1,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  deleted_at TEXT,
  deleted_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  deletion_reason TEXT
);
CREATE UNIQUE INDEX uq_projects_owner_name_active ON projects(owner_id, normalized_name) WHERE deleted_at IS NULL;

CREATE TABLE project_members (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  role TEXT NOT NULL CHECK (role IN ('owner','admin','producer','writer','storyboard_director','artist','video_director','voice_actor','editor','reviewer','publisher','member')),
  allow_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(allow_json)),
  deny_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(deny_json)),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  joined_at TEXT NOT NULL,
  removed_at TEXT,
  PRIMARY KEY(project_id, user_id)
);
CREATE UNIQUE INDEX uq_project_owner ON project_members(project_id) WHERE role='owner' AND removed_at IS NULL;

CREATE TABLE project_presentation_specs (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  spec_version INTEGER NOT NULL CHECK (spec_version > 0),
  schema_version INTEGER NOT NULL DEFAULT 1,
  aspect_ratio_json TEXT NOT NULL CHECK (json_valid(aspect_ratio_json)),
  play_direction TEXT NOT NULL,
  safe_areas_json TEXT NOT NULL CHECK (json_valid(safe_areas_json)),
  platform_template_refs_json TEXT NOT NULL CHECK (json_valid(platform_template_refs_json)),
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  PRIMARY KEY(project_id, spec_version)
);

CREATE TABLE episodes (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  episode_number INTEGER NOT NULL CHECK (episode_number BETWEEN 1 AND 999),
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 100),
  description TEXT,
  status TEXT NOT NULL CHECK (status IN ('active','archived')),
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  UNIQUE(project_id, episode_number)
);

CREATE TABLE scripts (
  id TEXT PRIMARY KEY,
  episode_id TEXT NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','analyzing','analyzed','published','archived')),
  current_draft_json TEXT NOT NULL CHECK (json_valid(current_draft_json)),
  analysis_status TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE script_documents (
  id TEXT PRIMARY KEY,
  script_id TEXT NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
  script_version INTEGER NOT NULL CHECK (script_version > 0),
  content_json TEXT NOT NULL CHECK (json_valid(content_json)),
  structure_json TEXT NOT NULL CHECK (json_valid(structure_json)),
  content_hash TEXT NOT NULL,
  previous_version_id TEXT REFERENCES script_documents(id) ON DELETE RESTRICT,
  published_at TEXT NOT NULL,
  published_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  UNIQUE(script_id, script_version),
  UNIQUE(script_id, content_hash)
);

CREATE TABLE script_edit_locks (
  script_id TEXT PRIMARY KEY REFERENCES scripts(id) ON DELETE CASCADE,
  holder_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lock_token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  heartbeat_at TEXT NOT NULL
);

CREATE TABLE script_analyses (
  id TEXT PRIMARY KEY,
  script_id TEXT NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
  script_document_id TEXT NOT NULL REFERENCES script_documents(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('queued','running','completed','failed','timed_out','cancelled')),
  input_hash TEXT NOT NULL,
  result_json TEXT CHECK (result_json IS NULL OR json_valid(result_json)),
  result_schema_version INTEGER NOT NULL DEFAULT 1,
  model_snapshot_json TEXT NOT NULL CHECK (json_valid(model_snapshot_json)),
  cost_json TEXT NOT NULL CHECK (json_valid(cost_json)),
  attempt INTEGER NOT NULL DEFAULT 1,
  stale_at TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT,
  UNIQUE(script_document_id, input_hash, attempt)
);

CREATE TABLE storyboards (
  id TEXT PRIMARY KEY,
  episode_id TEXT NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('draft','active','archived')),
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE shots (
  id TEXT PRIMARY KEY,
  storyboard_id TEXT NOT NULL REFERENCES storyboards(id) ON DELETE CASCADE,
  shot_number TEXT NOT NULL,
  rank TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  dialogue TEXT NOT NULL DEFAULT '',
  shot_type TEXT,
  angle TEXT,
  camera_move TEXT,
  duration_ms INTEGER NOT NULL CHECK (duration_ms BETWEEN 1000 AND 300000),
  status TEXT NOT NULL CHECK (status IN ('draft','generating','generated','in_review','approved','needs_fix','rejected','archived')),
  composition_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(composition_json)),
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  UNIQUE(storyboard_id, shot_number),
  UNIQUE(storyboard_id, rank)
);

CREATE TABLE media_objects (
  id TEXT PRIMARY KEY,
  storage_key TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes >= 0),
  sha256 TEXT NOT NULL,
  scan_status TEXT NOT NULL CHECK (scan_status IN ('pending','clean','rejected','failed')),
  created_at TEXT NOT NULL,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX idx_media_sha256 ON media_objects(sha256);

CREATE TABLE asset_roots (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('character','scene','prop')),
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','published','archived')),
  current_published_version INTEGER,
  draft_json TEXT NOT NULL CHECK (json_valid(draft_json)),
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE UNIQUE INDEX uq_asset_name_active ON asset_roots(project_id, asset_type, normalized_name) WHERE deleted_at IS NULL;

CREATE TABLE asset_versions (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL REFERENCES asset_roots(id) ON DELETE CASCADE,
  asset_version INTEGER NOT NULL,
  snapshot_json TEXT NOT NULL CHECK (json_valid(snapshot_json)),
  content_hash TEXT NOT NULL,
  primary_media_id TEXT REFERENCES media_objects(id) ON DELETE RESTRICT,
  license_json TEXT NOT NULL CHECK (json_valid(license_json)),
  published_at TEXT NOT NULL,
  published_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  UNIQUE(asset_id, asset_version),
  UNIQUE(asset_id, content_hash)
);

CREATE TABLE asset_images (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL REFERENCES asset_roots(id) ON DELETE CASCADE,
  media_id TEXT NOT NULL REFERENCES media_objects(id) ON DELETE RESTRICT,
  view_type TEXT NOT NULL,
  shot_type TEXT,
  angle TEXT,
  expression TEXT,
  is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0,1)),
  source_json TEXT NOT NULL CHECK (json_valid(source_json)),
  created_at TEXT NOT NULL
);

CREATE TABLE shot_asset_bindings (
  shot_id TEXT NOT NULL REFERENCES shots(id) ON DELETE CASCADE,
  binding_role TEXT NOT NULL,
  asset_id TEXT NOT NULL REFERENCES asset_roots(id) ON DELETE RESTRICT,
  asset_version INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY(shot_id, binding_role, asset_id),
  FOREIGN KEY(asset_id, asset_version) REFERENCES asset_versions(asset_id, asset_version) ON DELETE RESTRICT
);

CREATE TABLE shot_visual_layers (
  id TEXT PRIMARY KEY,
  shot_id TEXT NOT NULL REFERENCES shots(id) ON DELETE CASCADE,
  layer_type TEXT NOT NULL CHECK (layer_type IN ('background','character','prop','foreground','mask')),
  asset_id TEXT REFERENCES asset_roots(id) ON DELETE RESTRICT,
  asset_version INTEGER,
  transform_json TEXT NOT NULL CHECK (json_valid(transform_json)),
  z_index INTEGER NOT NULL,
  opacity REAL NOT NULL CHECK (opacity BETWEEN 0 AND 1),
  start_ms INTEGER NOT NULL DEFAULT 0,
  end_ms INTEGER NOT NULL CHECK (end_ms > start_ms),
  template_id TEXT,
  template_version INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(shot_id, z_index),
  FOREIGN KEY(asset_id, asset_version) REFERENCES asset_versions(asset_id, asset_version) ON DELETE RESTRICT
);

CREATE TABLE audio_assets (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  audio_type TEXT NOT NULL CHECK (audio_type IN ('dialogue','voiceover','music','sfx')),
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','published','archived')),
  current_published_version INTEGER,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE audio_asset_versions (
  id TEXT PRIMARY KEY,
  audio_asset_id TEXT NOT NULL REFERENCES audio_assets(id) ON DELETE CASCADE,
  asset_version INTEGER NOT NULL,
  media_id TEXT NOT NULL REFERENCES media_objects(id) ON DELETE RESTRICT,
  duration_ms INTEGER NOT NULL CHECK (duration_ms > 0),
  loudness_lufs REAL,
  sample_rate INTEGER,
  channels INTEGER,
  language TEXT,
  speaker_ref TEXT,
  license_json TEXT NOT NULL CHECK (json_valid(license_json)),
  source_json TEXT NOT NULL CHECK (json_valid(source_json)),
  content_hash TEXT NOT NULL,
  published_at TEXT NOT NULL,
  published_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  UNIQUE(audio_asset_id, asset_version)
);

CREATE TABLE shot_text_overlays (
  id TEXT PRIMARY KEY,
  shot_id TEXT NOT NULL REFERENCES shots(id) ON DELETE CASCADE,
  overlay_type TEXT NOT NULL CHECK (overlay_type IN ('dialogue_bubble','thought_bubble','narration_box','title','onomatopoeia')),
  script_document_id TEXT REFERENCES script_documents(id) ON DELETE RESTRICT,
  script_line_id TEXT,
  source_text_hash TEXT,
  speaker_asset_id TEXT REFERENCES asset_roots(id) ON DELETE RESTRICT,
  text_content TEXT NOT NULL,
  typography_json TEXT NOT NULL CHECK (json_valid(typography_json)),
  box_json TEXT NOT NULL CHECK (json_valid(box_json)),
  tail_json TEXT CHECK (tail_json IS NULL OR json_valid(tail_json)),
  onomatopoeia_json TEXT CHECK (onomatopoeia_json IS NULL OR json_valid(onomatopoeia_json)),
  audio_asset_id TEXT REFERENCES audio_assets(id) ON DELETE RESTRICT,
  audio_asset_version INTEGER,
  start_ms INTEGER NOT NULL DEFAULT 0,
  end_ms INTEGER NOT NULL CHECK (end_ms > start_ms),
  font_license_ref TEXT,
  exception_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(audio_asset_id, audio_asset_version) REFERENCES audio_asset_versions(audio_asset_id, asset_version) ON DELETE RESTRICT
);

CREATE TABLE comic_effect_schemas (
  effect_type TEXT NOT NULL,
  schema_version INTEGER NOT NULL,
  json_schema TEXT NOT NULL CHECK (json_valid(json_schema)),
  risk_rules_json TEXT NOT NULL CHECK (json_valid(risk_rules_json)),
  status TEXT NOT NULL CHECK (status IN ('draft','published','retired')),
  published_at TEXT,
  PRIMARY KEY(effect_type, schema_version)
);

CREATE TABLE shot_comic_effects (
  id TEXT PRIMARY KEY,
  shot_id TEXT NOT NULL REFERENCES shots(id) ON DELETE CASCADE,
  effect_type TEXT NOT NULL,
  schema_version INTEGER NOT NULL,
  parameters_json TEXT NOT NULL CHECK (json_valid(parameters_json)),
  mask_json TEXT CHECK (mask_json IS NULL OR json_valid(mask_json)),
  z_index INTEGER NOT NULL,
  start_ms INTEGER NOT NULL,
  end_ms INTEGER NOT NULL CHECK (end_ms > start_ms),
  intensity REAL NOT NULL CHECK (intensity BETWEEN 0 AND 1),
  risk_class TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(effect_type, schema_version) REFERENCES comic_effect_schemas(effect_type, schema_version) ON DELETE RESTRICT
);

CREATE TABLE shot_motion_cues (
  id TEXT PRIMARY KEY,
  shot_id TEXT NOT NULL REFERENCES shots(id) ON DELETE CASCADE,
  cue_type TEXT NOT NULL,
  target_layer_id TEXT NOT NULL REFERENCES shot_visual_layers(id) ON DELETE CASCADE,
  property_name TEXT NOT NULL,
  from_json TEXT NOT NULL CHECK (json_valid(from_json)),
  to_json TEXT NOT NULL CHECK (json_valid(to_json)),
  easing TEXT NOT NULL,
  start_ms INTEGER NOT NULL,
  end_ms INTEGER NOT NULL CHECK (end_ms > start_ms),
  priority INTEGER,
  driver_type TEXT,
  driver_id TEXT,
  driver_version INTEGER,
  model_snapshot_json TEXT CHECK (model_snapshot_json IS NULL OR json_valid(model_snapshot_json)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_motion_overlap ON shot_motion_cues(shot_id, target_layer_id, property_name, start_ms, end_ms);

CREATE TABLE presentation_snapshots (
  id TEXT PRIMARY KEY,
  shot_id TEXT NOT NULL REFERENCES shots(id) ON DELETE RESTRICT,
  shot_version INTEGER NOT NULL,
  schema_version INTEGER NOT NULL,
  canonical_json TEXT NOT NULL CHECK (json_valid(canonical_json)),
  snapshot_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  UNIQUE(shot_id, shot_version, snapshot_hash)
);

CREATE TABLE presentation_snapshot_dependencies (
  snapshot_id TEXT NOT NULL REFERENCES presentation_snapshots(id) ON DELETE CASCADE,
  dependency_type TEXT NOT NULL,
  dependency_id TEXT NOT NULL,
  dependency_version INTEGER NOT NULL,
  digest TEXT NOT NULL,
  PRIMARY KEY(snapshot_id, dependency_type, dependency_id, dependency_version)
);

CREATE TABLE model_configs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  provider TEXT NOT NULL,
  model_id TEXT NOT NULL,
  credential_ref TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('inactive','active','retired')),
  capabilities_json TEXT NOT NULL CHECK (json_valid(capabilities_json)),
  limits_json TEXT NOT NULL CHECK (json_valid(limits_json)),
  pricing_json TEXT NOT NULL CHECK (json_valid(pricing_json)),
  priority INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(provider, name)
);

CREATE TABLE model_route_defaults (
  scene_tag TEXT PRIMARY KEY,
  model_config_id TEXT NOT NULL REFERENCES model_configs(id) ON DELETE RESTRICT,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT
);

CREATE TABLE prompt_templates (
  id TEXT PRIMARY KEY,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('system','project')),
  scope_id TEXT,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  purpose TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','published','archived')),
  current_draft_json TEXT NOT NULL CHECK (json_valid(current_draft_json)),
  current_published_version INTEGER,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(scope_type, scope_id, normalized_name)
);

CREATE TABLE prompt_template_versions (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL REFERENCES prompt_templates(id) ON DELETE CASCADE,
  template_version INTEGER NOT NULL,
  body TEXT NOT NULL,
  variable_schema_json TEXT NOT NULL CHECK (json_valid(variable_schema_json)),
  output_schema_json TEXT CHECK (output_schema_json IS NULL OR json_valid(output_schema_json)),
  capabilities_json TEXT NOT NULL CHECK (json_valid(capabilities_json)),
  content_hash TEXT NOT NULL,
  change_note TEXT NOT NULL,
  published_at TEXT NOT NULL,
  published_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  UNIQUE(template_id, template_version)
);

CREATE TABLE pipeline_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  purpose TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','published','inactive')),
  current_draft_json TEXT NOT NULL CHECK (json_valid(current_draft_json)),
  current_published_version INTEGER,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE pipeline_template_versions (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL REFERENCES pipeline_templates(id) ON DELETE CASCADE,
  template_version INTEGER NOT NULL,
  graph_json TEXT NOT NULL CHECK (json_valid(graph_json)),
  input_schema_json TEXT NOT NULL CHECK (json_valid(input_schema_json)),
  output_schema_json TEXT NOT NULL CHECK (json_valid(output_schema_json)),
  graph_hash TEXT NOT NULL,
  published_at TEXT NOT NULL,
  published_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  UNIQUE(template_id, template_version)
);

CREATE TABLE project_budgets (
  project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  currency TEXT NOT NULL,
  period TEXT NOT NULL,
  soft_threshold_minor INTEGER NOT NULL CHECK (soft_threshold_minor >= 0),
  hard_cap_minor INTEGER NOT NULL CHECK (hard_cap_minor >= soft_threshold_minor),
  category_caps_json TEXT NOT NULL CHECK (json_valid(category_caps_json)),
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT
);

CREATE TABLE budget_reservations (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_id TEXT,
  amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
  currency TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('reserved','settled','released','expired')),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  settled_at TEXT,
  released_at TEXT
);
CREATE INDEX idx_budget_reservation_balance ON budget_reservations(project_id, status, expires_at);

CREATE TABLE cost_records (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_id TEXT,
  reservation_id TEXT REFERENCES budget_reservations(id) ON DELETE SET NULL,
  record_type TEXT NOT NULL CHECK (record_type IN ('estimate','settlement','adjustment','refund')),
  amount_minor INTEGER NOT NULL,
  currency TEXT NOT NULL,
  provider TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  occurred_at TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata_json))
);

CREATE TABLE ai_tasks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_type TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  target_version INTEGER NOT NULL,
  input_hash TEXT NOT NULL,
  execution_snapshot_json TEXT NOT NULL CHECK (json_valid(execution_snapshot_json)),
  budget_reservation_id TEXT REFERENCES budget_reservations(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('queued','running','completed','failed','cancelled','timed_out','unknown_result')),
  deadline_at TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(project_id, task_type, input_hash)
);

CREATE TABLE ai_task_attempts (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES ai_tasks(id) ON DELETE CASCADE,
  attempt INTEGER NOT NULL,
  provider TEXT,
  provider_request_id TEXT,
  status TEXT NOT NULL,
  heartbeat_at TEXT,
  deadline_at TEXT,
  error_class TEXT,
  error_code TEXT,
  cost_minor INTEGER,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  UNIQUE(task_id, attempt),
  UNIQUE(provider, provider_request_id)
);

CREATE TABLE generated_media (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES ai_tasks(id) ON DELETE CASCADE,
  media_id TEXT NOT NULL REFERENCES media_objects(id) ON DELETE RESTRICT,
  media_type TEXT NOT NULL CHECK (media_type IN ('image','video','audio')),
  input_hash TEXT NOT NULL,
  provider_metadata_json TEXT NOT NULL CHECK (json_valid(provider_metadata_json)),
  safety_json TEXT NOT NULL CHECK (json_valid(safety_json)),
  status TEXT NOT NULL CHECK (status IN ('candidate','adopted','rejected','quarantined')),
  created_at TEXT NOT NULL
);

CREATE TABLE reviews (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  target_version INTEGER NOT NULL,
  target_snapshot_hash TEXT NOT NULL,
  stage TEXT NOT NULL CHECK (stage IN ('single','first','second')),
  status TEXT NOT NULL CHECK (status IN ('pending','assigned','in_review','approved','changes_requested','cancelled','closed')),
  submitter_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  assignee_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
  due_at TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX uq_active_review_target ON reviews(target_type,target_id,target_version,stage) WHERE status NOT IN ('cancelled','closed');

CREATE TABLE review_decisions (
  id TEXT PRIMARY KEY,
  review_id TEXT NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  decision TEXT NOT NULL CHECK (decision IN ('approve','request_changes')),
  reason_code TEXT NOT NULL,
  comment TEXT,
  actor_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL
);

CREATE TABLE review_comments (
  id TEXT PRIMARY KEY,
  review_id TEXT NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  start_ms INTEGER,
  end_ms INTEGER,
  body TEXT NOT NULL,
  severity TEXT,
  actor_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL,
  resolved_at TEXT,
  CHECK (end_ms IS NULL OR start_ms IS NULL OR end_ms >= start_ms)
);

CREATE TABLE quality_rule_sets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('draft','published','inactive')),
  current_draft_json TEXT NOT NULL CHECK (json_valid(current_draft_json)),
  current_published_version INTEGER,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE quality_rule_set_versions (
  id TEXT PRIMARY KEY,
  rule_set_id TEXT NOT NULL REFERENCES quality_rule_sets(id) ON DELETE CASCADE,
  rule_set_version INTEGER NOT NULL,
  rules_json TEXT NOT NULL CHECK (json_valid(rules_json)),
  rules_hash TEXT NOT NULL,
  published_at TEXT NOT NULL,
  published_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  UNIQUE(rule_set_id, rule_set_version)
);

CREATE TABLE project_quality_policies (
  project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  rule_set_id TEXT NOT NULL,
  rule_set_version INTEGER NOT NULL,
  overrides_json TEXT NOT NULL CHECK (json_valid(overrides_json)),
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY(rule_set_id, rule_set_version) REFERENCES quality_rule_set_versions(rule_set_id, rule_set_version) ON DELETE RESTRICT
);

CREATE TABLE qc_reports (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  target_version INTEGER NOT NULL,
  input_hash TEXT NOT NULL,
  rule_set_id TEXT NOT NULL,
  rule_set_version INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued','running','completed','failed','timed_out','cancelled')),
  deadline_at TEXT,
  attempt INTEGER NOT NULL DEFAULT 1,
  previous_report_id TEXT REFERENCES qc_reports(id) ON DELETE SET NULL,
  summary_json TEXT CHECK (summary_json IS NULL OR json_valid(summary_json)),
  created_at TEXT NOT NULL,
  completed_at TEXT,
  FOREIGN KEY(rule_set_id, rule_set_version) REFERENCES quality_rule_set_versions(rule_set_id, rule_set_version) ON DELETE RESTRICT
);

CREATE TABLE qc_issues (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL REFERENCES qc_reports(id) ON DELETE CASCADE,
  rule_id TEXT NOT NULL,
  severity TEXT NOT NULL,
  shot_id TEXT REFERENCES shots(id) ON DELETE SET NULL,
  layer_id TEXT REFERENCES shot_visual_layers(id) ON DELETE SET NULL,
  start_ms INTEGER,
  end_ms INTEGER,
  message TEXT NOT NULL,
  evidence_json TEXT NOT NULL CHECK (json_valid(evidence_json)),
  status TEXT NOT NULL CHECK (status IN ('open','waived','resolved'))
);

CREATE TABLE qc_waivers (
  id TEXT PRIMARY KEY,
  issue_id TEXT NOT NULL REFERENCES qc_issues(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  scope_json TEXT NOT NULL CHECK (json_valid(scope_json)),
  expires_at TEXT,
  actor_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL
);

CREATE TABLE subtitle_documents (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  language TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','published','archived')),
  current_published_version INTEGER,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE subtitle_cues (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES subtitle_documents(id) ON DELETE CASCADE,
  track TEXT NOT NULL,
  start_ms INTEGER NOT NULL,
  end_ms INTEGER NOT NULL CHECK (end_ms > start_ms),
  text_content TEXT NOT NULL,
  speaker_ref TEXT,
  style_json TEXT NOT NULL CHECK (json_valid(style_json)),
  sort_key TEXT NOT NULL,
  UNIQUE(document_id, track, sort_key)
);

CREATE TABLE subtitle_document_versions (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES subtitle_documents(id) ON DELETE CASCADE,
  document_version INTEGER NOT NULL,
  cues_json TEXT NOT NULL CHECK (json_valid(cues_json)),
  content_hash TEXT NOT NULL,
  published_at TEXT NOT NULL,
  published_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  UNIQUE(document_id, document_version)
);

CREATE TABLE edit_projects (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  episode_id TEXT NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('draft','rendering','rendered','archived')),
  current_edit_version INTEGER NOT NULL DEFAULT 1,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE edit_tracks (
  id TEXT PRIMARY KEY,
  edit_project_id TEXT NOT NULL REFERENCES edit_projects(id) ON DELETE CASCADE,
  track_type TEXT NOT NULL CHECK (track_type IN ('video','audio','subtitle','effect')),
  name TEXT NOT NULL,
  sort_key TEXT NOT NULL,
  properties_json TEXT NOT NULL CHECK (json_valid(properties_json)),
  UNIQUE(edit_project_id, sort_key)
);

CREATE TABLE edit_clips (
  id TEXT PRIMARY KEY,
  edit_project_id TEXT NOT NULL REFERENCES edit_projects(id) ON DELETE CASCADE,
  track_id TEXT NOT NULL REFERENCES edit_tracks(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  source_version INTEGER NOT NULL,
  snapshot_id TEXT REFERENCES presentation_snapshots(id) ON DELETE RESTRICT,
  source_in_ms INTEGER NOT NULL,
  source_out_ms INTEGER NOT NULL CHECK (source_out_ms > source_in_ms),
  timeline_start_ms INTEGER NOT NULL CHECK (timeline_start_ms >= 0),
  properties_json TEXT NOT NULL CHECK (json_valid(properties_json)),
  sort_key TEXT NOT NULL,
  UNIQUE(edit_project_id, track_id, sort_key)
);

CREATE TABLE edit_project_versions (
  id TEXT PRIMARY KEY,
  edit_project_id TEXT NOT NULL REFERENCES edit_projects(id) ON DELETE CASCADE,
  edit_version INTEGER NOT NULL,
  timeline_json TEXT NOT NULL CHECK (json_valid(timeline_json)),
  input_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  UNIQUE(edit_project_id, edit_version)
);

CREATE TABLE render_jobs (
  id TEXT PRIMARY KEY,
  edit_project_id TEXT NOT NULL REFERENCES edit_projects(id) ON DELETE CASCADE,
  edit_version INTEGER NOT NULL,
  input_hash TEXT NOT NULL,
  render_profile_id TEXT NOT NULL,
  render_profile_version INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued','running','completed','failed','cancelled','timed_out')),
  output_media_id TEXT REFERENCES media_objects(id) ON DELETE RESTRICT,
  attempt INTEGER NOT NULL DEFAULT 1,
  deadline_at TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT,
  UNIQUE(edit_project_id, edit_version, input_hash, attempt)
);

CREATE TABLE final_videos (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  episode_id TEXT NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('draft','in_review','approved','changes_requested','published','archived')),
  current_video_version INTEGER NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE final_video_versions (
  id TEXT PRIMARY KEY,
  final_video_id TEXT NOT NULL REFERENCES final_videos(id) ON DELETE CASCADE,
  video_version INTEGER NOT NULL,
  media_id TEXT NOT NULL REFERENCES media_objects(id) ON DELETE RESTRICT,
  media_digest TEXT NOT NULL,
  edit_project_id TEXT NOT NULL REFERENCES edit_projects(id) ON DELETE RESTRICT,
  edit_version INTEGER NOT NULL,
  qc_report_id TEXT REFERENCES qc_reports(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  UNIQUE(final_video_id, video_version)
);

CREATE TABLE publish_plans (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  final_video_id TEXT NOT NULL REFERENCES final_videos(id) ON DELETE RESTRICT,
  video_version INTEGER NOT NULL,
  platform TEXT NOT NULL,
  credential_ref TEXT NOT NULL,
  adapter_version TEXT NOT NULL,
  metadata_json TEXT NOT NULL CHECK (json_valid(metadata_json)),
  schedule_at TEXT,
  batch_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('draft','scheduled','executing','succeeded','failed','unknown_result','cancelled')),
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE publish_records (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES publish_plans(id) ON DELETE CASCADE,
  attempt INTEGER NOT NULL,
  provider_request_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('executing','succeeded','failed','unknown_result')),
  remote_id TEXT,
  remote_url TEXT,
  error_class TEXT,
  error_code TEXT,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  UNIQUE(plan_id, attempt),
  UNIQUE(provider_request_id)
);

CREATE TABLE publish_metric_snapshots (
  id TEXT PRIMARY KEY,
  record_id TEXT NOT NULL REFERENCES publish_records(id) ON DELETE CASCADE,
  captured_at TEXT NOT NULL,
  metrics_json TEXT NOT NULL CHECK (json_valid(metrics_json)),
  adapter_version TEXT NOT NULL,
  UNIQUE(record_id, captured_at)
);

CREATE TABLE work_items (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('task','issue','milestone')),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL,
  priority TEXT NOT NULL,
  assignee_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  due_at TEXT,
  target_type TEXT,
  target_id TEXT,
  source_event_id TEXT,
  type_payload_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(type_payload_json)),
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE UNIQUE INDEX uq_work_item_source ON work_items(source_event_id, item_type) WHERE source_event_id IS NOT NULL;

CREATE TABLE work_item_links (
  work_item_id TEXT NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  relation TEXT NOT NULL,
  PRIMARY KEY(work_item_id, target_type, target_id, relation)
);

CREATE TABLE notification_templates (
  id TEXT NOT NULL,
  template_version INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('in_app','email')),
  variable_schema_json TEXT NOT NULL CHECK (json_valid(variable_schema_json)),
  content_template TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','published','retired')),
  published_at TEXT,
  PRIMARY KEY(id, template_version)
);

CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  template_id TEXT NOT NULL,
  template_version INTEGER NOT NULL,
  recipient_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  target_json TEXT NOT NULL CHECK (json_valid(target_json)),
  priority TEXT NOT NULL,
  dedupe_key TEXT NOT NULL,
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
  status TEXT NOT NULL CHECK (status IN ('created','delivered','partially_failed','failed','archived')),
  read_at TEXT,
  archived_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(recipient_id, dedupe_key),
  FOREIGN KEY(template_id, template_version) REFERENCES notification_templates(id, template_version) ON DELETE RESTRICT
);

CREATE TABLE notification_preferences (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  in_app INTEGER NOT NULL CHECK (in_app IN (0,1)),
  email INTEGER NOT NULL CHECK (email IN (0,1)),
  quiet_hours_json TEXT NOT NULL CHECK (json_valid(quiet_hours_json)),
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(user_id, category)
);

CREATE TABLE notification_delivery_attempts (
  id TEXT PRIMARY KEY,
  notification_id TEXT NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  attempt INTEGER NOT NULL,
  status TEXT NOT NULL,
  provider_request_id TEXT,
  error_code TEXT,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  UNIQUE(notification_id, channel, attempt)
);

CREATE TABLE setting_definitions (
  key TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL,
  json_schema TEXT NOT NULL CHECK (json_valid(json_schema)),
  default_json TEXT NOT NULL CHECK (json_valid(default_json)),
  allowed_scopes_json TEXT NOT NULL CHECK (json_valid(allowed_scopes_json)),
  sensitive INTEGER NOT NULL CHECK (sensitive IN (0,1)),
  hot_reload INTEGER NOT NULL CHECK (hot_reload IN (0,1)),
  status TEXT NOT NULL
);

CREATE TABLE typed_settings (
  id TEXT PRIMARY KEY,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('system','project','user')),
  scope_id TEXT,
  setting_key TEXT NOT NULL REFERENCES setting_definitions(key) ON DELETE RESTRICT,
  value_json TEXT,
  value_ciphertext TEXT,
  definition_version INTEGER NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  CHECK ((value_json IS NULL) <> (value_ciphertext IS NULL)),
  CHECK (value_json IS NULL OR json_valid(value_json)),
  UNIQUE(scope_type, scope_id, setting_key)
);

CREATE TABLE setting_versions (
  id TEXT PRIMARY KEY,
  setting_id TEXT NOT NULL REFERENCES typed_settings(id) ON DELETE CASCADE,
  setting_version INTEGER NOT NULL,
  value_digest TEXT NOT NULL,
  encrypted_value_ref TEXT,
  changed_at TEXT NOT NULL,
  changed_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  UNIQUE(setting_id, setting_version)
);

CREATE TABLE audit_records (
  id TEXT PRIMARY KEY,
  occurred_at TEXT NOT NULL,
  actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  impersonator_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  correlation_id TEXT NOT NULL,
  result TEXT NOT NULL CHECK (result IN ('success','failure','denied')),
  ip_prefix TEXT,
  user_agent_digest TEXT,
  before_digest TEXT,
  after_digest TEXT,
  metadata_json TEXT NOT NULL CHECK (json_valid(metadata_json))
);
CREATE INDEX idx_audit_project_time ON audit_records(project_id, occurred_at DESC, id DESC);
CREATE INDEX idx_audit_actor_time ON audit_records(actor_id, occurred_at DESC, id DESC);
CREATE INDEX idx_audit_correlation ON audit_records(correlation_id);

CREATE TABLE retention_holds (
  id TEXT PRIMARY KEY,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  ends_at TEXT,
  released_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  released_at TEXT
);
CREATE INDEX idx_retention_target_active ON retention_holds(target_type,target_id,released_at);

CREATE TABLE recovery_plans (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  input_json TEXT NOT NULL CHECK (json_valid(input_json)),
  plan_json TEXT NOT NULL CHECK (json_valid(plan_json)),
  plan_digest TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('planned','executed','expired','cancelled')),
  created_at TEXT NOT NULL
);

CREATE TABLE cleanup_batches (
  id TEXT PRIMARY KEY,
  requested_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued','running','completed','partially_failed','failed')),
  items_json TEXT NOT NULL CHECK (json_valid(items_json)),
  report_json TEXT CHECK (report_json IS NULL OR json_valid(report_json)),
  created_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE TABLE staging_files (
  id TEXT PRIMARY KEY,
  media_id TEXT REFERENCES media_objects(id) ON DELETE CASCADE,
  sha256 TEXT NOT NULL,
  scan_status TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL
);

CREATE TABLE export_jobs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  requested_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  schema_version INTEGER NOT NULL,
  product_version TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued','running','completed','failed','expired')),
  manifest_hash TEXT,
  output_media_id TEXT REFERENCES media_objects(id) ON DELETE SET NULL,
  report_json TEXT CHECK (report_json IS NULL OR json_valid(report_json)),
  created_at TEXT NOT NULL,
  completed_at TEXT,
  expires_at TEXT
);

CREATE TABLE import_jobs (
  id TEXT PRIMARY KEY,
  requested_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  target_project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('create_new','merge')),
  source_schema_version INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('uploaded','scanning','planned','confirmed','running','completed','failed','rolled_back')),
  plan_json TEXT CHECK (plan_json IS NULL OR json_valid(plan_json)),
  plan_digest TEXT,
  report_json TEXT CHECK (report_json IS NULL OR json_valid(report_json)),
  created_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE TABLE import_object_mappings (
  import_id TEXT NOT NULL REFERENCES import_jobs(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  target_id TEXT,
  resolution TEXT NOT NULL,
  status TEXT NOT NULL,
  error_code TEXT,
  PRIMARY KEY(import_id, source_type, source_id)
);

CREATE TABLE backup_sets (
  id TEXT PRIMARY KEY,
  backup_type TEXT NOT NULL CHECK (backup_type IN ('full','incremental')),
  status TEXT NOT NULL CHECK (status IN ('queued','running','completed','verified','failed','expired')),
  schema_version INTEGER NOT NULL,
  event_position TEXT NOT NULL,
  encryption_key_ref TEXT NOT NULL,
  manifest_hash TEXT,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  retention_until TEXT NOT NULL
);

CREATE TABLE backup_artifacts (
  id TEXT PRIMARY KEY,
  backup_set_id TEXT NOT NULL REFERENCES backup_sets(id) ON DELETE CASCADE,
  artifact_type TEXT NOT NULL CHECK (artifact_type IN ('database','media','config','event_position')),
  storage_ref TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes >= 0),
  UNIQUE(backup_set_id, artifact_type, storage_ref)
);

CREATE TABLE backup_verifications (
  id TEXT PRIMARY KEY,
  backup_set_id TEXT NOT NULL REFERENCES backup_sets(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('running','passed','failed')),
  report_json TEXT NOT NULL CHECK (json_valid(report_json)),
  started_at TEXT NOT NULL,
  completed_at TEXT,
  verified_by TEXT REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE restore_jobs (
  id TEXT PRIMARY KEY,
  backup_set_id TEXT NOT NULL REFERENCES backup_sets(id) ON DELETE RESTRICT,
  target_environment TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('planned','approved','running','restored','verified','failed','rolled_back')),
  plan_json TEXT NOT NULL CHECK (json_valid(plan_json)),
  plan_digest TEXT NOT NULL,
  rollback_plan_json TEXT NOT NULL CHECK (json_valid(rollback_plan_json)),
  requested_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  started_at TEXT,
  completed_at TEXT,
  actual_rto_seconds INTEGER
);

CREATE TABLE restore_approvals (
  id TEXT PRIMARY KEY,
  restore_job_id TEXT NOT NULL REFERENCES restore_jobs(id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  decision TEXT NOT NULL CHECK (decision IN ('approve','reject')),
  created_at TEXT NOT NULL,
  UNIQUE(restore_job_id, actor_id)
);

CREATE TABLE restore_verifications (
  id TEXT PRIMARY KEY,
  restore_job_id TEXT NOT NULL REFERENCES restore_jobs(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('running','passed','failed')),
  report_json TEXT NOT NULL CHECK (json_valid(report_json)),
  started_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE TABLE datasets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  purpose TEXT NOT NULL,
  scope TEXT NOT NULL,
  classification TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','published','archived')),
  current_version INTEGER,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE dataset_versions (
  id TEXT PRIMARY KEY,
  dataset_id TEXT NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
  dataset_version INTEGER NOT NULL,
  manifest_json TEXT NOT NULL CHECK (json_valid(manifest_json)),
  manifest_hash TEXT NOT NULL,
  sample_count INTEGER NOT NULL CHECK (sample_count >= 0),
  size_bytes INTEGER NOT NULL CHECK (size_bytes >= 0),
  quality_report_id TEXT,
  license_json TEXT NOT NULL CHECK (json_valid(license_json)),
  published_at TEXT NOT NULL,
  published_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  UNIQUE(dataset_id, dataset_version)
);

CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active','archived')),
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  parent_id TEXT REFERENCES messages(id) ON DELETE SET NULL,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system','tool')),
  content_json TEXT NOT NULL CHECK (json_valid(content_json)),
  status TEXT NOT NULL CHECK (status IN ('streaming','completed','stopped','failed')),
  model_snapshot_json TEXT CHECK (model_snapshot_json IS NULL OR json_valid(model_snapshot_json)),
  usage_json TEXT CHECK (usage_json IS NULL OR json_valid(usage_json)),
  task_id TEXT REFERENCES ai_tasks(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE idempotency_records (
  actor_id TEXT NOT NULL,
  route_key TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  response_status INTEGER,
  response_json TEXT CHECK (response_json IS NULL OR json_valid(response_json)),
  resource_id TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY(actor_id, route_key, idempotency_key)
);

CREATE TABLE outbox_events (
  id TEXT PRIMARY KEY,
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  aggregate_version INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
  correlation_id TEXT NOT NULL,
  causation_id TEXT,
  occurred_at TEXT NOT NULL,
  published_at TEXT,
  attempt INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  UNIQUE(aggregate_type, aggregate_id, aggregate_version, event_type)
);
CREATE INDEX idx_outbox_pending ON outbox_events(published_at, occurred_at) WHERE published_at IS NULL;
