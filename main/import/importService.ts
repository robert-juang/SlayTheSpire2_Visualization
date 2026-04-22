import type Database from "better-sqlite3";
import log from "electron-log";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import type { ImportRequest, ImportResponse } from "../../shared/types/ipc.js";
import type {
  ImportPreviewResult,
  ParsedRun,
  ProfileCandidate
} from "../../shared/types/run.js";
import { countRunFilesInPath, listCandidateRunFiles, parseRunFile } from "./parsers/sts2RunParser.js";

export class ImportService {
  constructor(private readonly db: Database.Database) {}

  private resolveDiscoveryPaths() {
    const scanRoot = path.resolve(
      "/Users",
      os.userInfo().username,
      "Library/Application Support/SlayTheSpire2/steam"
    );
    return { scanRoot };
  }

  discoverProfiles(): ProfileCandidate[] {
    const { scanRoot } = this.resolveDiscoveryPaths();

    const candidates = new Map<string, ProfileCandidate>();

    const addCandidate = (displayName: string, steamPath: string) => {
      const runFileCount = countRunFilesInPath(steamPath);
      if (runFileCount < 1) return;
      if (candidates.has(steamPath)) return;
      candidates.set(steamPath, {
        id: Buffer.from(steamPath).toString("base64"),
        displayName,
        steamPath,
        runFileCount
      });
    };

    if (fs.existsSync(scanRoot)) {
      const accountDirs = fs.readdirSync(scanRoot, { withFileTypes: true });
      for (const accountDir of accountDirs) {
        if (!accountDir.isDirectory()) continue;

        const accountPath = path.resolve(scanRoot, accountDir.name);
        const profileDirs = fs.readdirSync(accountPath, { withFileTypes: true });
        for (const profileDir of profileDirs) {
          if (!profileDir.isDirectory()) continue;
          if (!profileDir.name.startsWith("profile")) continue;

          const historyPath = path.resolve(accountPath, profileDir.name, "saves/history");
          const runFileCount = countRunFilesInPath(historyPath);

          if (runFileCount < 1) continue;

          addCandidate(`${profileDir.name} (${accountDir.name})`, historyPath);
        }
      }
    }

    return [...candidates.values()].sort((a, b) => b.runFileCount - a.runFileCount);
  }

  previewImport(request: ImportRequest): ImportPreviewResult {
    const candidates = listCandidateRunFiles(request.sources);
    const invalidFiles: Array<{ file: string; error: string }> = [];
    let alreadyImported = 0;
    let importable = 0;

    for (const candidate of candidates) {
      const parsed = parseRunFile(candidate.source, candidate.filePath);
      if (!parsed.parsed) {
        invalidFiles.push({ file: candidate.filePath, error: parsed.error ?? "Invalid run file" });
        continue;
      }

      const existing = this.db
        .prepare("SELECT id FROM runs WHERE source_hash = ?")
        .get(parsed.parsed.sourceHash);
      if (existing) {
        alreadyImported += 1;
      } else {
        importable += 1;
      }
    }

    return {
      filesSeen: candidates.length,
      candidateFiles: candidates.length,
      alreadyImported,
      importable,
      invalidFiles
    };
  }

