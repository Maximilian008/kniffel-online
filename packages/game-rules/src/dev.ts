import { rollDice, scoreAllCategories } from "./index.js";

const dice = rollDice();
console.log("Rolled:", dice);
console.log("Possible scores:");
const scores = scoreAllCategories(dice);
for (const [category, value] of Object.entries(scores)) {
  console.log(`${category.padEnd(14)} -> ${value}`);
}
