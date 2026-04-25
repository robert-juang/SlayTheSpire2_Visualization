import { applySchema, createDatabase } from "../db/database.js";
import { ImportService } from "../import/importService.js";
import { AnalyticsRepository } from "../analytics/analyticsRepository.js";
import { RunAnalysisService } from "../ai/runAnalysisService.js";
import { ConfigRepository } from "../config/configRepository.js";

export const createAppServices = () => {
  const db = createDatabase();
  applySchema(db);

  const importService = new ImportService(db);
  const analyticsRepository = new AnalyticsRepository(db);
  const configRepository = new ConfigRepository(db);
  const runAnalysisService = new RunAnalysisService(analyticsRepository, configRepository);

  return {
    db,
    importService,
    analyticsRepository,
    runAnalysisService,
    configRepository
  };
};

export type AppServices = ReturnType<typeof createAppServices>;
