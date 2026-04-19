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
};
