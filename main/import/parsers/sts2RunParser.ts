import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { z } from "zod";
import type { NormalizedRun, ParsedRun, RawRun, RunMetadata, TeamSource } from "../../../shared/types/run.js";

const runSchema = z.object({
  timestamp: z.number().optional(),
  start_time: z.number().optional(),
  character: z.string().optional(),
  ascension: z.number().default(0),
  victory: z.boolean().optional(),
  win: z.boolean().optional(),
  was_abandoned: z.boolean().optional(),
  floor_reached: z.number().optional(),
  seed: z.union([z.string(), z.number()]).optional(),
  duration: z.number().optional(),
  run_time: z.number().optional(),
  game_mode: z.string().optional(),
  build_id: z.union([z.string(), z.number()]).optional(),
  platform_type: z.string().optional(),
  schema_version: z.union([z.string(), z.number()]).optional(),
  killed_by_encounter: z.string().optional(),
  killed_by_event: z.string().optional(),
  acts: z.array(z.string()).optional(),
  players: z
    .array(
      z
        .object({
          character: z.string().optional(),
          deck: z
            .array(z.object({ id: z.string().optional(), current_upgrade_level: z.number().optional() }).passthrough())
            .optional(),
          relics: z.array(z.object({ id: z.string().optional() }).passthrough()).optional()
        })
        .passthrough()
    )
    .optional(),
  map_point_history: z
    .array(
      z.array(
        z
          .object({
            rooms: z.array(z.object({ model_id: z.string().optional() }).passthrough()).optional()
          })
          .passthrough()
      )
    )
    .optional(),
  path_per_floor: z.array(z.string()).optional(),
  card_choices: z
    .array(
      z.object({
        floor: z.number(),
        picked: z.string(),
        not_picked: z.array(z.string()).optional()
      })
    )
    .optional(),
  relics_obtained: z
    .array(
      z.object({
        floor: z.number(),
        key: z.string()
      })
    )
    .optional(),
  event_choices: z
    .array(z.object({ floor: z.number().optional(), event_name: z.string().optional() }).passthrough())
    .optional()
}).passthrough();

const unique = (items: string[]) => [...new Set(items)];

const toStringValue = (value: string | number | undefined): string => {
  if (value === undefined || value === null) return "";
  return String(value);
};

const extractActEnemies = (mapPointHistory: RawRun["map_point_history"] = []) => {
  const actEnemies = new Map<number, string[]>();

  for (const [actIndex, actNodes] of mapPointHistory.entries()) {
    const enemies: string[] = [];
    for (const node of actNodes ?? []) {
      for (const room of node.rooms ?? []) {
        if (room.model_id) enemies.push(room.model_id);
      }
    }
    actEnemies.set(actIndex + 1, enemies);
  }

  return actEnemies;
};

const buildMetadata = (raw: RawRun, sourcePath: string): RunMetadata => {
  const firstPlayer = raw.players?.[0] ?? {};
  const deck = firstPlayer.deck ?? [];
  const relics = firstPlayer.relics ?? [];
  const acts = raw.acts ?? [];
  const deckCards = deck.flatMap((card) => (card.id ? [card.id] : []));
  const relicIds = relics.flatMap((relic) => (relic.id ? [relic.id] : []));
  const upgradedCards = deck.flatMap((card) =>
    card.id && (card.current_upgrade_level ?? 0) > 0 ? [card.id] : []
  );
  const actEnemies = extractActEnemies(raw.map_point_history);
  const enemiesEncountered = [...actEnemies.values()].flat();
  const uniqueEnemies = unique(enemiesEncountered).sort();

  return {
    fileName: path.basename(sourcePath),
    startTime: raw.start_time ?? raw.timestamp,
    runTimeSeconds: raw.run_time ?? raw.duration ?? 0,
    win: raw.win ?? raw.victory ?? false,
    wasAbandoned: raw.was_abandoned ?? false,
    gameMode: raw.game_mode,
    buildId: toStringValue(raw.build_id) || undefined,
    platformType: raw.platform_type,
    schemaVersion: toStringValue(raw.schema_version) || undefined,
    killedByEncounter: raw.killed_by_encounter,
    killedByEvent: raw.killed_by_event,
    numActs: acts.length,
    acts,
    deckSize: deckCards.length,
    deckCards,
    uniqueDeckCards: unique(deckCards).length,
    upgradedCards,
    numUpgradedCards: upgradedCards.length,
    relicCount: relicIds.length,
    relics: relicIds,
    uniqueRelics: unique(relicIds).length,
    enemyCount: enemiesEncountered.length,
    enemiesEncountered,
    uniqueEnemyCount: uniqueEnemies.length,
    uniqueEnemies,
    actSummaries: acts.map((actName, index) => {
      const act = index + 1;
      const enemies = actEnemies.get(act) ?? [];
      return {
        act,
        name: actName,
        enemyCount: enemies.length,
        enemies,
        uniqueEnemies: unique(enemies).sort()
      };
    })
  };
};

const normalizeRun = (raw: RawRun, metadata: RunMetadata): NormalizedRun => {
  const firstPlayer = raw.players?.[0] ?? {};
  return {
    timestamp: raw.start_time ?? raw.timestamp ?? 0,
    character: firstPlayer.character ?? raw.character ?? "UNKNOWN",
    ascension: raw.ascension ?? 0,
    victory: raw.win ?? raw.victory ?? false,
    floorReached: raw.floor_reached ?? raw.path_per_floor?.length ?? metadata.enemyCount,
    seed: toStringValue(raw.seed),
    durationSeconds: raw.run_time ?? raw.duration ?? 0
  };
};

const collectRunFiles = (dirPath: string): string[] => {
  if (!fs.existsSync(dirPath)) return [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.resolve(dirPath, entry.name);
    if (entry.isDirectory()) return collectRunFiles(fullPath);
    return entry.isFile() && entry.name.endsWith(".run") ? [fullPath] : [];
  });
};

export const countRunFilesInPath = (dirPath: string): number => collectRunFiles(dirPath).length;

export const listCandidateRunFiles = (sources: TeamSource[]) =>
  sources.flatMap((source) => collectRunFiles(source.steamPath).map((filePath) => ({ source, filePath })));

export const parseRunFile = (
  source: TeamSource,
  sourcePath: string
): { parsed?: ParsedRun; error?: string } => {
  try {
    const rawText = fs.readFileSync(sourcePath, "utf8");
    const json = JSON.parse(rawText) as RawRun;
    const validated = runSchema.parse(json);
    const sourceHash = crypto.createHash("sha256").update(rawText).digest("hex");
    const metadata = buildMetadata(validated, sourcePath);
    const normalized = normalizeRun(validated, metadata);
    return {
      parsed: {
        playerName: source.playerName,
        steamPath: source.steamPath,
        sourcePath,
        sourceHash,
        raw: validated,
        normalized,
        metadata
      }
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unknown parse error" };
  }
};
