import { ipcMain } from "electron";
import type {
  ImportRequest,
  ProfileBootstrapResult,
  RunSummaryFilters
} from "../../shared/types/ipc.js";
import type { AppServices } from "../services/appServices.js";

export const registerRunIpcHandlers = (services: AppServices) => {
  ipcMain.handle("profiles:list", () => {
    return services.importService.discoverProfiles();
  });

  ipcMain.handle(
    "profiles:bootstrap",
    (_, profile: { displayName: string; steamPath: string }): ProfileBootstrapResult => {
      const result = services.importService.importRuns({
        sources: [{ playerName: profile.displayName, steamPath: profile.steamPath }]
      });
      return {
        filesSeen: result.filesSeen,
        filesImported: result.filesImported,
        filesFailed: result.filesFailed
      };
    }
  );

  ipcMain.handle("runs:preview-import", (_, request: ImportRequest) => {
    return services.importService.previewImport(request);
  });

  ipcMain.handle("runs:import", (_, request: ImportRequest) => {
    return services.importService.importRuns(request);
  });

  ipcMain.handle("analytics:overview", (_, filters?: RunSummaryFilters) => {
    return services.analyticsRepository.getOverview(filters);
  });

  ipcMain.handle("analytics:players", () => {
    return services.analyticsRepository.getPlayerComparison();
  });

  ipcMain.handle("analytics:winrate-by-ascension", () => {
    return services.analyticsRepository.getWinRateByAscension();
  });

  ipcMain.handle("analytics:runs", (_, filters?: RunSummaryFilters) => {
    return services.analyticsRepository.getRuns(filters);
  });

  ipcMain.handle("analytics:run-detail", (_, runId: string) => {
    return services.analyticsRepository.getRunDetail(runId);
  });

  ipcMain.handle("analytics:run-ai-analysis", async (_, runId: string) => {
    return services.runAnalysisService.analyzeRun(runId);
  });
};
