import type { Category, HistoryEntry } from "../types/shared";

type Props = {
  entry: HistoryEntry;
  onClose: () => void;
};

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

const UPPER: Category[] = ["ones", "twos", "threes", "fours", "fives", "sixes"];
const LOWER: Category[] = ["threeKind", "fourKind", "fullHouse", "smallStraight", "largeStraight", "yahtzee", "chance"];

const formatter = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
});

export default function HistoryDetail({ entry, onClose }: Props) {
  const playerCount = Math.max(
    entry.playerNames.length,
    entry.scores.length,
    entry.scoreSheets.length,
    2
  );
  const playerNames = Array.from({ length: playerCount }, (_, index) => (
    entry.playerNames[index]?.trim() || `Spieler ${index + 1}`
  ));
  const sheets = Array.from({ length: playerCount }, (_, index) => (
    entry.scoreSheets[index] ?? {}
  )) as Array<Partial<Record<Category, number>>>;
  const upperTotals = sheets.map((sheet) =>
    UPPER.reduce((sum, category) => sum + (sheet[category] ?? 0), 0)
  );
  const lowerTotals = sheets.map((sheet) =>
    LOWER.reduce((sum, category) => sum + (sheet[category] ?? 0), 0)
  );
  const bonuses = upperTotals.map((value) => (value >= 63 ? 35 : 0));
  const computedTotals = sheets.map((_, index) =>
    upperTotals[index] + bonuses[index] + lowerTotals[index]
  );
  const safeScores = Array.from({ length: playerCount }, (_, index) =>
    entry.scores[index] ?? computedTotals[index] ?? 0
  );
  const winnerName = entry.winner?.trim() ?? "";
  const winnerMatches = (name: string) =>
    winnerName.length > 0 && winnerName !== "Draw" && name.localeCompare(winnerName, undefined, { sensitivity: "accent" }) === 0;

  return (
    <div className="history-overlay">
      <div className="history-detail-dialog">
        <header className="history-detail-header">
          <div>
            <h2>Spieldetails</h2>
            <p className="history-detail-date">
              {formatter.format(new Date(entry.finishedAt))}
            </p>
          </div>
          <button className="btn btn-primary" onClick={onClose}>
            ← Zurück
          </button>
        </header>

        <div className="history-detail-body">
          <div className="history-detail-summary">
            <div className="history-detail-players" data-player-count={playerCount}>
              {playerNames.map((name, index) => (
                <div
                  key={name + index}
                  className={`player-summary ${winnerMatches(name) ? "winner" : ""}`}
                >
                  <h3>{name}</h3>
                  <div className="final-score">{safeScores[index]}</div>
                  {winnerMatches(name) && <div className="winner-badge">🏆 Gewinner</div>}
                </div>
              ))}
              {winnerName === "Draw" && (
                <div className="draw-indicator">Unentschieden</div>
              )}
            </div>
          </div>

          <div className="history-detail-scoreboard">
            <div className="scoreboard-wrapper" data-player-count={playerCount}>
              <table className="scoreboard-table">
                <thead>
                  <tr>
                    <th>Kategorie</th>
                    {playerNames.map((name, index) => (
                      <th key={name + index}>{name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="section-row">
                    <td colSpan={1 + playerCount}>Oberer Bereich</td>
                  </tr>
                  {UPPER.map((category) => (
                    <tr key={category} className="score-row">
                      <td className="category-name">{CATEGORY_LABELS[category]}</td>
                      {sheets.map((sheet, index) => (
                        <td key={index} className="score-cell">
                          {sheet[category] ?? "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr className="total-row">
                    <td>Zwischensumme</td>
                    {upperTotals.map((value, index) => (
                      <td key={index}>{value}</td>
                    ))}
                  </tr>
                  <tr className="bonus-row">
                    <td>Bonus (≥63)</td>
                    {bonuses.map((value, index) => (
                      <td key={index}>{value}</td>
                    ))}
                  </tr>
                  <tr className="section-row">
                    <td colSpan={1 + playerCount}>Unterer Bereich</td>
                  </tr>
                  {LOWER.map((category) => (
                    <tr key={category} className="score-row">
                      <td className="category-name">{CATEGORY_LABELS[category]}</td>
                      {sheets.map((sheet, index) => (
                        <td key={index} className="score-cell">
                          {sheet[category] ?? "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr className="final-total-row">
                    <td>
                      <strong>Gesamtsumme</strong>
                    </td>
                    {safeScores.map((score, index) => (
                      <td key={index}>
                        <strong>{score}</strong>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
