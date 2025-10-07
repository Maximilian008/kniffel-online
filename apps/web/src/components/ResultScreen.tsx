import type { SerializedGameState } from "@shared/lib";
import Scoreboard from "./Scoreboard";

const DEFAULT_NAMES: [string, string] = ["Player 1", "Player 2"];

type Props = {
  state: SerializedGameState;
  scores: [number, number];
  winner: string;
  onReset: () => void;
  onOpenHistory: () => void;
};

export default function ResultScreen({
  state,
  scores,
  winner,
  onReset,
  onOpenHistory,
}: Props) {
  const names: [string, string] = [
    state.playerNames[0] || DEFAULT_NAMES[0],
    state.playerNames[1] || DEFAULT_NAMES[1],
  ];

  const title = winner === "Draw" ? "🤝 Unentschieden!" : `🎉 ${winner} gewinnt!`;
  const resultMessage = winner === "Draw"
    ? `Beide Spieler haben ${scores[0]} Punkte erreicht!`
    : `${names[0]} erreichte ${scores[0]} Punkte, ${names[1]} erreichte ${scores[1]} Punkte.`;

  return (
    <div className="panel result-screen">
      <header className="screen-header result-header">
        <div className="result-celebration">
          <h2 className="result-title">{title}</h2>
          <p className="result-details">{resultMessage}</p>
        </div>
        <div className="final-scores">
          <div className={`score-card ${scores[0] > scores[1] ? 'winner' : scores[0] === scores[1] ? 'tie' : ''}`}>
            <span className="player-name">{names[0]}</span>
            <span className="final-score">{scores[0]}</span>
          </div>
          <div className="vs-divider">VS</div>
          <div className={`score-card ${scores[1] > scores[0] ? 'winner' : scores[0] === scores[1] ? 'tie' : ''}`}>
            <span className="player-name">{names[1]}</span>
            <span className="final-score">{scores[1]}</span>
          </div>
        </div>
      </header>

      <Scoreboard
        state={state}
        playerNameA={names[0]}
        playerNameB={names[1]}
        activeIndex={undefined}
        isCurrentPlayer={false}
        previewScores={null}
      />

      <div className="result-actions">
        <button className="btn btn-primary result-btn-primary" onClick={onReset}>
          🎮 Nochmal spielen
        </button>
        <button className="btn btn-outline" onClick={onOpenHistory}>
          📊 Spielverlauf anzeigen
        </button>
      </div>
    </div>
  );
}

