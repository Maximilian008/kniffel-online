import { isCategory, scoreCategory } from "./scoring";
import {
  CATEGORIES,
  DICE_COUNT,
  MAX_NAME_LENGTH,
  MAX_PLAYERS,
  MAX_ROLLS_PER_TURN,
  MIN_PLAYERS,
  type Dice,
  type Die,
  type GameState,
} from "./types";

/**
 * Pure game rules. Every action validates its input and returns a new state
 * (the input state is never mutated), or an error message for the player.
 */

export type Rng = () => number;
export type ActionResult = { ok: true; state: GameState } | { ok: false; error: string };

const fail = (error: string): ActionResult => ({ ok: false, error });

export function clampPlayerCount(value: unknown): number {
  const n = typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : MIN_PLAYERS;
  return Math.max(MIN_PLAYERS, Math.min(MAX_PLAYERS, n));
}

export function normaliseName(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").slice(0, MAX_NAME_LENGTH);
}

export function nameKey(value: unknown): string {
  return normaliseName(value).toLowerCase();
}

export function rollDice(rng: Rng = Math.random): Dice {
  return Array.from({ length: DICE_COUNT }, () => (Math.floor(rng() * 6) + 1) as Die) as Dice;
}

const fill = <T>(length: number, make: (index: number) => T): T[] => Array.from({ length }, (_, i) => make(i));

/** Creates a game in the setup phase. Existing names are kept (e.g. for a rematch). */
export function createGame(playerCount: number, names: readonly string[] = [], rng: Rng = Math.random): GameState {
  const n = clampPlayerCount(playerCount);
  return {
    phase: "setup",
    dice: rollDice(rng),
    held: fill(DICE_COUNT, () => false),
    rollsLeft: MAX_ROLLS_PER_TURN,
    currentPlayer: 0,
    playerNames: fill(n, (i) => normaliseName(names[i] ?? "")),
    ready: fill(n, () => false),
    scoreSheets: fill(n, () => ({})),
    usedCategories: fill(n, () => []),
    gameOver: false,
    startedAt: null,
  };
}

const clone = (state: GameState): GameState => JSON.parse(JSON.stringify(state)) as GameState;

const isSeat = (state: GameState, seat: number) =>
  Number.isInteger(seat) && seat >= 0 && seat < state.playerNames.length;

export function setPlayerCount(state: GameState, playerCount: number): ActionResult {
  if (state.phase !== "setup") return fail("Die Spielerzahl kann nur vor dem Start geändert werden.");
  const n = clampPlayerCount(playerCount);
  const next = clone(state);
  next.playerNames = fill(n, (i) => state.playerNames[i] ?? "");
  next.ready = fill(n, () => false);
  next.scoreSheets = fill(n, () => ({}));
  next.usedCategories = fill(n, () => []);
  return { ok: true, state: next };
}

export function setPlayerName(state: GameState, seat: number, name: string): ActionResult {
  if (!isSeat(state, seat)) return fail("Ungültiger Sitzplatz.");
  const normalised = normaliseName(name);
  if (!normalised) return fail("Name darf nicht leer sein.");
  const next = clone(state);
  next.playerNames[seat] = normalised;
  if (next.phase === "setup") next.ready[seat] = false;
  return { ok: true, state: next };
}

export function setReady(state: GameState, seat: number, ready: boolean, now = Date.now()): ActionResult {
  if (state.phase !== "setup") return fail("Das Spiel läuft bereits.");
  if (!isSeat(state, seat)) return fail("Ungültiger Sitzplatz.");
  const next = clone(state);
  next.ready[seat] = ready;
  const everyoneReady = next.ready.every(Boolean) && next.playerNames.every((name) => name.length > 0);
  return { ok: true, state: everyoneReady ? startGame(next, now) : next };
}

function startGame(state: GameState, now: number): GameState {
  const n = state.playerNames.length;
  return {
    ...state,
    phase: "playing",
    held: fill(DICE_COUNT, () => false),
    rollsLeft: MAX_ROLLS_PER_TURN,
    currentPlayer: 0,
    ready: fill(n, () => false),
    scoreSheets: fill(n, () => ({})),
    usedCategories: fill(n, () => []),
    gameOver: false,
    startedAt: now,
  };
}

function checkTurn(state: GameState, seat: number): string | null {
  if (state.phase !== "playing") return "Das Spiel hat noch nicht begonnen.";
  if (state.currentPlayer !== seat) return "Du bist nicht am Zug.";
  return null;
}

export function roll(state: GameState, seat: number, rng: Rng = Math.random): ActionResult {
  const error = checkTurn(state, seat);
  if (error) return fail(error);
  if (state.rollsLeft <= 0) return fail("Keine Würfe mehr übrig – wähle eine Kategorie.");
  const next = clone(state);
  const fresh = rollDice(rng);
  const firstRoll = state.rollsLeft === MAX_ROLLS_PER_TURN;
  next.dice = next.dice.map((value, index) => (!firstRoll && next.held[index] ? value : fresh[index])) as Dice;
  if (firstRoll) next.held = fill(DICE_COUNT, () => false);
  next.rollsLeft -= 1;
  return { ok: true, state: next };
}

export function toggleHold(state: GameState, seat: number, dieIndex: number): ActionResult {
  const error = checkTurn(state, seat);
  if (error) return fail(error);
  if (!Number.isInteger(dieIndex) || dieIndex < 0 || dieIndex >= DICE_COUNT) return fail("Ungültiger Würfel.");
  if (state.rollsLeft === MAX_ROLLS_PER_TURN) return fail("Erst würfeln, dann Würfel halten.");
  const next = clone(state);
  next.held[dieIndex] = !next.held[dieIndex];
  return { ok: true, state: next };
}

export function chooseCategory(state: GameState, seat: number, category: unknown): ActionResult {
  const error = checkTurn(state, seat);
  if (error) return fail(error);
  if (!isCategory(category)) return fail("Ungültige Kategorie.");
  if (state.rollsLeft === MAX_ROLLS_PER_TURN) return fail("Erst würfeln, dann eintragen.");
  if (state.usedCategories[seat].includes(category)) return fail("Diese Kategorie ist schon belegt.");

  const next = clone(state);
  next.scoreSheets[seat][category] = scoreCategory(next.dice, category);
  next.usedCategories[seat].push(category);

  if (next.usedCategories.every((used) => used.length === CATEGORIES.length)) {
    next.phase = "finished";
    next.gameOver = true;
    next.held = fill(DICE_COUNT, () => false);
    next.rollsLeft = 0;
    return { ok: true, state: next };
  }

  next.currentPlayer = (seat + 1) % next.playerNames.length;
  next.held = fill(DICE_COUNT, () => false);
  next.rollsLeft = MAX_ROLLS_PER_TURN;
  return { ok: true, state: next };
}

/** Back to the lobby with the same players (new game). */
export function resetGame(state: GameState, rng: Rng = Math.random): GameState {
  return createGame(state.playerNames.length, state.playerNames, rng);
}
