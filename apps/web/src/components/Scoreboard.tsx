import { useEffect, useMemo, useRef, useState } from "react";
import { soundManager } from "../lib/sounds";
import type {
  Category,
  PlayerIndex,
  SerializedGameState,
} from "../types/shared";

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
  playerNames: string[];
  activeIndex?: PlayerIndex;
  isCurrentPlayer: boolean;
  previewScores: Record<Category, number> | null;
  onChoose?: (category: Category) => void;
};

export default function Scoreboard({
  state,
  playerNames,
  activeIndex,
  isCurrentPlayer,
  previewScores,
  onChoose,
}: Props) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const n = Math.max(state.scoreSheets.length, playerNames.length);
  const usedSets = useMemo(() => state.usedCategories.map((list: Category[]) => new Set(list)), [state.usedCategories]) as Array<Set<Category>>;
  const sheets = state.scoreSheets as Array<Partial<Record<Category, number>>>;

  const upperTotals = sheets.map((sheet) =>
    UPPER.reduce((sum, category) => sum + (sheet[category] ?? 0), 0)
  );
  const bonuses = upperTotals.map((value) => (value >= 63 ? 35 : 0));
  const lowerTotals = sheets.map((sheet) =>
    LOWER.reduce((sum, category) => sum + (sheet[category] ?? 0), 0)
  );
  const finalTotals = sheets.map((_, index) => upperTotals[index] + bonuses[index] + lowerTotals[index]);

  // Keep active player's column in view when turn changes (horizontal scroll)
  useEffect(() => {
    const container = wrapperRef.current;
    if (!container) return;
    if (container.scrollWidth <= container.clientWidth + 2) return; // no overflow
    const table = container.querySelector<HTMLTableElement>('table.scoreboard-table');
    if (!table) return;
    // Determine column index we need to show (player index + 1 because column 0 is category)
    const colIndex = typeof state.currentPlayer === 'number' ? state.currentPlayer + 1 : (activeIndex ?? 0) + 1;
    const headerCell = table.tHead?.rows?.[0]?.cells?.[colIndex];
    if (!headerCell) return;
    try {
      headerCell.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' as ScrollLogicalPosition });
    } catch {
      const tr = headerCell.getBoundingClientRect();
      const cr = container.getBoundingClientRect();
      const delta = (tr.left + tr.width / 2) - (cr.left + cr.width / 2);
      container.scrollLeft += delta;
    }
  }, [state.currentPlayer]);

  return (
    <div className="scoreboard-wrapper" ref={wrapperRef}>
      <table className="scoreboard-table">
        <thead>
          <tr>
            <th>Category</th>
            {Array.from({ length: n }).map((_, i) => (
              <th key={i}>{playerNames[i] ?? `Player ${i + 1}`}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="section-row">
            <td colSpan={n + 1}>Upper section</td>
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
              columns={n}
            />
          ))}
          <tr className="summary-row">
            <td>Subtotal</td>
            {Array.from({ length: n }).map((_, i) => (
              <td key={i}>{upperTotals[i] ?? 0}</td>
            ))}
          </tr>
          <tr className="summary-row">
            <td>Bonus (63+)</td>
            {Array.from({ length: n }).map((_, i) => (
              <td key={i}>{bonuses[i] ?? 0}</td>
            ))}
          </tr>
          <tr className="section-row">
            <td colSpan={n + 1}>Lower section</td>
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
              columns={n}
            />
          ))}
          <tr className="summary-row total">
            <td>Total score</td>
            {Array.from({ length: n }).map((_, i) => (
              <td key={i}>{finalTotals[i] ?? 0}</td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

type RowProps = {
  category: Category;
  sheets: Array<Partial<Record<Category, number>>>;
  usedSets: Array<Set<Category>>;
  activeIndex?: PlayerIndex;
  isCurrentPlayer: boolean;
  previewScores: Record<Category, number> | null;
  onChoose?: (category: Category) => void;
  columns: number;
};

function ScoreRow({
  category,
  sheets,
  usedSets,
  activeIndex,
  isCurrentPlayer,
  previewScores,
  onChoose,
  columns,
}: RowProps) {
  const [animatingCell, setAnimatingCell] = useState<PlayerIndex | null>(null);
  const [screenShake, setScreenShake] = useState(false);
  const values = sheets.map((sheet) => sheet[category]);
  const isUsed = usedSets.map((set) => set.has(category));

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
      {Array.from({ length: columns }).map((_, column) => {
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
            onMouseEnter={() => {
              if (!clickable) return;
              // Only play hover on devices with fine pointer (avoid noisy mobile)
              if (window.matchMedia && window.matchMedia('(pointer: fine)').matches) {
                soundManager.buttonHover();
              }
            }}
            role={clickable ? "button" : undefined}
            aria-label={clickable ? `${CATEGORY_LABELS[category]} auswählen für ${cellValue} Punkte` : undefined}
            tabIndex={clickable ? 0 : undefined}
            onKeyDown={(e) => {
              if (!clickable) return;
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleClick(columnIndex);
              }
            }}
          >
            <span className={isPreview ? "preview-score" : ""}>{cellValue}</span>
          </td>
        );
      })}
    </tr>
  );
}
