// Shared types - copied from packages/shared for Netlify build
export type Die = 1 | 2 | 3 | 4 | 5 | 6;
export type Dice = [Die, Die, Die, Die, Die];

export type Category =
  | "ones" | "twos" | "threes" | "fours" | "fives" | "sixes"
  | "threeKind" | "fourKind" | "fullHouse" | "smallStraight" | "largeStraight" | "yahtzee" | "chance";

export type ScoreSheet = Partial<Record<Category, number>>;
export type ScoreSheets = [ScoreSheet, ScoreSheet];

export type PlayerIndex = 0 | 1;
export type GamePhase = "setup" | "playing" | "finished";

export interface GameState {
  dice: Dice;
  held: boolean[];
  rollsLeft: number;
  currentPlayer: 1 | 2;
  scoreSheets: ScoreSheets;
  usedCategories: [Set<Category>, Set<Category>];
  gameOver: boolean;
  playerNames: [string, string];
  phase: GamePhase;
  ready: [boolean, boolean];
}

export interface SerializedGameState extends Omit<GameState, "usedCategories"> {
  usedCategories: [Category[], Category[]];
}

export interface HistoryEntry {
  id: string;
  createdAt: number;
  finishedAt: number;
  playerNames: [string, string];
  scores: [number, number];
  winner: string;
  scoreSheets: ScoreSheets;
}

export const MAX_ROLLS_PER_TURN = 3;