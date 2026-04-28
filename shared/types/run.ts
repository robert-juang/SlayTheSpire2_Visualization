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
  timestamp?: number;
  start_time?: number;
  character?: string;
  ascension?: number;
  victory?: boolean;
  win?: boolean;
  was_abandoned?: boolean;
  floor_reached?: number;
  seed?: string | number;
  duration?: number;
  run_time?: number;
  game_mode?: string;
  build_id?: string | number;
  platform_type?: string;
  schema_version?: string | number;
  killed_by_encounter?: string;
  killed_by_event?: string;
  acts?: string[];
  players?: Array<{
    character?: string;
    deck?: Array<{ id?: string; current_upgrade_level?: number }>;
    relics?: Array<{ id?: string }>;
    [key: string]: unknown;
  }>;
  map_point_history?: Array<Array<{ rooms?: Array<{ model_id?: string }> }>>;
  path_per_floor?: string[];
  card_choices?: Array<{ floor: number; picked: string; not_picked?: string[] }>;
  relics_obtained?: Array<{ floor: number; key: string }>;
  event_choices?: Array<{ floor?: number; event_name?: string; [key: string]: unknown }>;
  [key: string]: unknown;
};

export type NormalizedRun = {
  timestamp: number;
  character: string;
  ascension: number;
  victory: boolean;
  floorReached: number;
  seed: string;
  durationSeconds: number;
};

export type RunActSummary = {
  act: number;
  name?: string;
  enemyCount: number;
  enemies: string[];
  uniqueEnemies: string[];
};

export type RunMetadata = {
  fileName: string;
  startTime?: number;
  runTimeSeconds: number;
  win: boolean;
  wasAbandoned: boolean;
  gameMode?: string;
  buildId?: string;
  platformType?: string;
  schemaVersion?: string;
  killedByEncounter?: string;
  killedByEvent?: string;
  numActs: number;
  acts: string[];
  deckSize: number;
  deckCards: string[];
  uniqueDeckCards: number;
  upgradedCards: string[];
  numUpgradedCards: number;
  relicCount: number;
  relics: string[];
  uniqueRelics: number;
  enemyCount: number;
  enemiesEncountered: string[];
  uniqueEnemyCount: number;
  uniqueEnemies: string[];
  actSummaries: RunActSummary[];
};

export type ParsedRun = {
  playerName: string;
  steamPath: string;
  sourcePath: string;
  sourceHash: string;
  raw: RawRun;
  normalized: NormalizedRun;
  metadata: RunMetadata;
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
  averageDeckSize: number;
};

export type PlayerComparisonRow = {
  playerName: string;
  runCount: number;
  winRate: number;
  averageFloor: number;
};

export type CharacterAscensionWinRateRow = {
  character: string;
  ascension: number;
  runCount: number;
  winRate: number;
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
  deckSize: number;
  relicCount: number;
  enemyCount: number;
  uniqueEnemyCount: number;
  killedByEncounter?: string;
};

export type RunListPage = {
  runs: RunListItem[];
  totalRuns: number;
};

export type RunFilterOptions = {
  characters: string[];
  ascensions: number[];
};

export type RunDetailEvent = {
  act: number;
  floor: number;
  eventId: string;
  results: string[];
};

export type RunDetail = {
  id: string;
  sourceFile: string;
  seed: string;
  cardsUsed: string[];
  relicsObtained: string[];
  goldGained: number;
  goldSpent: number;
  goldLost: number;
  goldStolen: number;
  finalGold?: number;
  normalEnemies: string[];
  elites: string[];
  events: RunDetailEvent[];
};

export type RunAnalysisCardPick = {
  act: number;
  floor: number;
  roomType: string;
  encounterId?: string;
  pickedCard: string;
  skippedCards: string[];
};

export type RunAnalysisUpgrade = {
  act: number;
  floor: number;
  source: string;
  cards: string[];
};

export type RunAnalysisDamageByAct = {
  act: number;
  totalDamage: number;
};

export type RunAnalysisDamageByEncounter = {
  act: number;
  floor: number;
  roomType: string;
  encounterId: string;
  enemyIds: string[];
  turnsTaken: number;
  damageTaken: number;
};

export type RunAnalysisPayload = {
  runId: string;
  sourceFile: string;
  character: string;
  ascension: number;
  result: "Win" | "Loss";
  floorReached: number;
  deckSize: number;
  upgradedCardCount: number;
  upgradeRatio: number;
  finalDeck: string[];
  cardsPicked: RunAnalysisCardPick[];
  upgrades: RunAnalysisUpgrade[];
  damageTakenByAct: RunAnalysisDamageByAct[];
  damageTakenByEncounter: RunAnalysisDamageByEncounter[];
};

export type RunAiAnalysis = {
  runId: string;
  model: string;
  payload: RunAnalysisPayload;
  userPrompt: string;
  analysis: string;
};

export type AppConfig = {
  allowExternalAiCalls: boolean;
};
