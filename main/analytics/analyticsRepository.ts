import type Database from "better-sqlite3";
import fs from "node:fs";
import type { RunSummaryFilters } from "../../shared/types/ipc.js";
import type {
  CharacterAscensionWinRateRow,
  OverviewMetrics,
  RunAnalysisPayload,
  PlayerComparisonRow,
  RunDetail,
  RunListItem,
  RunListPage,
  RunFilterOptions
} from "../../shared/types/run.js";

const buildFilterSql = (filters?: RunSummaryFilters) => {
  const where: string[] = [];
  const params: Record<string, string | number> = {};

  if (filters?.playerName) {
    where.push("p.name = @playerName");
    params.playerName = filters.playerName;
  }
  if (filters?.character) {
    where.push("r.character = @character");
    params.character = filters.character;
  }
  if (filters?.ascension !== undefined) {
    where.push("r.ascension = @ascension");
    params.ascension = filters.ascension;
  }
  if (filters?.fromTimestamp) {
    where.push("r.run_timestamp >= @fromTimestamp");
    params.fromTimestamp = filters.fromTimestamp;
  }
  if (filters?.toTimestamp) {
    where.push("r.run_timestamp <= @toTimestamp");
    params.toTimestamp = filters.toTimestamp;
  }

  return {
    clause: where.length > 0 ? `WHERE ${where.join(" AND ")}` : "",
    params
  };
};

type RawRoom = {
  model_id?: string;
  monster_ids?: string[];
  room_type?: string;
  turns_taken?: number;
};

type RawCard = {
  id?: string;
  current_upgrade_level?: number;
};

type RawCardChoice = {
  was_picked?: boolean;
  card?: RawCard;
};

type RawPlayerStat = {
  card_choices?: RawCardChoice[];
  cards_gained?: Array<{ id?: string }>;
  current_gold?: number;
  damage_taken?: number;
  event_choices?: Array<{ title?: { key?: string; table?: string }; [key: string]: unknown }>;
  gold_gained?: number;
  gold_lost?: number;
  gold_spent?: number;
  gold_stolen?: number;
  hp_healed?: number;
  max_hp_gained?: number;
  max_hp_lost?: number;
  relic_choices?: Array<{ choice?: string; was_picked?: boolean }>;
  rest_site_choices?: string[];
  upgraded_cards?: string[];
};

type RawMapNode = {
  rooms?: RawRoom[];
  player_stats?: RawPlayerStat[];
};

type DetailRawRun = {
  seed?: string | number;
  character?: string;
  ascension?: number;
  floor_reached?: number;
  victory?: boolean;
  win?: boolean;
  players?: Array<{
    character?: string;
    deck?: RawCard[];
    relics?: Array<{ id?: string }>;
  }>;
  map_point_history?: RawMapNode[][];
};

const unique = (items: string[]) => [...new Set(items)];

const compact = (items: Array<string | undefined>) =>
  items.filter((item): item is string => Boolean(item));

const sum = (values: Array<number | undefined>): number => {
  let total = 0;
  for (const value of values) total += value ?? 0;
  return total;
};

const formatCard = (card: { id?: string; current_upgrade_level?: number }) => {
  if (!card.id) return undefined;
  const upgradeLevel = card.current_upgrade_level ?? 0;
  return upgradeLevel > 0 ? `${card.id}+${upgradeLevel}` : card.id;
};

const getPickedCard = (choice: RawCardChoice) => {
  if (!choice.was_picked || !choice.card?.id) return undefined;
  return formatCard(choice.card);
};

const getSkippedCard = (choice: RawCardChoice) => {
  if (choice.was_picked || !choice.card?.id) return undefined;
  return formatCard(choice.card);
};

