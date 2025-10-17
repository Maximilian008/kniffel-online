export type Die = 1 | 2 | 3 | 4 | 5 | 6;
export type Dice = [Die, Die, Die, Die, Die];

export type Category =
	| "ones" | "twos" | "threes" | "fours" | "fives" | "sixes"
	| "threeKind" | "fourKind" | "fullHouse" | "smallStraight" | "largeStraight" | "yahtzee" | "chance";
