import type {
  Category,
  PlayerIndex,
  SerializedGameState,
} from "@shared/lib";
import { useState } from "react";
import { soundManager } from "../lib/sounds";

const CATEGORY_LABELS: Record<Category, string> = {
  ones: "Einser",
  twos: "Zweier",
  threes: "Dreier",
  fours: "Vierer",
  fives: "Fünfer",
  sixes: "Sechser",
  threeKind: "Dreierpasch",
  fourKind: "Viererpasch",
  fullHouse: "Full House",
  smallStraight: "Kleine Straße",
  largeStraight: "Große Straße",
  yahtzee: "Kniffel",
  chance: "Chance",
};

const CATEGORY_DESCRIPTIONS: Record<Category, string> = {
  ones: "Alle Einser zählen",
  twos: "Alle Zweier zählen",
  threes: "Alle Dreier zählen",
  fours: "Alle Vierer zählen",
  fives: "Alle Fünfer zählen",
  sixes: "Alle Sechser zählen",
  threeKind: "3 gleiche Würfel - Summe aller Würfel",
  fourKind: "4 gleiche Würfel - Summe aller Würfel",
  fullHouse: "3 gleiche + 2 gleiche - 25 Punkte",
  smallStraight: "4 aufeinanderfolgende Zahlen - 30 Punkte",
  largeStraight: "5 aufeinanderfolgende Zahlen - 40 Punkte",
  yahtzee: "5 gleiche Würfel - 50 Punkte",
  chance: "Beliebige Würfel - Summe aller Würfel",
};

const UPPER: Category[] = [
  "ones",
  "twos",
  "threes",
  "fours",
  "fives",
  "sixes",
];

const LOWER: Category[] = [
  "threeKind",
  "fourKind",
  "fullHouse",
  "smallStraight",
  "largeStraight",
  "yahtzee",
  "chance",
];

type Props = {
  state: SerializedGameState;
  playerNameA: string;
  playerNameB: string;
  activeIndex?: PlayerIndex;
  isCurrentPlayer: boolean;
  previewScores: Record<Category, number> | null;
  onChoose?: (category: Category) => void;
};

export default function Scoreboard({
  state,
  playerNameA,
  playerNameB,
  activeIndex,
  isCurrentPlayer,
  previewScores,
  onChoose,
}: Props) {
  const usedSets = state.usedCategories.map((list) => new Set(list)) as [
    Set<Category>,
    Set<Category>
  ];

  const sheets = state.scoreSheets as [
    Partial<Record<Category, number>>,
    Partial<Record<Category, number>>
  ];

  const upperTotals = sheets.map((sheet) =>
    UPPER.reduce((sum, category) => sum + (sheet[category] ?? 0), 0)
  );
  const bonuses = upperTotals.map((value) => (value >= 63 ? 35 : 0));
  const lowerTotals = sheets.map((sheet) =>
    LOWER.reduce((sum, category) => sum + (sheet[category] ?? 0), 0)
  );
  const finalTotals = sheets.map((_, index) =>
    upperTotals[index] + bonuses[index] + lowerTotals[index]
  ) as [number, number];

  return (
    <table className="scoreboard-table">
      <thead>
        <tr>
          <th>Category</th>
          <th>{playerNameA}</th>
          <th>{playerNameB}</th>
        </tr>
      </thead>
      <tbody>
        <tr className="section-row">
          <td colSpan={3}>Upper section</td>
        </tr>
        {UPPER.map((category) => (
          <ScoreRow
            key={category}
            category={category}
            sheets={sheets}
            usedSets={usedSets}
            activeIndex={activeIndex}
            isCurrentPlayer={isCurrentPlayer}
            previewScores={previewScores}
            onChoose={onChoose}
          />
        ))}
        <tr className="summary-row">
          <td>Subtotal</td>
          <td>{upperTotals[0]}</td>
          <td>{upperTotals[1]}</td>
        </tr>
        <tr className="summary-row">
          <td>Bonus (63+)</td>
          <td>{bonuses[0]}</td>
          <td>{bonuses[1]}</td>
        </tr>
        <tr className="section-row">
          <td colSpan={3}>Lower section</td>
        </tr>
        {LOWER.map((category) => (
          <ScoreRow
            key={category}
            category={category}
            sheets={sheets}
            usedSets={usedSets}
            activeIndex={activeIndex}
            isCurrentPlayer={isCurrentPlayer}
            previewScores={previewScores}
            onChoose={onChoose}
          />
        ))}
        <tr className="summary-row total">
          <td>Total score</td>
          <td>{finalTotals[0]}</td>
          <td>{finalTotals[1]}</td>
        </tr>
      </tbody>
    </table>
  );
}

