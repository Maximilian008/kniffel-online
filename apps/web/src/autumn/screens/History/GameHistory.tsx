import { Calendar, ChevronDown, ChevronUp, RefreshCw, Trophy } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import type { Category } from "../../../types/shared";
import { Button } from "../../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../ui/dialog";
import { ScrollArea } from "../../ui/scroll-area";

type PlayerScoreMap = Record<Category, number | null>;

type HistoryPlayer = {
    name: string;
    scores: PlayerScoreMap;
    total: number;
};

type HistoryGame = {
    id: string;
    date: string;
    players: HistoryPlayer[];
    winner: string;
    winnerScore: number;
};

type GameHistoryProps = {
    isOpen: boolean;
    onClose: () => void;
    history: HistoryGame[];
    onRefresh?: () => void;
    isLoading?: boolean;
};

const UPPER: Array<{ key: Category; label: string }> = [
    { key: "ones", label: "Einser" },
    { key: "twos", label: "Zweier" },
    { key: "threes", label: "Dreier" },
    { key: "fours", label: "Vierer" },
    { key: "fives", label: "Fünfer" },
    { key: "sixes", label: "Sechser" },
];

const LOWER: Array<{ key: Category; label: string }> = [
    { key: "threeKind", label: "Dreier Pasch" },
    { key: "fourKind", label: "Vierer Pasch" },
    { key: "fullHouse", label: "Full House" },
    { key: "smallStraight", label: "Kleine Straße" },
    { key: "largeStraight", label: "Große Straße" },
    { key: "yahtzee", label: "Kniffel" },
    { key: "chance", label: "Chance" },
];

function upperSubtotal(scores: PlayerScoreMap) {
    return UPPER.reduce((total, category) => total + (scores[category.key] ?? 0), 0);
}

function bonus(scores: PlayerScoreMap) {
    return upperSubtotal(scores) >= 63 ? 35 : 0;
}

