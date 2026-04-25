import type Database from "better-sqlite3";
import type { AppConfig } from "../../shared/types/run.js";

const DEFAULT_APP_CONFIG: AppConfig = {
  allowExternalAiCalls: true
};

export class ConfigRepository {
  constructor(private readonly db: Database.Database) {}

  getConfig(): AppConfig {
    const rows = this.db
      .prepare("SELECT config_key AS configKey, config_value AS configValue FROM app_config")
      .all() as Array<{ configKey: string; configValue: string }>;

    if (rows.length === 0) {
      this.setConfig(DEFAULT_APP_CONFIG);
      return DEFAULT_APP_CONFIG;
    }

    const map = new Map(rows.map((row) => [row.configKey, row.configValue]));
    return {
      allowExternalAiCalls: map.get("allowExternalAiCalls") !== "false"
    };
  }

  setConfig(config: AppConfig): AppConfig {
    const transaction = this.db.transaction((nextConfig: AppConfig) => {
      this.db
        .prepare(
          `INSERT INTO app_config (config_key, config_value)
           VALUES (?, ?)
           ON CONFLICT(config_key) DO UPDATE SET config_value = excluded.config_value`
        )
        .run("allowExternalAiCalls", String(nextConfig.allowExternalAiCalls));
    });

    transaction(config);
    return this.getConfig();
  }
}