const describeEventResult = (stat: RawPlayerStat) => {
  const results: string[] = [];
  const cards = compact((stat.cards_gained ?? []).map((card) => card.id));
  const relics = compact(
    (stat.relic_choices ?? [])
      .filter((relic) => relic.was_picked)
      .map((relic) => relic.choice)
  );

  if (cards.length > 0) results.push(`Cards gained: ${cards.join(", ")}`);
  if (relics.length > 0) results.push(`Relics picked: ${relics.join(", ")}`);
  if (stat.gold_gained) results.push(`Gold gained: ${stat.gold_gained}`);
  if (stat.gold_spent) results.push(`Gold spent: ${stat.gold_spent}`);
  if (stat.gold_lost) results.push(`Gold lost: ${stat.gold_lost}`);
  if (stat.gold_stolen) results.push(`Gold stolen: ${stat.gold_stolen}`);
  if (stat.damage_taken) results.push(`Damage taken: ${stat.damage_taken}`);
  if (stat.hp_healed) results.push(`HP healed: ${stat.hp_healed}`);
  if (stat.max_hp_gained) results.push(`Max HP gained: ${stat.max_hp_gained}`);
  if (stat.max_hp_lost) results.push(`Max HP lost: ${stat.max_hp_lost}`);

  return results;
};

export class AnalyticsRepository {
  constructor(private readonly db: Database.Database) {}

  getOverview(filters?: RunSummaryFilters): OverviewMetrics {
    const { clause, params } = buildFilterSql(filters);
    const row = this.db
      .prepare(
        `SELECT
          COUNT(*) AS totalRuns,
          AVG(CAST(r.victory AS REAL)) AS winRate,
          AVG(CAST(r.floor_reached AS REAL)) AS averageFloor,
          AVG(CAST(r.duration_s AS REAL)) AS averageDurationSeconds,
          AVG(CAST(m.deck_size AS REAL)) AS averageDeckSize
        FROM runs r
        JOIN players p ON p.id = r.player_id
        LEFT JOIN run_metadata m ON m.run_id = r.id
        ${clause}`
      )
      .get(params) as
      | {
          totalRuns: number;
          winRate: number | null;
          averageFloor: number | null;
          averageDurationSeconds: number | null;
          averageDeckSize: number | null;
        }
      | undefined;

    return {
      totalRuns: row?.totalRuns ?? 0,
      winRate: row?.winRate ?? 0,
      averageFloor: row?.averageFloor ?? 0,
      averageDurationSeconds: row?.averageDurationSeconds ?? 0,
      averageDeckSize: row?.averageDeckSize ?? 0
    };
  }

  getPlayerComparison(): PlayerComparisonRow[] {
    return this.db
      .prepare(
        `SELECT
          p.name AS playerName,
          COUNT(*) AS runCount,
          AVG(CAST(r.victory AS REAL)) AS winRate,
          AVG(CAST(r.floor_reached AS REAL)) AS averageFloor
        FROM runs r
        JOIN players p ON p.id = r.player_id
        GROUP BY p.name
        ORDER BY runCount DESC`
      )
      .all() as PlayerComparisonRow[];
  }

  getWinRateByAscension(): CharacterAscensionWinRateRow[] {
    return this.db
      .prepare(
        `SELECT
          r.character AS character,
          r.ascension AS ascension,
          COUNT(*) AS runCount,
          AVG(CAST(r.victory AS REAL)) AS winRate
        FROM runs r
        GROUP BY r.character, r.ascension
        ORDER BY r.ascension ASC, r.character ASC`
      )
      .all() as CharacterAscensionWinRateRow[];
  }

  getRuns(filters?: RunSummaryFilters): RunListPage {
    const { clause, params } = buildFilterSql(filters);
    const pagingParams = {
      ...params,
      limit: filters?.limit ?? 50,
      offset: filters?.offset ?? 0
    };

    const totalRow = this.db
      .prepare(
        `SELECT COUNT(*) AS totalRuns
        FROM runs r
        JOIN players p ON p.id = r.player_id
        LEFT JOIN run_metadata m ON m.run_id = r.id
        ${clause}`
      )
      .get(params) as { totalRuns: number } | undefined;

    const runs = this.db
      .prepare(
        `SELECT
          CAST(r.id AS TEXT) AS id,
          p.name AS playerName,
          r.run_timestamp AS runTimestamp,
          r.character AS character,
          r.ascension AS ascension,
          r.victory AS victory,
          r.floor_reached AS floorReached,
          r.duration_s AS durationSeconds,
          COALESCE(m.deck_size, 0) AS deckSize,
          COALESCE(m.relic_count, 0) AS relicCount,
          COALESCE(m.enemy_count, 0) AS enemyCount,
          COALESCE(m.unique_enemy_count, 0) AS uniqueEnemyCount,
          m.killed_by_encounter AS killedByEncounter
        FROM runs r
        JOIN players p ON p.id = r.player_id
        LEFT JOIN run_metadata m ON m.run_id = r.id
        ${clause}
        ORDER BY r.run_timestamp DESC
        LIMIT @limit
        OFFSET @offset`
      )
      .all(pagingParams) as RunListItem[];

    return {
      runs,
      totalRuns: totalRow?.totalRuns ?? 0
    };
  }

