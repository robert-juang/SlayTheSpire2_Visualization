import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import { app } from "electron";

const MIGRATION_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  migration_name TEXT NOT NULL UNIQUE,
  applied_at INTEGER NOT NULL
);`;

const EXTRA_MIGRATIONS = [
  {
    name: "002_run_metadata.sql",
    sql: `
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
);`
  },
  {
    name: "003_app_config.sql",
    sql: `
CREATE TABLE IF NOT EXISTS app_config (
  config_key TEXT PRIMARY KEY,
  config_value TEXT NOT NULL
);`
  }
];

export const createDatabase = () => {
  const userDataPath = app.getPath("userData");
  const dbDir = path.resolve(userDataPath, "db");
  fs.mkdirSync(dbDir, { recursive: true });
  const dbPath = path.resolve(dbDir, "sts2.sqlite");
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  return db;
};

export const applySchema = (db: Database.Database) => {
  db.exec(MIGRATION_TABLE_SQL);
  const schemaPath = path.resolve(process.cwd(), "main/db/schema.sql");
  const schemaSql = fs.readFileSync(schemaPath, "utf8");
  const migrationName = "001_init_schema.sql";
  const alreadyApplied = db
    .prepare("SELECT migration_name FROM schema_migrations WHERE migration_name = ?")
    .get(migrationName);

  if (!alreadyApplied) {
    db.exec("BEGIN");
    try {
      db.exec(schemaSql);
      db.prepare("INSERT INTO schema_migrations (migration_name, applied_at) VALUES (?, ?)")
        .run(migrationName, Date.now());
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }

  for (const migration of EXTRA_MIGRATIONS) {
    const applied = db
      .prepare("SELECT migration_name FROM schema_migrations WHERE migration_name = ?")
      .get(migration.name);
    if (applied) continue;

    db.exec("BEGIN");
    try {
      db.exec(migration.sql);
      db.prepare("INSERT INTO schema_migrations (migration_name, applied_at) VALUES (?, ?)")
        .run(migration.name, Date.now());
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
};
