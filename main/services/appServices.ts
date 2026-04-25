import { applySchema, createDatabase } from "../db/database.js";
import { ImportService } from "../import/importService.js";
import { AnalyticsRepository } from "../analytics/analyticsRepository.js";
import { RunAnalysisService } from "../ai/runAnalysisService.js";

export const createAppServices = () => {
  const db = createDatabase();
  applySchema(db);

  const importService = new ImportService(db);
  const analyticsRepository = new AnalyticsRepository(db);
  const runAnalysisService = new RunAnalysisService(analyticsRepository);

  return {
    db,
    importService,
    analyticsRepository,
    runAnalysisService
  };
};

export type AppServices = ReturnType<typeof createAppServices>;