export function GameHistory({ isOpen, onClose, history, onRefresh, isLoading }: GameHistoryProps) {
    const [expandedGameId, setExpandedGameId] = useState<string | null>(null);

    const toggleExpanded = (gameId: string) => {
        setExpandedGameId((previous) => (previous === gameId ? null : gameId));
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-h-[85vh] max-w-4xl border-2 border-orange-500/30 bg-gradient-to-br from-[#e8dcc8] to-[#d4c5a9] shadow-[0_0_30px_rgba(249,115,22,0.3)]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-orange-900">
                        <Trophy className="h-5 w-5 text-orange-600" /> Spielhistorie
                    </DialogTitle>
                    <DialogDescription className="text-orange-900/70">
                        Ergebnisse vergangener Partien
                    </DialogDescription>
                </DialogHeader>

                <div className="flex items-center justify-end gap-2 pt-2">
                    {onRefresh && (
                        <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={onRefresh}
                            className="bg-white/60 hover:bg-white"
                            style={{ color: "var(--autumn-button-text, #b9481f)" }}
                            disabled={isLoading}
                        >
                            <RefreshCw className="mr-2 h-4 w-4" /> Aktualisieren
                        </Button>
                    )}
                </div>

                <ScrollArea className="h-[calc(85vh-140px)] pr-2">
                    <div className="space-y-3">
                        {isLoading && (
                            <div className="rounded-lg border border-orange-800/20 bg-white/70 px-4 py-6 text-center text-orange-900/70">
                                Lädt Spielverlauf...
                            </div>
                        )}
                        {!isLoading && history.length === 0 && (
                            <div className="rounded-lg border border-dashed border-orange-800/30 bg-orange-100/40 px-4 py-12 text-center text-orange-900/70">
                                Noch keine Partien. Spiele dein erstes Spiel, um hier Ergebnisse zu sehen!
                            </div>
                        )}
                        {!isLoading && history.map((game) => {
                            const isExpanded = expandedGameId === game.id;
                            return (
                                <div
                                    key={game.id}
                                    className="overflow-hidden rounded-lg border border-orange-800/20 bg-white/60 shadow-sm"
                                >
                                    <button
                                        type="button"
                                        onClick={() => toggleExpanded(game.id)}
                                        className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left text-orange-900 transition-colors hover:bg-white/70"
                                    >
                                        <div className="flex flex-1 flex-col gap-1 sm:flex-row sm:items-center">
                                            <div className="flex items-center gap-2 text-sm text-orange-900/70">
                                                <Calendar className="h-4 w-4" />
                                                <span>{game.date}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-sm sm:ml-6">
                                                <Trophy className="h-4 w-4 text-amber-600" />
                                                <span>
                                                    {game.winner} gewann mit <span className="font-semibold text-orange-700">{game.winnerScore}</span> Punkten
                                                </span>
                                            </div>
                                        </div>
                                        {isExpanded ? (
                                            <ChevronUp className="h-5 w-5 text-orange-900" />
                                        ) : (
                                            <ChevronDown className="h-5 w-5 text-orange-900" />
                                        )}
                                    </button>

                                    <AnimatePresence>
                                        {isExpanded && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: "auto", opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ duration: 0.25 }}
                                                className="overflow-hidden border-t border-orange-800/20"
                                            >
                                                <div className="px-4 py-3">
                                                    <div className="overflow-x-auto rounded-lg bg-white/70">
                                                        <table className="w-full border-collapse text-sm text-orange-900">
                                                            <thead>
                                                                <tr className="border-b-2 border-orange-600/40 bg-gradient-to-r from-[#c9a87c] to-[#b89968]">
                                                                    <th className="p-2 text-left">Kategorie</th>
                                                                    {game.players.map((player, index) => (
                                                                        <th key={index} className="p-2 text-center">
                                                                            {player.name}
                                                                            {player.name === game.winner && (
                                                                                <Trophy className="ml-1 inline-block h-3 w-3 text-amber-600" />
                                                                            )}
                                                                        </th>
                                                                    ))}
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                <tr className="bg-orange-700/20 text-xs uppercase tracking-wider">
                                                                    <td className="p-2" colSpan={game.players.length + 1}>
                                                                        Oberer Bereich
                                                                    </td>
                                                                </tr>
                                                                {UPPER.map((category) => (
                                                                    <tr key={category.key} className="border-b border-orange-800/10">
                                                                        <td className="p-2">{category.label}</td>
                                                                        {game.players.map((player, index) => (
                                                                            <td key={index} className="p-2 text-center">
                                                                                {player.scores[category.key] ?? "-"}
                                                                            </td>
                                                                        ))}
                                                                    </tr>
                                                                ))}
                                                                <tr className="bg-[#c9a87c]/40">
                                                                    <td className="p-2">Zwischensumme</td>
                                                                    {game.players.map((player, index) => (
                                                                        <td key={index} className="p-2 text-center">
                                                                            {upperSubtotal(player.scores)}
                                                                        </td>
                                                                    ))}
                                                                </tr>
                                                                <tr className="bg-[#c9a87c]/40 border-b border-orange-800/20">
                                                                    <td className="p-2">Bonus (≥63)</td>
                                                                    {game.players.map((player, index) => (
                                                                        <td key={index} className="p-2 text-center">
                                                                            {bonus(player.scores) || "-"}
                                                                        </td>
                                                                    ))}
                                                                </tr>
                                                                <tr className="bg-orange-700/20 text-xs uppercase tracking-wider">
                                                                    <td className="p-2" colSpan={game.players.length + 1}>
                                                                        Unterer Bereich
                                                                    </td>
                                                                </tr>
                                                                {LOWER.map((category) => (
                                                                    <tr key={category.key} className="border-b border-orange-800/10">
                                                                        <td className="p-2">{category.label}</td>
                                                                        {game.players.map((player, index) => (
                                                                            <td key={index} className="p-2 text-center">
                                                                                {player.scores[category.key] ?? "-"}
                                                                            </td>
                                                                        ))}
                                                                    </tr>
                                                                ))}
                                                                <tr className="bg-gradient-to-r from-orange-700/30 to-amber-700/30">
                                                                    <td className="p-2 font-semibold">Gesamt</td>
                                                                    {game.players.map((player, index) => (
                                                                        <td key={index} className="p-2 text-center font-semibold">
                                                                            {player.total}
                                                                        </td>
                                                                    ))}
                                                                </tr>
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            );
                        })}
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}