  getRunDetail(runId: string): RunDetail | null {
    const row = this.db
      .prepare("SELECT CAST(id AS TEXT) AS id, seed, source_file AS sourceFile FROM runs WHERE id = ?")
      .get(runId) as { id: string; seed: string; sourceFile: string } | undefined;
    if (!row) return null;

    let raw: DetailRawRun;
    try {
      raw = JSON.parse(fs.readFileSync(row.sourceFile, "utf8")) as DetailRawRun;
    } catch {
      return {
        id: row.id,
        sourceFile: row.sourceFile,
        seed: row.seed,
        cardsUsed: [],
        relicsObtained: [],
        goldGained: 0,
        goldSpent: 0,
        goldLost: 0,
        goldStolen: 0,
        normalEnemies: [],
        elites: [],
        events: []
      };
    }
    const firstPlayer = raw.players?.[0] ?? {};
    const mapPointHistory = raw.map_point_history ?? [];
    const stats = mapPointHistory.flatMap((act) => act.flatMap((node) => node.player_stats ?? []));
    const roomsByActAndFloor = mapPointHistory.flatMap((actNodes, actIndex) =>
      actNodes.flatMap((node, floorIndex) =>
        (node.rooms ?? []).map((room) => ({
          act: actIndex + 1,
          floor: floorIndex + 1,
          room
        }))
      )
    );

    const normalEnemies = roomsByActAndFloor
      .filter(({ room }) => room.model_id && ["monster", "enemy", "combat"].includes(room.room_type ?? ""))
      .map(({ room }) => room.model_id as string);
    const elites = roomsByActAndFloor
      .filter(({ room }) => room.model_id && (room.room_type ?? "").includes("elite"))
      .map(({ room }) => room.model_id as string);
    const events = roomsByActAndFloor
      .filter(({ room }) => room.model_id && (room.room_type ?? "") === "event")
      .map(({ act, floor, room }) => {
        const nodeStats = mapPointHistory[act - 1]?.[floor - 1]?.player_stats ?? [];
        const choiceLabels = nodeStats.flatMap((stat) =>
          (stat.event_choices ?? []).map((choice) => choice.title?.key)
        );
        const results = [
          ...compact(choiceLabels),
          ...nodeStats.flatMap(describeEventResult)
        ];
        return {
          act,
          floor,
          eventId: room.model_id as string,
          results: results.length > 0 ? results : ["No recorded result"]
        };
      });

    return {
      id: row.id,
      sourceFile: row.sourceFile,
      seed: String(raw.seed ?? row.seed),
      cardsUsed: compact((firstPlayer.deck ?? []).map(formatCard)),
      relicsObtained: compact((firstPlayer.relics ?? []).map((relic) => relic.id)),
      goldGained: sum(stats.map((stat) => stat.gold_gained)),
      goldSpent: sum(stats.map((stat) => stat.gold_spent)),
      goldLost: sum(stats.map((stat) => stat.gold_lost)),
      goldStolen: sum(stats.map((stat) => stat.gold_stolen)),
      finalGold: [...stats].reverse().find((stat) => stat.current_gold !== undefined)?.current_gold,
      normalEnemies: unique(normalEnemies),
      elites: unique(elites),
      events
    };
  }

  getRunFilterOptions(): RunFilterOptions {
    const characters = this.db
      .prepare("SELECT DISTINCT character FROM runs ORDER BY character ASC")
      .all() as Array<{ character: string }>;
    const ascensions = this.db
      .prepare("SELECT DISTINCT ascension FROM runs ORDER BY ascension ASC")
      .all() as Array<{ ascension: number }>;

    return {
      characters: characters.map((row) => row.character),
      ascensions: ascensions.map((row) => row.ascension)
    };
  }

