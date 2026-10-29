import { describe, expect, it } from "vitest";
import { determineWinner, scoreCategory, totalScore, type Dice } from "../src";

const d = (...values: number[]) => values as Dice;

describe("scoreCategory", () => {
  it("counts the upper section", () => {
    expect(scoreCategory(d(1, 1, 3, 1, 6), "ones")).toBe(3);
    expect(scoreCategory(d(6, 6, 3, 1, 6), "sixes")).toBe(18);
    expect(scoreCategory(d(2, 3, 4, 5, 6), "ones")).toBe(0);
  });

  it("scores pairs of a kind with the dice sum", () => {
    expect(scoreCategory(d(4, 4, 4, 2, 1), "threeKind")).toBe(15);
    expect(scoreCategory(d(4, 4, 2, 2, 1), "threeKind")).toBe(0);
    expect(scoreCategory(d(5, 5, 5, 5, 1), "fourKind")).toBe(21);
    expect(scoreCategory(d(5, 5, 5, 1, 1), "fourKind")).toBe(0);
  });

  it("recognises a full house", () => {
    expect(scoreCategory(d(2, 3, 2, 3, 2), "fullHouse")).toBe(25);
    expect(scoreCategory(d(2, 2, 2, 2, 3), "fullHouse")).toBe(0);
    expect(scoreCategory(d(6, 6, 6, 6, 6), "fullHouse")).toBe(0);
  });

  it("recognises straights regardless of order and duplicates", () => {
    expect(scoreCategory(d(4, 3, 2, 1, 1), "smallStraight")).toBe(30);
    expect(scoreCategory(d(6, 4, 3, 5, 1), "smallStraight")).toBe(30);
    expect(scoreCategory(d(1, 2, 3, 5, 6), "smallStraight")).toBe(0);
    expect(scoreCategory(d(5, 4, 3, 2, 1), "largeStraight")).toBe(40);
    expect(scoreCategory(d(2, 3, 4, 5, 6), "largeStraight")).toBe(40);
    expect(scoreCategory(d(1, 2, 3, 4, 6), "largeStraight")).toBe(0);
  });

  it("scores Kniffel and chance", () => {
    expect(scoreCategory(d(3, 3, 3, 3, 3), "yahtzee")).toBe(50);
    expect(scoreCategory(d(3, 3, 3, 3, 2), "yahtzee")).toBe(0);
    expect(scoreCategory(d(1, 2, 3, 4, 6), "chance")).toBe(16);
  });
});

describe("totalScore", () => {
  it("adds the upper bonus from 63 points", () => {
    const sheet = { ones: 3, twos: 6, threes: 9, fours: 12, fives: 15, sixes: 18, chance: 20 };
    expect(totalScore(sheet)).toBe(63 + 35 + 20);
    expect(totalScore({ ...sheet, sixes: 12 })).toBe(57 + 20);
  });
});

describe("determineWinner", () => {
  it("returns the best player or null on a draw", () => {
    expect(determineWinner(["Anna", "Ben", "Carl"], [100, 180, 120])).toBe("Ben");
    expect(determineWinner(["Anna", "Ben"], [150, 150])).toBeNull();
    expect(determineWinner(["", "Ben"], [200, 150])).toBe("Spieler 1");
  });
});
