import { useEffect, useMemo, useRef, useState } from "react";
import { soundManager } from "../../../lib/sounds";
import type { Category, GameState } from "@kniffel/game";
import { CurrentPlayerIndicator } from "../../components/game/CurrentPlayerIndicator";
import { DiceArea } from "../../components/game/DiceArea";
import { Scoreboard } from "../../components/game/Scoreboard";

// Layout note: Root-Cause: shell <main> stretched to full viewport height without bottom padding, letting Scoreboard sit flush. Fix: add safe-area-aware padding on <main>; keep local layout gap-only.

export type PlayerStatus = { connected: boolean; ready: boolean };

// Represents the primary in-game experience for the autumn theme and
// orchestrates player interaction, dice control, and scoreboard display.

type GameViewProps = {
    state: GameState;
    /** null for spectators */
    playerIndex: number | null;
    playerNames: string[];
    isCurrentPlayer: boolean;
    isRolling: boolean;
    previewScores: Record<Category, number> | null;
    onRoll: () => void;
    onToggleHold: (index: number) => void;
    onChooseCategory: (category: Category) => void;
    onReset: () => void;
    onOpenHistory: () => void;
    soundEnabled: boolean;
    onToggleSound: (enabled: boolean) => void;
};

export function GameView({
    state,
    playerIndex,
    playerNames,
    isCurrentPlayer,
    isRolling,
    previewScores,
    onRoll,
    onToggleHold,
    onChooseCategory,
    onReset,
    onOpenHistory,
    soundEnabled,
    onToggleSound,
}: GameViewProps) {
    const rollsLeft = state.rollsLeft;
    // Optimistic hold state until the server's answer arrives; every new server state wins.
    const [localHeld, setLocalHeld] = useState<boolean[] | null>(null);

    useEffect(() => {
        setLocalHeld(null);
    }, [state]);

    const effectiveHeld = useMemo(() => {
        if (localHeld && localHeld.length === state.held.length) {
            return localHeld;
        }
        return state.held;
    }, [localHeld, state.held]);

    const toggleDieRef = useRef<(index: number) => void>(() => {});

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.ctrlKey || event.metaKey || event.altKey) return;
            const target = event.target as HTMLElement | null;
            if (target?.closest("input, textarea, select, [contenteditable=true]")) return;
            if (document.querySelector("[role=dialog], [role=alertdialog], [role=menu]")) return;
            const onControl = Boolean(target?.closest("button, a, [role=button], [role=menuitem]"));

            switch (event.key.toLowerCase()) {
                case " ":
                case "enter":
                    if (onControl || !isCurrentPlayer) return;
                    event.preventDefault();
                    if (rollsLeft > 0 && !isRolling) {
                        soundManager.diceRoll();
                        onRoll();
                    }
                    break;
                case "1":
                case "2":
                case "3":
                case "4":
                case "5":
                    if (!isCurrentPlayer || rollsLeft === 3) return;
                    event.preventDefault();
                    toggleDieRef.current(Number(event.key) - 1);
                    break;
                case "h":
                    event.preventDefault();
                    onOpenHistory();
                    break;
                case "m":
                    event.preventDefault();
                    {
                        const enabled = soundManager.toggleSound();
                        onToggleSound(enabled);
                        if (enabled) {
                            soundManager.buttonClick();
                        }
                    }
                    break;
                default:
                    break;
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [isCurrentPlayer, rollsLeft, isRolling, onRoll, onOpenHistory, onToggleSound]);

    const toggleDie = (index: number) => {
        if (rollsLeft === 3 || index < 0 || index >= state.held.length) return;
        setLocalHeld((previous) => {
            const base = previous && previous.length === state.held.length ? [...previous] : [...state.held];
            base[index] = !base[index];
            return base;
        });
        const wasHeld = effectiveHeld[index];
        if (wasHeld) {
            soundManager.diceRelease();
        } else {
            soundManager.diceHold();
        }
        onToggleHold(index);
    };
    toggleDieRef.current = toggleDie;

    return (
        <div className="flex w-full flex-col items-center gap-6 px-4 pb-10">

            <CurrentPlayerIndicator
                playerName={playerNames[state.currentPlayer] || `Spieler ${state.currentPlayer + 1}`}
                rollsLeft={rollsLeft}
                isLocalTurn={isCurrentPlayer}
            />

            <DiceArea
                dice={state.dice}
                heldDice={effectiveHeld}
                rollsLeft={rollsLeft}
                canRoll={rollsLeft > 0}
                isCurrentPlayer={isCurrentPlayer}
                isRolling={isRolling}
                onRoll={() => {
                    if (!isCurrentPlayer || isRolling || rollsLeft === 0) return;
                    soundManager.diceRoll();
                    onRoll();
                }}
                onToggleHeld={toggleDie}
                onShowHistory={onOpenHistory}
                onReset={() => {
                    soundManager.satisfyingClick();
                    if (window.confirm("Möchtest du wirklich das Spiel zurücksetzen? Der aktuelle Fortschritt geht verloren.")) {
                        onReset();
                    }
                }}
                soundEnabled={soundEnabled}
                onToggleSound={() => {
                    const enabled = soundManager.toggleSound();
                    onToggleSound(enabled);
                    if (enabled) {
                        soundManager.buttonClick();
                    }
                }}
            />
            <Scoreboard
                scoreSheets={state.scoreSheets}
                playerNames={playerNames}
                currentPlayerIndex={state.currentPlayer}
                localPlayerIndex={playerIndex}
                previewScores={previewScores ?? undefined}
                canScore={isCurrentPlayer && rollsLeft < 3}
                onCategoryClick={(category) => {
                    soundManager.categorySelect();
                    onChooseCategory(category);
                }}
            />
        </div>
    );
}
