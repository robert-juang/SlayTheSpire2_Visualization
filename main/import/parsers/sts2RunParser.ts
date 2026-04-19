import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { z } from "zod";
import type { ParsedRun, RawRun, TeamSource } from "../../../shared/types/run.js";

const runSchema = z.object({
  timestamp: z.number(),
  character: z.string(),
  ascension: z.number().default(0),
  victory: z.boolean().default(false),
  floor_reached: z.number().default(0),
  seed: z.string().default(""),
  duration: z.number().default(0),
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
    return {
      parsed: {
        playerName: source.playerName,
        steamPath: source.steamPath,
        sourcePath,
        sourceHash,
        raw: validated
      }
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unknown parse error" };
  }
};
