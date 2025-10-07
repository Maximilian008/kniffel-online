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
  const sheets = entry.scoreSheets as [
    Partial<Record<Category, number>>,
    Partial<Record<Category, number>>
  ];

  const upperTotals = sheets.map((sheet) =>
    UPPER.reduce((sum, category) => sum + (sheet[category] ?? 0), 0)
  );
  const bonuses = upperTotals.map((value) => (value >= 63 ? 35 : 0));

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
            <div className="history-detail-players">
              <div className={`player-summary ${entry.winner === entry.playerNames[0] ? 'winner' : ''}`}>
                <h3>{entry.playerNames[0]}</h3>
                <div className="final-score">{entry.scores[0]}</div>
                {entry.winner === entry.playerNames[0] && <div className="winner-badge">🏆 Gewinner</div>}
              </div>
              <div className="vs">VS</div>
              <div className={`player-summary ${entry.winner === entry.playerNames[1] ? 'winner' : ''}`}>
                <h3>{entry.playerNames[1]}</h3>
                <div className="final-score">{entry.scores[1]}</div>
                {entry.winner === entry.playerNames[1] && <div className="winner-badge">🏆 Gewinner</div>}
              </div>
            </div>
          </div>

          <div className="history-detail-scoreboard">
            <table className="scoreboard-table">
              <thead>
                <tr>
                  <th>Kategorie</th>
                  <th>{entry.playerNames[0]}</th>
                  <th>{entry.playerNames[1]}</th>
                </tr>
              </thead>
              <tbody>
                <tr className="section-row">
                  <td colSpan={3}>Oberer Bereich</td>
                </tr>
                {UPPER.map((category) => (
                  <tr key={category} className="score-row">
                    <td className="category-name">{CATEGORY_LABELS[category]}</td>
                    <td className="score-cell">
                      {sheets[0][category] ?? "—"}
                    </td>
                    <td className="score-cell">
                      {sheets[1][category] ?? "—"}
                    </td>
                  </tr>
                ))}
                <tr className="total-row">
                  <td>Zwischensumme</td>
                  <td>{upperTotals[0]}</td>
                  <td>{upperTotals[1]}</td>
                </tr>
                <tr className="bonus-row">
                  <td>Bonus (≥63)</td>
                  <td>{bonuses[0]}</td>
                  <td>{bonuses[1]}</td>
                </tr>
                <tr className="section-row">
                  <td colSpan={3}>Unterer Bereich</td>
                </tr>
                {LOWER.map((category) => (
                  <tr key={category} className="score-row">
                    <td className="category-name">{CATEGORY_LABELS[category]}</td>
                    <td className="score-cell">
                      {sheets[0][category] ?? "—"}
                    </td>
                    <td className="score-cell">
                      {sheets[1][category] ?? "—"}
                    </td>
                  </tr>
                ))}
                <tr className="final-total-row">
                  <td><strong>Gesamtsumme</strong></td>
                  <td><strong>{entry.scores[0]}</strong></td>
                  <td><strong>{entry.scores[1]}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}