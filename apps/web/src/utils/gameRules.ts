// Game rules - copied from packages/game-rules for Netlify build
import type { Category, Dice, Die } from "../types/shared";

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
    const serialized = Array.from(new Set(dice)).sort().join(",");
    return ["1,2,3,4", "2,3,4,5", "3,4,5,6"].some(pattern =>
        serialized.includes(pattern)
    );
};

const scoreCategory = (dice: Dice, category: Category): number => {
    switch (category) {
        case "ones": return dice.filter((d: number) => d === 1).length * 1;
        case "twos": return dice.filter((d: number) => d === 2).length * 2;
        case "threes": return dice.filter((d: number) => d === 3).length * 3;
        case "fours": return dice.filter((d: number) => d === 4).length * 4;
        case "fives": return dice.filter((d: number) => d === 5).length * 5;
        case "sixes": return dice.filter((d: number) => d === 6).length * 6;
        case "threeKind": return hasNOfAKind(dice, 3) ? sum(dice) : 0;
        case "fourKind": return hasNOfAKind(dice, 4) ? sum(dice) : 0;
        case "fullHouse": return isFullHouse(dice) ? 25 : 0;
        case "smallStraight": return isSmallStraight(dice) ? 30 : 0;
        case "largeStraight": return isLargeStraight(dice) ? 40 : 0;
        case "yahtzee": return hasNOfAKind(dice, 5) ? 50 : 0;
        case "chance": return sum(dice);
        default: return 0;
    }
};

export const scoreAllCategories = (dice: Dice): Record<Category, number> => {
    const categories: Category[] = [
        "ones", "twos", "threes", "fours", "fives", "sixes",
        "threeKind", "fourKind", "fullHouse", "smallStraight", "largeStraight", "yahtzee", "chance"
    ];

    const result = {} as Record<Category, number>;
    for (const category of categories) {
        result[category] = scoreCategory(dice, category);
    }
    return result;
};