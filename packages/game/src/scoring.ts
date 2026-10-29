import {
  CATEGORIES,
  LOWER_CATEGORIES,
  UPPER_BONUS,
  UPPER_BONUS_THRESHOLD,
  UPPER_CATEGORIES,
  type Category,
  type Dice,
  type ScoreSheet,
} from "./types";

const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);

function countFaces(dice: Dice): number[] {
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (const die of dice) counts[die] += 1;
  return counts;
}

const hasNOfAKind = (dice: Dice, n: number) => countFaces(dice).some((count) => count >= n);

function isFullHouse(dice: Dice) {
  const counts = countFaces(dice).filter((count) => count > 0).sort((a, b) => a - b);
  return counts.length === 2 && counts[0] === 2 && counts[1] === 3;
}

function hasRun(dice: Dice, length: number) {
  const faces = new Set<number>(dice);
  for (let start = 1; start + length - 1 <= 6; start += 1) {
    let run = true;
    for (let face = start; face < start + length; face += 1) {
      if (!faces.has(face)) {
        run = false;
        break;
      }
    }
    if (run) return true;
  }
  return false;
}

export function isCategory(value: unknown): value is Category {
  return typeof value === "string" && (CATEGORIES as readonly string[]).includes(value);
}

export function scoreCategory(dice: Dice, category: Category): number {
  switch (category) {
    case "ones":
      return dice.filter((d) => d === 1).length;
    case "twos":
      return dice.filter((d) => d === 2).length * 2;
    case "threes":
      return dice.filter((d) => d === 3).length * 3;
    case "fours":
      return dice.filter((d) => d === 4).length * 4;
    case "fives":
      return dice.filter((d) => d === 5).length * 5;
    case "sixes":
      return dice.filter((d) => d === 6).length * 6;
    case "threeKind":
      return hasNOfAKind(dice, 3) ? sum(dice) : 0;
    case "fourKind":
      return hasNOfAKind(dice, 4) ? sum(dice) : 0;
    case "fullHouse":
      return isFullHouse(dice) ? 25 : 0;
    case "smallStraight":
      return hasRun(dice, 4) ? 30 : 0;
    case "largeStraight":
      return hasRun(dice, 5) ? 40 : 0;
    case "yahtzee":
      return hasNOfAKind(dice, 5) ? 50 : 0;
    case "chance":
      return sum(dice);
  }
}

export function scoreAllCategories(dice: Dice): Record<Category, number> {
  const result = {} as Record<Category, number>;
  for (const category of CATEGORIES) result[category] = scoreCategory(dice, category);
  return result;
}

export function upperSubtotal(sheet: ScoreSheet): number {
  return sum(UPPER_CATEGORIES.map((category) => sheet[category] ?? 0));
}

export function lowerSubtotal(sheet: ScoreSheet): number {
  return sum(LOWER_CATEGORIES.map((category) => sheet[category] ?? 0));
}

export function upperBonus(sheet: ScoreSheet): number {
  return upperSubtotal(sheet) >= UPPER_BONUS_THRESHOLD ? UPPER_BONUS : 0;
}

export function totalScore(sheet: ScoreSheet): number {
  return upperSubtotal(sheet) + upperBonus(sheet) + lowerSubtotal(sheet);
}

/** Returns the winner's name, or null when the best score is shared. */
export function determineWinner(playerNames: readonly string[], scores: readonly number[]): string | null {
  if (scores.length === 0) return null;
  const best = Math.max(...scores);
  const leaders = scores.flatMap((score, index) => (score === best ? [index] : []));
  if (leaders.length !== 1) return null;
  const index = leaders[0];
  return playerNames[index]?.trim() || `Spieler ${index + 1}`;
}
