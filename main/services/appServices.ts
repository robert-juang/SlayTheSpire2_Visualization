import { applySchema, createDatabase } from "../db/database.js";
import { ImportService } from "../import/importService.js";
import { AnalyticsRepository } from "../analytics/analyticsRepository.js";

export const createAppServices = () => {
  const db = createDatabase();
  applySchema(db);

  const importService = new ImportService(db);
  const analyticsRepository = new AnalyticsRepository(db);

  return {
    db,
    importService,
    analyticsRepository
  };
};

export type AppServices = ReturnType<typeof createAppServices>;
