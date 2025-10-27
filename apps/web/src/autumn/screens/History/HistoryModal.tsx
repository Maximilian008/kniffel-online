import { Calendar, ChevronDown, ChevronUp, RefreshCw, Trophy } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Button } from "../../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../ui/dialog";
import { ScrollArea } from "../../ui/scroll-area";
import type { HistoryGame } from "./history-utils";
import { CompactScoreboard } from "./history-utils";

const buttonTextColor = "#6b3f23";
const buttonSubTextColor = "#85603a";
const winnerAccentColor = "#b45f16";

export type HistoryModalProps = {
    isOpen: boolean;
    onClose: () => void;
    history: HistoryGame[];
    onRefresh?: () => void;
    isLoading?: boolean;
};

export function HistoryModal({ isOpen, onClose, history, onRefresh, isLoading }: HistoryModalProps) {
    const [expandedGameId, setExpandedGameId] = useState<string | null>(null);

    const toggleExpanded = (gameId: string) => {
        setExpandedGameId((previous) => (previous === gameId ? null : gameId));
    };

    const hasExpandedGame = expandedGameId !== null;

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
                            if (hasExpandedGame && !isExpanded) {
                                return null;
                            }
                            return (
                                <div
                                    key={game.id}
                                    className="overflow-hidden rounded-lg border border-orange-800/20 bg-white/60 shadow-sm"
                                >
                                    <button
                                        type="button"
                                        onClick={() => toggleExpanded(game.id)}
                                        className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-white/70"
                                        style={{ color: buttonTextColor }}
                                    >
                                        <div className="flex flex-1 flex-col gap-1 sm:flex-row sm:items-center">
                                            <div className="flex items-center gap-2 text-sm" style={{ color: buttonSubTextColor }}>
                                                <Calendar className="h-4 w-4" />
                                                <span>{game.date}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-sm sm:ml-6" style={{ color: buttonSubTextColor }}>
                                                <Trophy className="h-4 w-4 text-amber-600" />
                                                <span>
                                                    {game.winner} gewann mit {" "}
                                                    <span className="font-semibold" style={{ color: winnerAccentColor }}>
                                                        {game.winnerScore}
                                                    </span>{" "}
                                                    Punkten
                                                </span>
                                            </div>
                                        </div>
                                        {isExpanded ? (
                                            <ChevronUp className="h-5 w-5" style={{ color: buttonTextColor }} />
                                        ) : (
                                            <ChevronDown className="h-5 w-5" style={{ color: buttonTextColor }} />
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
                                                    <CompactScoreboard game={game} />
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
