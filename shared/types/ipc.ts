import type { TeamSource } from "./run.js";

export type ImportRequest = {
  sources: TeamSource[];
};

export type ImportResponse = {
  filesSeen: number;
  filesImported: number;
  filesFailed: number;
  errors: Array<{ file: string; error: string }>;
};

export type RunSummaryFilters = {
  playerName?: string;
  character?: string;
  ascension?: number;
  fromTimestamp?: number;
  toTimestamp?: number;
  limit?: number;
  offset?: number;
};

export type ProfileBootstrapResult = {
  filesSeen: number;
  filesImported: number;
  filesFailed: number;
};
