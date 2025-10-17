import fs from "node:fs";
import path from "node:path";
import type {
  Category,
  HistoryEntry,
  ScoreSheet,
  SerializedGameState,
} from "./types/shared.js";
import { normaliseName } from "./utils/names.js";

// Allow overriding data directory via environment variable for production deployments
// e.g. on Railway: mount a Volume at /data and set DATA_DIR=/data
const DATA_DIR = process.env.DATA_DIR && process.env.DATA_DIR.trim().length > 0
  ? path.resolve(process.env.DATA_DIR)
  : path.resolve(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "kniffel.json");
const TEMP_PATH = `${DB_PATH}.tmp`;

export type PersistedGame = {
  roomId: string;
  playerTokens: [string, string];
  state: SerializedGameState;
  createdAt: number;
  updatedAt: number;
  finishedAt: number | null;
  scores: [number, number] | null;
  winner: string | null;
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

type StoredGame = PersistedGame;

let games = new Map<string, StoredGame>();
let loaded = false;


function ensureLoaded() {
  if (loaded) return;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(DB_PATH)) {
    try {
      const raw = fs.readFileSync(DB_PATH, "utf8");
      if (raw.trim().length > 0) {
        const payload = JSON.parse(raw) as { version?: number; games?: StoredGame[] } | StoredGame[];
        const entries = Array.isArray(payload) ? payload : payload.games ?? [];
        games = new Map(entries.map((game) => [game.roomId, game]));
      }
    } catch (error) {
      console.warn("Failed to load persisted games. Starting with empty store.", error);
      games = new Map();
    }
  }
  loaded = true;
}

function persist() {
  if (!loaded) return;
  const payload = { version: 1, games: Array.from(games.values()) };
  const data = JSON.stringify(payload, null, 2);
  fs.writeFileSync(TEMP_PATH, data);
  fs.renameSync(TEMP_PATH, DB_PATH);
}

export function initDb() {
  ensureLoaded();
}

export function saveGame(record: PersistedGame) {
  ensureLoaded();
  games.set(record.roomId, clone(record));
  persist();
}

export function loadGame(roomId: string): PersistedGame | null {
  ensureLoaded();
  const stored = games.get(roomId);
  return stored ? clone(stored) : null;
}

export function deleteGame(roomId: string) {
  ensureLoaded();
  if (games.delete(roomId)) {
    persist();
  }
}

export function listHistory(limit = 50): HistoryEntry[] {
  ensureLoaded();
  const records = Array.from(games.values());
  const finished = records
    .filter((record) => record.finishedAt !== null || record.state.phase === "finished")
    .map((record) => ({
      record,
      finishedAt: record.finishedAt ?? record.updatedAt,
    }))
    .sort((a, b) => b.finishedAt - a.finishedAt)
    .slice(0, limit);

  return finished.map(({ record, finishedAt }) => {
    const scores = record.scores ?? deriveScores(record.state);
    const winner = record.winner ?? deriveWinner(record.state, scores);
    return {
      id: record.roomId,
      createdAt: record.createdAt,
      finishedAt,
      playerNames: record.state.playerNames,
      scores,
      winner,
      scoreSheets: record.state.scoreSheets,
    } satisfies HistoryEntry;
  });
}

type HistoryFilterMode = "exact" | "contains";

function normalizeKey(value: string): string {
  return normaliseName(value).toLowerCase();
}

function makeParticipants(names: [string, string]): [string, string] {
  const a = normalizeKey(names[0] ?? "");
  const b = normalizeKey(names[1] ?? "");
  return [a, b].sort() as [string, string];
}

export function listHistoryFiltered(options?: {
  limit?: number;
  players?: string[];
  mode?: HistoryFilterMode;
}): HistoryEntry[] {
  ensureLoaded();
  const limit = Math.max(1, Math.min(200, options?.limit ?? 50));
  const mode: HistoryFilterMode = options?.mode === "contains" ? "contains" : "exact";
  const players = (options?.players ?? []).map((p) => normalizeKey(p)).filter(Boolean);

  const records = Array.from(games.values());
  const finished = records
    .filter((record) => record.finishedAt !== null || record.state.phase === "finished")
    .map((record) => ({
      record,
      finishedAt: record.finishedAt ?? record.updatedAt,
      participants: makeParticipants(record.state.playerNames),
    }))
    .filter(({ participants }) => {
      if (players.length === 0) return true;
      const set = new Set(participants);
      if (mode === "contains") {
        // Match if any provided player is among the participants
        return players.some((p) => set.has(p));
      }
      // exact: all provided names must be present among the two participants
      return players.every((p) => set.has(p));
    })
    .sort((a, b) => b.finishedAt - a.finishedAt)
    .slice(0, limit);

  return finished.map(({ record, finishedAt }) => {
    const scores = record.scores ?? deriveScores(record.state);
    const winner = record.winner ?? deriveWinner(record.state, scores);
    return {
      id: record.roomId,
      createdAt: record.createdAt,
      finishedAt,
      playerNames: record.state.playerNames,
      scores,
      winner,
      scoreSheets: record.state.scoreSheets,
    } satisfies HistoryEntry;
  });
}

const UPPER_CATEGORIES: Category[] = [
  "ones",
  "twos",
  "threes",
  "fours",
  "fives",
  "sixes",
];

const LOWER_CATEGORIES: Category[] = [
  "threeKind",
  "fourKind",
  "fullHouse",
  "smallStraight",
  "largeStraight",
  "yahtzee",
  "chance",
];

function calculateFinalScore(sheet: ScoreSheet): number {
  const upper = UPPER_CATEGORIES.reduce(
    (sum, category) => sum + (sheet[category] ?? 0),
    0
  );
  const lower = LOWER_CATEGORIES.reduce(
    (sum, category) => sum + (sheet[category] ?? 0),
    0
  );
  const bonus = upper >= 63 ? 35 : 0;
  return upper + bonus + lower;
}

export function deriveScores(state: SerializedGameState): [number, number] {
  return [
    calculateFinalScore(state.scoreSheets[0]),
    calculateFinalScore(state.scoreSheets[1]),
  ];
}

export function deriveWinner(
  state: SerializedGameState,
  scores: [number, number] | null
): string {
  const [a, b] = scores ?? deriveScores(state);
  if (a > b) return state.playerNames[0];
  if (b > a) return state.playerNames[1];
  return "Draw";
}

export function toPersistedGame(
  params: {
    roomId: string;
    playerTokens: [string, string];
    state: SerializedGameState;
    createdAt?: number;
    updatedAt?: number;
    finishedAt?: number | null;
    scores?: [number, number] | null;
    winner?: string | null;
  }
): PersistedGame {
  const createdAt = params.createdAt ?? Date.now();
  const updatedAt = params.updatedAt ?? Date.now();
  const finishedAt =
    params.finishedAt ?? (params.state.phase === "finished" ? updatedAt : null);
  const scores =
    params.scores ??
    (params.state.phase === "finished" || params.state.gameOver
      ? deriveScores(params.state)
      : null);
  const winner =
    params.winner ??
    (params.state.phase === "finished" || params.state.gameOver
      ? deriveWinner(params.state, scores)
      : null);

  return {
    roomId: params.roomId,
    playerTokens: params.playerTokens,
    state: params.state,
    createdAt,
    updatedAt,
    finishedAt,
    scores,
    winner,
  };
}
