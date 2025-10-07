import { useMemo, useState } from "react";
import type { HistoryEntry } from "../types/shared";
import HistoryDetail from "./HistoryDetail";

type Props = {
  history: HistoryEntry[];
  onClose: () => void;
  onRefresh: () => void;
};

const formatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

export default function HistoryPanel({ history, onClose, onRefresh }: Props) {
  const [selectedEntry, setSelectedEntry] = useState<HistoryEntry | null>(null);

  const sortedHistory = useMemo(
    () => [...history].sort((a, b) => b.finishedAt - a.finishedAt),
    [history]
  );

  if (selectedEntry) {
    return (
      <HistoryDetail
        entry={selectedEntry}
        onClose={() => setSelectedEntry(null)}
      />
    );
  }

  return (
    <div className="history-overlay">
      <div className="history-dialog">
        <header className="history-header">
          <h2>📊 Spielverlauf</h2>
          <div className="history-actions">
            <button className="btn btn-outline" onClick={onRefresh}>
              🔄 Aktualisieren
            </button>
            <button className="btn btn-primary" onClick={onClose}>
              ✕ Schließen
            </button>
          </div>
        </header>
        <div className="history-body">
          {sortedHistory.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">🎲</div>
              <p>Noch keine Spiele aufgezeichnet.</p>
              <span className="empty-hint">Spiele dein erstes Spiel, um es hier zu sehen!</span>
            </div>
          )}
          <ul className="history-list">
            {sortedHistory.map((entry) => (
              <li
                key={entry.id}
                className="history-item clickable-history-item"
                onClick={() => setSelectedEntry(entry)}
              >
                <div className="history-meta">
                  <span className="history-date">
                    {formatter.format(new Date(entry.finishedAt))}
                  </span>
                  <span className="history-winner">
                    Gewinner: {entry.winner}
                  </span>
                </div>
                <div className="history-names">
                  {entry.playerNames[0]} ({entry.scores[0]}) vs. {entry.playerNames[1]} ({entry.scores[1]})
                </div>
                <div className="history-hint">
                  Klicken für Details →
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
