import type {
  Category,
  PlayerIndex,
  SerializedGameState,
} from "../types/shared";
import { useEffect } from "react";
import { soundManager } from "../lib/sounds";
import DiceAnimation from "./DiceAnimation3D";
import Dice from "./DiceSimple";
import Scoreboard from "./Scoreboard";
import SoundToggle from "./SoundToggle";

type Props = {
  state: SerializedGameState;
  playerIndex: PlayerIndex;
  names: [string, string];
  isCurrentPlayer: boolean;
  isRolling: boolean;
  previewScores: Record<Category, number> | null;
  onRoll: () => void;
  onToggleHold: (index: number) => void;
  onChooseCategory: (category: Category) => void;
  onReset: () => void;
  onOpenHistory: () => void;
  opponentConnected: boolean;
};

export default function GameScreen({
  state,
  playerIndex,
  names,
  isCurrentPlayer,
  isRolling,
  previewScores,
  onRoll,
  onToggleHold,
  onChooseCategory,
  onReset,
  onOpenHistory,
  opponentConnected
}: Props) {
  const rollsLeft = state.rollsLeft;
  const readyToRoll = isCurrentPlayer && rollsLeft >= 0 && !isRolling;

  // Keyboard shortcuts
  useEffect(() => {
    if (!isCurrentPlayer) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Prevent shortcuts when typing in inputs
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (event.key.toLowerCase()) {
        case ' ':
        case 'enter':
          event.preventDefault();
          if (readyToRoll && rollsLeft > 0) {
            onRoll();
          }
          break;
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
          event.preventDefault();
          const diceIndex = parseInt(event.key) - 1;
          if (diceIndex >= 0 && diceIndex < 5) {
            onToggleHold(diceIndex);
          }
          break;
        case 'h':
          event.preventDefault();
          onOpenHistory();
          break;
        case 'r':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            if (confirm('Möchtest du wirklich das Spiel zurücksetzen? Der aktuelle Fortschritt geht verloren.')) {
              onReset();
            }
          }
          break;
        case 'm':
          event.preventDefault();
          const nextEnabled = soundManager.toggleSound();
          if (nextEnabled) {
            soundManager.buttonClick();
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isCurrentPlayer, readyToRoll, rollsLeft, onRoll, onToggleHold, onOpenHistory, onReset]);
  const opponentIndex: PlayerIndex = playerIndex === 0 ? 1 : 0;
  const localName = names[playerIndex] || (playerIndex === 0 ? "Player 1" : "Player 2");
  const opponentName = names[opponentIndex] || (opponentIndex === 0 ? "Player 1" : "Player 2");

  // Status message not needed in header anymore

  return (
    <div className="panel game-screen">
      <header className="game-header">
        <div className={`player-tag self ${isCurrentPlayer ? 'active' : ''}`}>
          <span className="label">Du</span>
          <strong>{localName}</strong>
          {isCurrentPlayer && <span className="turn-indicator">🎯 Dein Zug</span>}
        </div>
        <div className="game-status">
          <div className="status-content">
            <p className="status-message">{getGermanStatusMessage({
              isCurrentPlayer,
              opponentConnected,
              rollsLeft,
              phase: state.phase,
              names,
              currentPlayer: state.currentPlayer,
            })}</p>
            <div className="turn-info">
              <span className="rolls-remaining">
                Würfe übrig: <strong>{rollsLeft}</strong>
              </span>
            </div>
          </div>
          <div className={`connection-status ${opponentConnected ? "online" : "offline"}`}>
            <span className="connection-dot"></span>
            <span className="connection-text">
              {opponentConnected ? "Gegner online" : "Gegner offline"}
            </span>
          </div>
        </div>
        <div className={`player-tag opponent ${!isCurrentPlayer ? 'active' : ''}`}>
          <span className="label">Gegner</span>
          <strong>{opponentName}</strong>
          {!isCurrentPlayer && <span className="turn-indicator">🎯 Gegner am Zug</span>}
        </div>
      </header>

      <section className="dice-section">
        <div className="dice-gameplay-area">
          <div className="dice-animation-sidebar">
            <DiceAnimation
              diceValues={state.dice as [number, number, number, number, number]}
              isRolling={isRolling}
              onAnimationComplete={() => { }}
            />
          </div>
          <div className="dice-main-area">
            <div className="dice-row">
              {state.dice.map((value, index) => (
                <Dice
                  key={index}
                  value={value}
                  held={state.held[index]}
                  isRolling={isRolling && !state.held[index]}
                  onToggle={() => onToggleHold(index)}
                  disabled={!isCurrentPlayer}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="controls">
          {readyToRoll && rollsLeft > 0 ? (
            <button
              className="btn btn-primary roll-button"
              onClick={() => {
                soundManager.diceRoll();
                onRoll();
              }}
              onMouseEnter={() => !isCurrentPlayer ? null : soundManager.buttonHover()}
              disabled={!isCurrentPlayer}
            >
              🎲 Würfeln ({rollsLeft} übrig)
            </button>
          ) : (
            <div className="roll-status">
              {rollsLeft === 0 ? (
                <span className="status-text">✅ Wähle eine Kategorie aus</span>
              ) : (
                <span className="status-text">⏳ Warte auf deinen Zug</span>
              )}
            </div>
          )}
          <div className="secondary-controls">
            <button
              className="btn btn-outline"
              onClick={() => {
                soundManager.satisfyingClick();
                if (confirm('Möchtest du wirklich das Spiel zurücksetzen? Der aktuelle Fortschritt geht verloren.')) {
                  onReset();
                }
              }}
              onMouseEnter={() => soundManager.buttonHover()}
              title="Spiel zurücksetzen (Strg+R)"
            >
              🔄 Zurücksetzen
            </button>
            <button
              className="btn btn-outline"
              onClick={() => {
                soundManager.satisfyingClick();
                onOpenHistory();
              }}
              onMouseEnter={() => soundManager.buttonHover()}
              title="Spielverlauf anzeigen (H)"
            >
              📊 Verlauf
            </button>
            <SoundToggle />
          </div>
          {isCurrentPlayer && (
            <div className="keyboard-hints">
              <details className="keyboard-help">
                <summary>⌨️ Tastaturkürzel</summary>
                <div className="keyboard-shortcuts">
                  <div className="shortcut-group">
                    <span className="shortcut-key">Leertaste/Enter</span>
                    <span className="shortcut-desc">Würfeln</span>
                  </div>
                  <div className="shortcut-group">
                    <span className="shortcut-key">1-5</span>
                    <span className="shortcut-desc">Würfel festhalten/lösen</span>
                  </div>
                  <div className="shortcut-group">
                    <span className="shortcut-key">H</span>
                    <span className="shortcut-desc">Historie öffnen</span>
                  </div>
                  <div className="shortcut-group">
                    <span className="shortcut-key">Strg+R</span>
                    <span className="shortcut-desc">Spiel zurücksetzen</span>
                  </div>
                </div>
              </details>
            </div>
          )}
        </div>
      </section>

      <Scoreboard
        state={state}
        playerNameA={names[0] || "Player 1"}
        playerNameB={names[1] || "Player 2"}
        activeIndex={playerIndex}
        isCurrentPlayer={isCurrentPlayer}
        previewScores={previewScores}
        onChoose={isCurrentPlayer ? onChooseCategory : undefined}
      />
    </div>
  );
}

type StatusArgs = {
  isCurrentPlayer: boolean;
  opponentConnected: boolean;
  rollsLeft: number;
  phase: SerializedGameState["phase"];
  names: [string, string];
  currentPlayer: 1 | 2;
};

function getGermanStatusMessage(args: StatusArgs) {
  if (!args.opponentConnected) {
    return "Warte auf Wiedereintritt des Gegners.";
  }
  if (args.phase !== "playing") {
    return "Bereite das Spiel vor...";
  }
  if (args.isCurrentPlayer) {
    return `Du bist dran. ${args.rollsLeft} Wurf${args.rollsLeft === 1 ? "" : "e"} übrig.`;
  }
  const index = args.currentPlayer - 1;
  const fallback = index === 0 ? "Spieler 1" : "Spieler 2";
  const name = args.names[index] || fallback;
  return `${name} ist am Zug.`;
}









