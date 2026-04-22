CREATE TABLE IF NOT EXISTS players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  steam_path TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  run_timestamp INTEGER NOT NULL,
  character TEXT NOT NULL,
  ascension INTEGER NOT NULL,
  victory INTEGER NOT NULL,
  floor_reached INTEGER NOT NULL,
  seed TEXT NOT NULL,
  duration_s INTEGER NOT NULL,
  source_hash TEXT NOT NULL UNIQUE,
  source_file TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY(player_id) REFERENCES players(id)
);

CREATE TABLE IF NOT EXISTS run_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER NOT NULL,
  floor INTEGER,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  FOREIGN KEY(run_id) REFERENCES runs(id)
);

CREATE TABLE IF NOT EXISTS run_cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER NOT NULL,
  floor INTEGER,
  card_id TEXT NOT NULL,
  action TEXT NOT NULL,
  FOREIGN KEY(run_id) REFERENCES runs(id)
);

CREATE TABLE IF NOT EXISTS run_relics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER NOT NULL,
  floor INTEGER,
  relic_id TEXT NOT NULL,
  action TEXT NOT NULL,
  FOREIGN KEY(run_id) REFERENCES runs(id)
);

CREATE TABLE IF NOT EXISTS run_path (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER NOT NULL,
  floor INTEGER NOT NULL,
  node_type TEXT NOT NULL,
  act INTEGER NOT NULL,
  FOREIGN KEY(run_id) REFERENCES runs(id)
);

CREATE TABLE IF NOT EXISTS run_metadata (
  run_id INTEGER PRIMARY KEY,
  file_name TEXT NOT NULL,
  was_abandoned INTEGER NOT NULL,
  game_mode TEXT,
  build_id TEXT,
  platform_type TEXT,
  schema_version TEXT,
  killed_by_encounter TEXT,
  killed_by_event TEXT,
  num_acts INTEGER NOT NULL,
  acts_json TEXT NOT NULL,
  deck_size INTEGER NOT NULL,
  deck_cards_json TEXT NOT NULL,
  unique_deck_cards INTEGER NOT NULL,
  upgraded_cards_json TEXT NOT NULL,
  num_upgraded_cards INTEGER NOT NULL,
  relic_count INTEGER NOT NULL,
  relics_json TEXT NOT NULL,
  unique_relics INTEGER NOT NULL,
  enemy_count INTEGER NOT NULL,
  enemies_encountered_json TEXT NOT NULL,
  unique_enemy_count INTEGER NOT NULL,
  unique_enemies_json TEXT NOT NULL,
  act_summary_json TEXT NOT NULL,
  FOREIGN KEY(run_id) REFERENCES runs(id)
);

CREATE TABLE IF NOT EXISTS import_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  files_seen INTEGER NOT NULL DEFAULT 0,
  files_imported INTEGER NOT NULL DEFAULT 0,
  files_failed INTEGER NOT NULL DEFAULT 0,
  error_json TEXT NOT NULL DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS idx_runs_player_ts ON runs(player_id, run_timestamp);
CREATE INDEX IF NOT EXISTS idx_runs_character ON runs(character);
