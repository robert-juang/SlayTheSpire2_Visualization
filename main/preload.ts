import { contextBridge, ipcRenderer } from "electron";
import type {
  ImportRequest,
  ImportResponse,
  ProfileBootstrapResult,
  RunSummaryFilters
} from "../shared/types/ipc.js";
import type {
  CharacterAscensionWinRateRow,
  ImportPreviewResult,
  OverviewMetrics,
  ProfileCandidate,
  PlayerComparisonRow,
  RunAiAnalysis,
  RunDetail,
  RunListItem
} from "../shared/types/run.js";

const api = {
  listProfiles: (): Promise<ProfileCandidate[]> => ipcRenderer.invoke("profiles:list"),
  bootstrapProfile: (profile: {
    displayName: string;
    steamPath: string;
  }): Promise<ProfileBootstrapResult> => ipcRenderer.invoke("profiles:bootstrap", profile),
  previewImport: (request: ImportRequest): Promise<ImportPreviewResult> =>
    ipcRenderer.invoke("runs:preview-import", request),
  importRuns: (request: ImportRequest): Promise<ImportResponse> =>
    ipcRenderer.invoke("runs:import", request),
  getOverview: (filters?: RunSummaryFilters): Promise<OverviewMetrics> =>
    ipcRenderer.invoke("analytics:overview", filters ?? {}),
  getPlayerComparison: (): Promise<PlayerComparisonRow[]> =>
    ipcRenderer.invoke("analytics:players"),
  getWinRateByAscension: (): Promise<CharacterAscensionWinRateRow[]> =>
    ipcRenderer.invoke("analytics:winrate-by-ascension"),
  getRuns: (filters?: RunSummaryFilters): Promise<RunListItem[]> =>
    ipcRenderer.invoke("analytics:runs", filters ?? {}),
  getRunDetail: (runId: string): Promise<RunDetail | null> =>
    ipcRenderer.invoke("analytics:run-detail", runId),
  getRunAiAnalysis: (runId: string): Promise<RunAiAnalysis> =>
    ipcRenderer.invoke("analytics:run-ai-analysis", runId)
};

contextBridge.exposeInMainWorld("sts2Api", api);

export type DesktopApi = typeof api;