  importRuns(request: ImportRequest): ImportResponse {
    const startedAt = Date.now();
    const importJob = this.db
      .prepare("INSERT INTO import_jobs (started_at, files_seen, files_imported, files_failed, error_json) VALUES (?, 0, 0, 0, '[]')")
      .run(startedAt);

    const candidates = listCandidateRunFiles(request.sources);
    const errors: Array<{ file: string; error: string }> = [];
    let filesImported = 0;
    let filesFailed = 0;
    let filesSeen = 0;

    const insertRunTx = this.db.transaction((parsed: ParsedRun) => {
      const playerId = this.upsertPlayer(parsed.playerName, parsed.steamPath);
      const runInsert = this.db
        .prepare(
          `INSERT INTO runs (
            player_id, run_timestamp, character, ascension, victory, floor_reached, seed, duration_s, source_hash, source_file, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          playerId,
          parsed.normalized.timestamp,
          parsed.normalized.character,
          parsed.normalized.ascension,
          parsed.normalized.victory ? 1 : 0,
          parsed.normalized.floorReached,
          parsed.normalized.seed,
          parsed.normalized.durationSeconds,
          parsed.sourceHash,
          parsed.sourcePath,
          Date.now()
        );

      const runId = Number(runInsert.lastInsertRowid);
      this.insertRunMetadata(runId, parsed);
      this.insertRunChildren(runId, parsed);
    });

    for (const candidate of candidates) {
      filesSeen += 1;
      const parsedResult = parseRunFile(candidate.source, candidate.filePath);
      if (!parsedResult.parsed) {
        filesFailed += 1;
        errors.push({ file: candidate.filePath, error: parsedResult.error ?? "Invalid run file" });
        continue;
      }

      const existing = this.db
        .prepare("SELECT id FROM runs WHERE source_hash = ?")
        .get(parsedResult.parsed.sourceHash);
      if (existing) {
        continue;
      }

      try {
        insertRunTx(parsedResult.parsed);
        filesImported += 1;
      } catch (error) {
        filesFailed += 1;
        const message = error instanceof Error ? error.message : "Failed to import run";
        errors.push({ file: candidate.filePath, error: message });
        log.error("Import failure", { file: candidate.filePath, message });
      }
    }

    this.db
      .prepare(
        "UPDATE import_jobs SET ended_at = ?, files_seen = ?, files_imported = ?, files_failed = ?, error_json = ? WHERE id = ?"
      )
      .run(Date.now(), filesSeen, filesImported, filesFailed, JSON.stringify(errors), importJob.lastInsertRowid);

    return { filesSeen, filesImported, filesFailed, errors };
  }

  private upsertPlayer(playerName: string, steamPath: string): number {
    const existing = this.db.prepare("SELECT id FROM players WHERE name = ?").get(playerName) as
      | { id: number }
      | undefined;
    if (existing) return existing.id;

    const result = this.db
      .prepare("INSERT INTO players (name, steam_path, created_at) VALUES (?, ?, ?)")
      .run(playerName, steamPath, Date.now());
    return Number(result.lastInsertRowid);
  }

  private insertRunChildren(runId: number, parsed: ParsedRun) {
    const insertEvent = this.db.prepare(
      "INSERT INTO run_events (run_id, floor, event_type, payload_json) VALUES (?, ?, ?, ?)"
    );
    for (const event of parsed.raw.event_choices ?? []) {
      insertEvent.run(runId, event.floor ?? null, event.event_name ?? "unknown_event", JSON.stringify(event));
    }

    const insertCard = this.db.prepare(
      "INSERT INTO run_cards (run_id, floor, card_id, action) VALUES (?, ?, ?, ?)"
    );
    for (const cardId of parsed.metadata.deckCards) {
      insertCard.run(runId, null, cardId, "final_deck");
    }
    for (const cardChoice of parsed.raw.card_choices ?? []) {
      insertCard.run(runId, cardChoice.floor, cardChoice.picked, "picked");
      for (const ignored of cardChoice.not_picked ?? []) {
        insertCard.run(runId, cardChoice.floor, ignored, "skipped");
      }
    }

    const insertRelic = this.db.prepare(
      "INSERT INTO run_relics (run_id, floor, relic_id, action) VALUES (?, ?, ?, ?)"
    );
    for (const relicId of parsed.metadata.relics) {
      insertRelic.run(runId, null, relicId, "final_relic");
    }
    for (const relic of parsed.raw.relics_obtained ?? []) {
      insertRelic.run(runId, relic.floor, relic.key, "obtained");
    }

    const insertPath = this.db.prepare(
      "INSERT INTO run_path (run_id, floor, node_type, act) VALUES (?, ?, ?, ?)"
    );
    for (const [index, nodeType] of (parsed.raw.path_per_floor ?? []).entries()) {
      const floor = index + 1;
      const act = floor <= 17 ? 1 : floor <= 34 ? 2 : 3;
      insertPath.run(runId, floor, nodeType, act);
    }

    let syntheticFloor = 1;
    for (const actSummary of parsed.metadata.actSummaries) {
      for (const enemy of actSummary.enemies) {
        insertPath.run(runId, syntheticFloor, enemy, actSummary.act);
        syntheticFloor += 1;
      }
    }
  }

  private insertRunMetadata(runId: number, parsed: ParsedRun) {
    const metadata = parsed.metadata;
    this.db
      .prepare(
        `INSERT INTO run_metadata (
          run_id, file_name, was_abandoned, game_mode, build_id, platform_type, schema_version,
          killed_by_encounter, killed_by_event, num_acts, acts_json, deck_size, deck_cards_json,
          unique_deck_cards, upgraded_cards_json, num_upgraded_cards, relic_count, relics_json,
          unique_relics, enemy_count, enemies_encountered_json, unique_enemy_count,
          unique_enemies_json, act_summary_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        runId,
        metadata.fileName,
        metadata.wasAbandoned ? 1 : 0,
        metadata.gameMode ?? null,
        metadata.buildId ?? null,
        metadata.platformType ?? null,
        metadata.schemaVersion ?? null,
        metadata.killedByEncounter ?? null,
        metadata.killedByEvent ?? null,
        metadata.numActs,
        JSON.stringify(metadata.acts),
        metadata.deckSize,
        JSON.stringify(metadata.deckCards),
        metadata.uniqueDeckCards,
        JSON.stringify(metadata.upgradedCards),
        metadata.numUpgradedCards,
        metadata.relicCount,
        JSON.stringify(metadata.relics),
        metadata.uniqueRelics,
        metadata.enemyCount,
        JSON.stringify(metadata.enemiesEncountered),
        metadata.uniqueEnemyCount,
        JSON.stringify(metadata.uniqueEnemies),
        JSON.stringify(metadata.actSummaries)
      );
  }
}
