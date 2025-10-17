import type { Dice, Die, Category } from "./types.js";

// Utility helpers
const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);

const counts = (dice: Dice) => {
  const map = new Map<Die, number>();
  for (const die of dice) {
    map.set(die, (map.get(die) ?? 0) + 1);
  }
  return map;
};

const hasNOfAKind = (dice: Dice, n: number) => {
  for (const value of counts(dice).values()) {
    if (value >= n) return true;
  }
  return false;
};

const isFullHouse = (dice: Dice) => {
  const values = Array.from(counts(dice).values()).sort((a, b) => a - b);
  return values.length === 2 && values[0] === 2 && values[1] === 3;
};

const isLargeStraight = (dice: Dice) => {
  const serialized = Array.from(new Set(dice)).sort().join(",");
  return serialized === "1,2,3,4,5" || serialized === "2,3,4,5,6";
};

const isSmallStraight = (dice: Dice) => {
  const set = new Set(dice);
  const has = (a: Die, b: Die, c: Die, d: Die) =>
    set.has(a) && set.has(b) && set.has(c) && set.has(d);
  return has(1, 2, 3, 4) || has(2, 3, 4, 5) || has(3, 4, 5, 6);
};

// Score a single category
export const scoreCategory = (dice: Dice, cat: Category): number => {
  const values = [...dice];
  switch (cat) {
    case "ones": return values.filter((v) => v === 1).length * 1;
    case "twos": return values.filter((v) => v === 2).length * 2;
    case "threes": return values.filter((v) => v === 3).length * 3;
    case "fours": return values.filter((v) => v === 4).length * 4;
    case "fives": return values.filter((v) => v === 5).length * 5;
    case "sixes": return values.filter((v) => v === 6).length * 6;

    case "threeKind": return hasNOfAKind(dice, 3) ? sum(values) : 0;
    case "fourKind": return hasNOfAKind(dice, 4) ? sum(values) : 0;
    case "fullHouse": return isFullHouse(dice) ? 25 : 0;
    case "smallStraight": return isSmallStraight(dice) ? 30 : 0;
    case "largeStraight": return isLargeStraight(dice) ? 40 : 0;
    case "yahtzee": return hasNOfAKind(dice, 5) ? 50 : 0;
    case "chance": return sum(values);
    default:
      // Should be unreachable if Category is exhaustive, but keep a safe default
      return 0;
  }
};

// Score all categories at once
export const scoreAllCategories = (dice: Dice): Record<Category, number> => {
  const categories: Category[] = [
    "ones",
    "twos",
    "threes",
    "fours",
    "fives",
    "sixes",
    "threeKind",
    "fourKind",
    "fullHouse",
    "smallStraight",
    "largeStraight",
    "yahtzee",
    "chance",
  ];

  const result: Record<Category, number> = {} as Record<Category, number>;
  for (const category of categories) {
    result[category] = scoreCategory(dice, category);
  }
  return result;
};

// Roll five dice
export const rollDice = (): Dice => {
  const roll = (): Die => (Math.floor(Math.random() * 6) + 1) as Die;
  return [roll(), roll(), roll(), roll(), roll()];
};
