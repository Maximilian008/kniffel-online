import { motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { soundManager } from "../../../lib/sounds";
import type { Category, SerializedGameState } from "../../../types/shared";
import { DiceArea } from "../../components/dice/DiceArea";
import { CurrentPlayerIndicator } from "../../components/game/CurrentPlayerIndicator";
import { Scoreboard } from "../../components/game/Scoreboard";

export type PlayerStatus = { connected: boolean; ready: boolean };

// Represents the primary in-game experience for the autumn theme and
// orchestrates player interaction, dice control, and scoreboard display.

type GameViewProps = {
    state: SerializedGameState;
    playerIndex: number;
    playerNames: string[];
    isCurrentPlayer: boolean;
    isRolling: boolean;
    previewScores: Record<Category, number> | null;
    onRoll: () => void;
    onToggleHold: (index: number) => void;
    onChooseCategory: (category: Category) => void;
    onReset: () => void;
    onOpenHistory: () => void;
    playerStatuses: PlayerStatus[];
    soundEnabled: boolean;
    onToggleSound: (enabled: boolean) => void;
};

function getStatusMessage(args: {
    isCurrentPlayer: boolean;
    rollsLeft: number;
    phase: SerializedGameState["phase"];
    names: string[];
    currentPlayer: number;
}) {
    if (args.phase !== "playing") return "Bereite das Spiel vor...";
    if (args.isCurrentPlayer) {
        return `Du bist dran. ${args.rollsLeft} Wurf${args.rollsLeft === 1 ? "" : "e"} übrig.`;
    }
    const name = args.names[args.currentPlayer] || `Spieler ${args.currentPlayer + 1}`;
    return `${name} ist am Zug.`;
}

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
    playerStatuses,
    soundEnabled,
    onToggleSound,
}: GameViewProps) {
    const rollsLeft = state.rollsLeft;
    const [localHeld, setLocalHeld] = useState<boolean[] | null>(null);
    const lastDiceKey = useRef<string>("");
    const playersListRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const key = state.dice.join(",");
        if (key !== lastDiceKey.current) {
            lastDiceKey.current = key;
            setLocalHeld(null);
        }
    }, [state.dice]);

    const effectiveHeld = useMemo(() => {
        if (localHeld && localHeld.length === state.held.length) {
            return localHeld;
        }
        return state.held;
    }, [localHeld, state.held]);

    useEffect(() => {
        const container = playersListRef.current;
        if (!container) return;
        if (container.scrollWidth <= container.clientWidth + 2) return;
        const selector = `.player-chip[data-player-index="${state.currentPlayer}"]`;
        const target = container.querySelector<HTMLDivElement>(selector);
        if (!target) return;
        try {
            target.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
        } catch {
            const tr = target.getBoundingClientRect();
            const cr = container.getBoundingClientRect();
            const delta = tr.left + tr.width / 2 - (cr.left + cr.width / 2);
            container.scrollLeft += delta;
        }
    }, [state.currentPlayer]);

    useEffect(() => {
        if (!isCurrentPlayer) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
                return;
            }

            switch (event.key.toLowerCase()) {
                case " ":
                case "enter":
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
                    event.preventDefault();
                    if (rollsLeft === 3) return;
                    {
                        const index = Number(event.key) - 1;
                        toggleDie(index);
                    }
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

    const statusMessage = getStatusMessage({
        isCurrentPlayer,
        rollsLeft,
        phase: state.phase,
        names: playerNames,
        currentPlayer: state.currentPlayer,
    });

    return (
        <div className="flex w-full flex-col items-center gap-6 px-4 pb-10">
            <section className="w-full rounded-xl border border-white/20 bg-white/10 p-4 backdrop-blur">
                <div ref={playersListRef} className="flex gap-3 overflow-x-auto pb-2">
                    {playerNames.map((name, index) => {
                        const status = playerStatuses[index] ?? { connected: false, ready: false };
                        const isSelf = index === playerIndex;
                        const isActive = index === state.currentPlayer;
                        return (
                            <div
                                key={`${name}-${index}`}
                                data-player-index={index}
                                className={`player-chip flex min-w-[9rem] flex-shrink-0 flex-col gap-1 rounded-lg border border-orange-400/30 px-3 py-2 text-xs text-amber-100 shadow-sm transition-all ${isActive ? "bg-orange-500/40" : "bg-orange-500/10"}
                                    ${isSelf ? "ring-1 ring-white/60" : ""}`}
                            >
                                <div className="flex items-center justify-between text-sm font-semibold text-amber-100">
                                    <span>{isSelf ? "Du" : name || `Spieler ${index + 1}`}</span>
                                    {isActive && <span>🎯</span>}
                                </div>
                                <div className="flex items-center justify-between text-[0.7rem] text-amber-100/70">
                                    <span className={`flex items-center gap-1 ${status.connected ? "text-emerald-200" : "text-amber-200/50"}`}>
                                        <span className={`h-2 w-2 rounded-full ${status.connected ? "bg-emerald-300" : "bg-amber-200/40"}`} />
                                        {status.connected ? "Online" : "Offline"}
                                    </span>
                                    {state.phase === "setup" && <span>{status.ready ? "Bereit" : "Offen"}</span>}
                                </div>
                            </div>
                        );
                    })}
                </div>
                <motion.p
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-2 text-sm text-amber-100/80"
                >
                    {statusMessage}
                </motion.p>
            </section>

            <CurrentPlayerIndicator
                playerName={playerNames[state.currentPlayer] || `Player ${state.currentPlayer + 1}`}
                rollsLeft={rollsLeft}
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
