export type Die = 1 | 2 | 3 | 4 | 5 | 6;
export type Dice = [Die, Die, Die, Die, Die];

export type Category =
    | "ones" | "twos" | "threes" | "fours" | "fives" | "sixes"
    | "threeKind" | "fourKind" | "fullHouse" | "smallStraight" | "largeStraight" | "yahtzee" | "chance";

export type ScoreSheet = Partial<Record<Category, number>>;
export type ScoreSheets = ScoreSheet[];

export type PlayerIndex = number; // 0..N-1
export type GamePhase = "setup" | "playing" | "finished";

export interface GameState {
    dice: Dice;
    held: boolean[];
    rollsLeft: number;
    currentPlayer: number; // 0..N-1
    scoreSheets: ScoreSheets;
    usedCategories: Array<Set<Category>>;
    gameOver: boolean;
    playerNames: string[];
    phase: GamePhase;
    ready: boolean[];
}

export interface SerializedGameState extends Omit<GameState, "usedCategories"> {
    usedCategories: Category[][];
}

export interface HistoryEntry {
    id: string;
    createdAt: number;
    finishedAt: number;
    playerNames: string[];
    scores: number[];
    winner: string;
    scoreSheets: ScoreSheets;
}

export const MAX_ROLLS_PER_TURN = 3;
