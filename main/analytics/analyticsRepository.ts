import type Database from "better-sqlite3";
import type { RunSummaryFilters } from "../../shared/types/ipc.js";
import type { OverviewMetrics, PlayerComparisonRow, RunListItem } from "../../shared/types/run.js";

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
          AVG(CAST(r.duration_s AS REAL)) AS averageDurationSeconds
        FROM runs r
        JOIN players p ON p.id = r.player_id
        ${clause}`
      )
      .get(params) as
      | {
          totalRuns: number;
          winRate: number | null;
          averageFloor: number | null;
          averageDurationSeconds: number | null;
        }
      | undefined;

    return {
      totalRuns: row?.totalRuns ?? 0,
      winRate: row?.winRate ?? 0,
      averageFloor: row?.averageFloor ?? 0,
      averageDurationSeconds: row?.averageDurationSeconds ?? 0
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

  getRuns(filters?: RunSummaryFilters): RunListItem[] {
    const { clause, params } = buildFilterSql(filters);
    return this.db
      .prepare(
        `SELECT
          CAST(r.id AS TEXT) AS id,
          p.name AS playerName,
          r.run_timestamp AS runTimestamp,
          r.character AS character,
          r.ascension AS ascension,
          r.victory AS victory,
          r.floor_reached AS floorReached,
          r.duration_s AS durationSeconds
        FROM runs r
        JOIN players p ON p.id = r.player_id
        ${clause}
        ORDER BY r.run_timestamp DESC
        LIMIT 500`
      )
      .all(params) as RunListItem[];
  }
}
