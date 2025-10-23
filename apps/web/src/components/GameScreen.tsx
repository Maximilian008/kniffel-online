import { useEffect, useMemo, useRef, useState } from "react";
import { soundManager } from "../lib/sounds";
import type {
  Category,
  PlayerIndex,
  SerializedGameState,
} from "../types/shared";
import DiceAnimation from "./DiceAnimation3D";
import Dice from "./DiceSimple";
import Scoreboard from "./Scoreboard";
import SoundToggle from "./SoundToggle";

type Props = {
  state: SerializedGameState;
  playerIndex: PlayerIndex;
  names: string[];
  isCurrentPlayer: boolean;
  isRolling: boolean;
  previewScores: Record<Category, number> | null;
  onRoll: () => void;
  onToggleHold: (index: number) => void;
  onChooseCategory: (category: Category) => void;
  onReset: () => void;
  onOpenHistory: () => void;
  playerStatuses: Array<{ connected: boolean; ready: boolean }>;
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
  playerStatuses
}: Props) {
  const rollsLeft = state.rollsLeft;
  const readyToRoll = isCurrentPlayer && rollsLeft >= 0 && !isRolling;
  // Local optimistic state for held dice to remove lag while waiting for server echo
  const [localHeld, setLocalHeld] = useState<boolean[] | null>(null);
  const lastDiceRef = useRef<string>("");
  const playersListRef = useRef<HTMLDivElement | null>(null);

  // Reset localHeld if dice values change (new roll) or state.held changes externally
  useEffect(() => {
    const diceKey = (state.dice || []).join(",");
    if (diceKey !== lastDiceRef.current) {
      lastDiceRef.current = diceKey;
      setLocalHeld(null);
    }
  }, [state.dice]);

  // Effective held array uses local override when present
  const effectiveHeld = useMemo(() => (
    localHeld && localHeld.length === state.held.length ? localHeld : state.held
  ), [localHeld, state.held]);

  // Auto-scroll header players list to the active player when turn changes
  useEffect(() => {
    const container = playersListRef.current;
    if (!container) return;
    // Only when horizontal overflow exists (mobile/many players)
    if (container.scrollWidth <= container.clientWidth + 2) return;
    const target = container.querySelector<HTMLDivElement>(`.player-tag[data-player-index="${state.currentPlayer}"]`);
    if (!target) return;
    // Smooth center if possible
    try {
      target.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' as ScrollLogicalPosition });
    } catch {
      // Fallback: manual centering
      const tr = target.getBoundingClientRect();
      const cr = container.getBoundingClientRect();
      const delta = (tr.left + tr.width / 2) - (cr.left + cr.width / 2);
      container.scrollLeft += delta;
    }
  }, [state.currentPlayer]);

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
  // Header below shows all players dynamically; no need for derived local/opponent names here

  // Status message not needed in header anymore

  const renderDie = (value: number, index: number) => (
    <Dice
      key={index}
      value={value}
      held={effectiveHeld[index]}
      isRolling={isRolling && !effectiveHeld[index]}
      onToggle={() => {
        setLocalHeld((prev) => {
          const base = (prev && prev.length === state.held.length) ? prev.slice() : state.held.slice();
          base[index] = !base[index];
          return base;
        });
        onToggleHold(index);
      }}
      disabled={!isCurrentPlayer}
    />
  );

  return (
    <div className="panel game-screen">
      <header className="game-header">
        <div ref={playersListRef} className="players-list">
          {names.map((n, i) => {
            const mine = i === playerIndex;
            const active = state.currentPlayer === i;
            const status = playerStatuses[i] ?? { connected: false, ready: false };
            return (
              <div key={i} data-player-index={i} className={`player-tag ${mine ? 'self' : 'opponent'} ${active ? 'active' : ''}`}>
                {mine ? <span className="label">Du</span> : <span className="label">Spieler {i + 1}</span>}
                <strong>{n || `Player ${i + 1}`}</strong>
                <div className="player-substatus">
                  <span
                    className={`conn-dot ${status.connected ? 'online' : 'offline'}`}
                    title={status.connected ? 'Online' : 'Offline'}
                  />
                  {state.phase === 'setup' && (
                    <span className={`ready-badge ${status.ready ? 'ready' : 'not-ready'}`}>
                      {status.ready ? 'Bereit' : 'Nicht bereit'}
                    </span>
                  )}
                </div>
                {active && (
                  <span className="turn-indicator">🎯 {mine ? 'Dein Zug' : 'Am Zug'}</span>
                )}
              </div>
            );
          })}
        </div>
        <div className="game-status">
          <div className="status-content">
            <p className="status-message">{getGermanStatusMessage({
              isCurrentPlayer,
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
            <div className="dice-stack">
              <div className="dice-row dice-row--top">
                {state.dice.slice(0, 2).map((value, index) => renderDie(value, index))}
              </div>
              <div className="dice-row dice-row--bottom">
                {state.dice.slice(2).map((value, index) => renderDie(value, index + 2))}
              </div>
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
              onMouseEnter={() => {
                if (!isCurrentPlayer) return;
                if (window.matchMedia && window.matchMedia('(pointer: fine)').matches) {
                  soundManager.buttonHover();
                }
              }}
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
              onMouseEnter={() => {
                if (window.matchMedia && window.matchMedia('(pointer: fine)').matches) {
                  soundManager.buttonHover();
                }
              }}
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
              onMouseEnter={() => {
                if (window.matchMedia && window.matchMedia('(pointer: fine)').matches) {
                  soundManager.buttonHover();
                }
              }}
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
        playerNames={names}
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
  rollsLeft: number;
  phase: SerializedGameState["phase"];
  names: string[];
  currentPlayer: number;
};

function getGermanStatusMessage(args: StatusArgs) {
  if (args.phase !== "playing") {
    return "Bereite das Spiel vor...";
  }
  if (args.isCurrentPlayer) {
    return `Du bist dran. ${args.rollsLeft} Wurf${args.rollsLeft === 1 ? "" : "e"} übrig.`;
  }
  const index = args.currentPlayer;
  const fallback = `Spieler ${index + 1}`;
  const name = args.names[index] || fallback;
  return `${name} ist am Zug.`;
}









