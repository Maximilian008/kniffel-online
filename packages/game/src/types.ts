export type Die = 1 | 2 | 3 | 4 | 5 | 6;
export type Dice = [Die, Die, Die, Die, Die];

export type Category =
  | "ones"
  | "twos"
  | "threes"
  | "fours"
  | "fives"
  | "sixes"
  | "threeKind"
  | "fourKind"
  | "fullHouse"
  | "smallStraight"
  | "largeStraight"
  | "yahtzee"
  | "chance";

export const UPPER_CATEGORIES: readonly Category[] = ["ones", "twos", "threes", "fours", "fives", "sixes"];
export const LOWER_CATEGORIES: readonly Category[] = [
  "threeKind",
  "fourKind",
  "fullHouse",
  "smallStraight",
  "largeStraight",
  "yahtzee",
  "chance",
];
export const CATEGORIES: readonly Category[] = [...UPPER_CATEGORIES, ...LOWER_CATEGORIES];

export type ScoreSheet = Partial<Record<Category, number>>;

export type GamePhase = "setup" | "playing" | "finished";

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 6;
export const DICE_COUNT = 5;
export const MAX_ROLLS_PER_TURN = 3;
export const UPPER_BONUS_THRESHOLD = 63;
export const UPPER_BONUS = 35;
export const MAX_NAME_LENGTH = 40;

/** Complete game state as sent to every client. Arrays are indexed by seat (0..playerCount-1). */
export interface GameState {
  phase: GamePhase;
  dice: Dice;
  held: boolean[];
  /** Rolls left in the current turn. A turn starts with MAX_ROLLS_PER_TURN (dice not rolled yet). */
  rollsLeft: number;
  currentPlayer: number;
  playerNames: string[];
  ready: boolean[];
  scoreSheets: ScoreSheet[];
  usedCategories: Category[][];
  gameOver: boolean;
  startedAt: number | null;
}

/** A finished game as stored in the history. `winner` is null for a draw. */
export interface HistoryEntry {
  id: string;
  createdAt: number;
  finishedAt: number;
  playerNames: string[];
  scores: number[];
  winner: string | null;
  scoreSheets: ScoreSheet[];
}
