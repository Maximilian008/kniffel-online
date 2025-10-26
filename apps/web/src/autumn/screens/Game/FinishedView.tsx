import { Trophy } from "lucide-react";
import type { SerializedGameState } from "../../../types/shared";
import { Scoreboard } from "../../components/game/Scoreboard";
import { Button } from "../../ui/button";

type FinishedViewProps = {
    state: SerializedGameState;
    playerNames: string[];
    scores: number[];
    winner: string;
    onReset: () => void;
    onOpenHistory: () => void;
};

export function FinishedView({ state, playerNames, scores, winner, onReset, onOpenHistory }: FinishedViewProps) {
    const winnerText = winner === "Draw" ? "Unentschieden" : `${winner} gewinnt!`;
    const bestScore = Math.max(...scores);

    return (
        <div className="flex w-full flex-col items-center gap-8 px-4 pb-12 text-amber-100">
            <div className="flex flex-col items-center gap-3 text-center">
                <Trophy className="h-12 w-12 text-amber-200" />
                <h2 className="text-3xl font-semibold text-amber-200 drop-shadow-[0_4px_12px_rgba(255,200,100,0.4)]">
                    {winnerText}
                </h2>
                <p className="text-amber-100/70">Endstand: {bestScore} Punkte</p>
            </div>

            <Scoreboard
                scoreSheets={state.scoreSheets}
                playerNames={playerNames}
                currentPlayerIndex={state.currentPlayer}
                localPlayerIndex={null}
                canScore={false}
            />

            <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                    type="button"
                    onClick={onReset}
                    className="bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-[0_0_20px_rgba(249,115,22,0.5)] hover:from-orange-600 hover:to-amber-600"
                >
                    🔄 Neues Spiel starten
                </Button>
                <Button
                    type="button"
                    variant="secondary"
                    onClick={onOpenHistory}
                    className="bg-white/70 text-orange-900 hover:bg-white"
                >
                    📊 Verlauf ansehen
                </Button>
            </div>
        </div>
    );
}