type RowProps = {
  category: Category;
  sheets: [Partial<Record<Category, number>>, Partial<Record<Category, number>>];
  usedSets: [Set<Category>, Set<Category>];
  activeIndex?: PlayerIndex;
  isCurrentPlayer: boolean;
  previewScores: Record<Category, number> | null;
  onChoose?: (category: Category) => void;
};

function ScoreRow({
  category,
  sheets,
  usedSets,
  activeIndex,
  isCurrentPlayer,
  previewScores,
  onChoose,
}: RowProps) {
  const [animatingCell, setAnimatingCell] = useState<PlayerIndex | null>(null);
  const [screenShake, setScreenShake] = useState(false);
  const values = [sheets[0][category], sheets[1][category]] as [
    number | undefined,
    number | undefined
  ];
  const isUsed = [
    usedSets[0].has(category),
    usedSets[1].has(category),
  ] as [boolean, boolean];

  function renderCell(index: PlayerIndex) {
    const value = values[index];
    if (value !== undefined) return value;
    if (previewScores && activeIndex === index && !isUsed[index]) {
      return previewScores[category];
    }
    return "";
  }

  function handleClick(index: PlayerIndex) {
    if (!onChoose) return;
    if (activeIndex === undefined) return;
    if (activeIndex !== index) return;
    if (!isCurrentPlayer) return;
    if (isUsed[index]) return;

    // Get the score value for sound feedback
    const scoreValue = previewScores ? previewScores[category] : 0;

    // Play appropriate sound based on category and score
    if (category === 'yahtzee' && scoreValue === 50) {
      soundManager.kniffelSound(); // Special Kniffel celebration
      // Screen shake for Kniffel!
      setScreenShake(true);
      setTimeout(() => setScreenShake(false), 500);
    } else if (scoreValue >= 40) {
      soundManager.levelUpSound(); // For very high scores
    } else if (scoreValue >= 25) {
      soundManager.scoreEntryBig(); // For good scores
    } else if (scoreValue > 0) {
      soundManager.scoreEntry(); // Normal score entry
    } else {
      soundManager.errorSound(); // For zero scores (scratching)
    }

    // Trigger animation
    setAnimatingCell(index);
    setTimeout(() => setAnimatingCell(null), 500);

    onChoose(category);
  }

  return (
    <tr className={`score-row ${screenShake ? 'screen-shake' : ''}`}>
      <td className="category-name" title={CATEGORY_DESCRIPTIONS[category]}>
        <span>{CATEGORY_LABELS[category]}</span>
        <span className="category-hint">{CATEGORY_DESCRIPTIONS[category]}</span>
      </td>
      {[0, 1].map((column) => {
        const columnIndex = column as PlayerIndex;
        const clickable =
          !!onChoose &&
          activeIndex !== undefined &&
          activeIndex === columnIndex &&
          !isUsed[columnIndex] &&
          isCurrentPlayer;
        const classes = ["score-cell"];
        if (activeIndex === columnIndex) classes.push("current-player");
        if (isUsed[columnIndex]) classes.push("cell-used");
        if (clickable) classes.push("cell-clickable");

        const cellValue = renderCell(columnIndex);
        const isPreview = previewScores && activeIndex === columnIndex && !isUsed[columnIndex] && cellValue === previewScores[category];

        return (
          <td
            key={columnIndex}
            className={`${classes.join(" ")} ${animatingCell === columnIndex ? 'score-entry-animation' : ''}`}
            onClick={() => handleClick(columnIndex)}
            onMouseEnter={() => clickable && soundManager.buttonHover()}
            role={clickable ? "button" : undefined}
            aria-label={clickable ? `${CATEGORY_LABELS[category]} auswählen für ${cellValue} Punkte` : undefined}
            tabIndex={clickable ? 0 : undefined}
          >
            <span className={isPreview ? "preview-score" : ""}>{cellValue}</span>
          </td>
        );
      })}
    </tr>
  );
}
