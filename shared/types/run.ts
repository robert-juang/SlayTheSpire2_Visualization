export type TeamSource = {
  playerName: string;
  steamPath: string;
};

export type ProfileCandidate = {
  id: string;
  displayName: string;
  steamPath: string;
  runFileCount: number;
};

export type RawRun = {
  timestamp: number;
  character: string;
  ascension: number;
  victory: boolean;
  floor_reached: number;
  seed: string;
  duration: number;
  path_per_floor?: string[];
  card_choices?: Array<{ floor: number; picked: string; not_picked?: string[] }>;
  relics_obtained?: Array<{ floor: number; key: string }>;
  event_choices?: Array<{ floor?: number; event_name?: string; [key: string]: unknown }>;
  [key: string]: unknown;
};

export type ParsedRun = {
  playerName: string;
  steamPath: string;
  sourcePath: string;
  sourceHash: string;
  raw: RawRun;
};

export type ImportPreviewResult = {
  filesSeen: number;
  candidateFiles: number;
  alreadyImported: number;
  importable: number;
  invalidFiles: Array<{ file: string; error: string }>;
};

export type OverviewMetrics = {
  totalRuns: number;
  winRate: number;
  averageFloor: number;
  averageDurationSeconds: number;
};

export type PlayerComparisonRow = {
  playerName: string;
  runCount: number;
  winRate: number;
  averageFloor: number;
};

export type RunListItem = {
  id: string;
  playerName: string;
  runTimestamp: number;
  character: string;
  ascension: number;
  victory: number;
  floorReached: number;
  durationSeconds: number;
};