  getRunAnalysisPayload(runId: string): RunAnalysisPayload | null {
    const row = this.db
      .prepare(
        `SELECT
          CAST(id AS TEXT) AS id,
          source_file AS sourceFile,
          character,
          ascension,
          victory,
          floor_reached AS floorReached
        FROM runs
        WHERE id = ?`
      )
      .get(runId) as
      | {
          id: string;
          sourceFile: string;
          character: string;
          ascension: number;
          victory: number;
          floorReached: number;
        }
      | undefined;
    if (!row) return null;

    let raw: DetailRawRun;
    try {
      raw = JSON.parse(fs.readFileSync(row.sourceFile, "utf8")) as DetailRawRun;
    } catch {
      return null;
    }

    const firstPlayer = raw.players?.[0] ?? {};
    const finalDeck = compact((firstPlayer.deck ?? []).map(formatCard));
    const upgradedCardCount = (firstPlayer.deck ?? []).filter(
      (card) => (card.current_upgrade_level ?? 0) > 0 && card.id
    ).length;
    const mapPointHistory = raw.map_point_history ?? [];
    const nodes = mapPointHistory.flatMap((actNodes, actIndex) =>
      actNodes.map((node, floorIndex) => ({
        act: actIndex + 1,
        floor: floorIndex + 1,
        node,
        room: node.rooms?.[0]
      }))
    );

    const cardsPicked = nodes.flatMap(({ act, floor, node, room }) =>
      (node.player_stats ?? []).flatMap((stat) => {
        if (!stat.card_choices?.length) return [];
        const pickedCard = stat.card_choices.map(getPickedCard).find(Boolean);
        if (!pickedCard) return [];
        return [
          {
            act,
            floor,
            roomType: room?.room_type ?? "unknown",
            encounterId: room?.model_id,
            pickedCard,
            skippedCards: compact(stat.card_choices.map(getSkippedCard))
          }
        ];
      })
    );

    const upgrades = nodes.flatMap(({ act, floor, node, room }) =>
      (node.player_stats ?? []).flatMap((stat) => {
        const cards = compact(stat.upgraded_cards ?? []);
        if (cards.length === 0) return [];
        return [
          {
            act,
            floor,
            source:
              stat.rest_site_choices?.includes("SMITH") || room?.room_type === "rest_site"
                ? "Rest Site"
                : room?.room_type === "event"
                  ? "Event"
                  : room?.room_type ?? "Unknown",
            cards
          }
        ];
      })
    );

    const damageTakenByAct = mapPointHistory.map((actNodes, index) => ({
      act: index + 1,
      totalDamage: sum(
        actNodes.flatMap((node) => (node.player_stats ?? []).map((stat) => stat.damage_taken))
      )
    }));

    const damageTakenByEncounter = nodes.flatMap(({ act, floor, node, room }) =>
      (node.player_stats ?? []).flatMap((stat) => {
        if (!room || !["monster", "elite", "boss"].includes(room.room_type ?? "")) return [];
        return [
          {
            act,
            floor,
            roomType: room.room_type ?? "unknown",
            encounterId: room.model_id ?? "Unknown Encounter",
            enemyIds: room.monster_ids ?? [],
            turnsTaken: room.turns_taken ?? 0,
            damageTaken: stat.damage_taken ?? 0
          }
        ];
      })
    );

    return {
      runId: row.id,
      sourceFile: row.sourceFile,
      character: firstPlayer.character ?? raw.character ?? row.character,
      ascension: raw.ascension ?? row.ascension,
      result: (raw.win ?? raw.victory ?? Boolean(row.victory)) ? "Win" : "Loss",
      floorReached: raw.floor_reached ?? row.floorReached,
      deckSize: finalDeck.length,
      upgradedCardCount,
      upgradeRatio: finalDeck.length > 0 ? Number((upgradedCardCount / finalDeck.length).toFixed(3)) : 0,
      finalDeck,
      cardsPicked,
      upgrades,
      damageTakenByAct,
      damageTakenByEncounter
    };
  }
}
