import { ChevronLeft, ChevronRight, Users } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import type { Category, ScoreSheet } from "../../../types/shared";
import { Button } from "../../ui/button";

type ScoreboardProps = {
    scoreSheets: ScoreSheet[];
    playerNames: string[];
    currentPlayerIndex: number;
    localPlayerIndex: number | null;
    previewScores?: Partial<Record<Category, number>> | null;
    canScore: boolean;
    onCategoryClick?: (category: Category) => void;
};

type ScoreCategory = {
    key: Category;
    name: string;
    section: "upper" | "lower";
};

const SCOREBOARD_CATEGORIES: ScoreCategory[] = [
    { key: "ones", name: "Ones", section: "upper" },
    { key: "twos", name: "Twos", section: "upper" },
    { key: "threes", name: "Threes", section: "upper" },
    { key: "fours", name: "Fours", section: "upper" },
    { key: "fives", name: "Fives", section: "upper" },
    { key: "sixes", name: "Sixes", section: "upper" },
    { key: "threeKind", name: "3 of a Kind", section: "lower" },
    { key: "fourKind", name: "4 of a Kind", section: "lower" },
    { key: "fullHouse", name: "Full House", section: "lower" },
    { key: "smallStraight", name: "Sm. Straight", section: "lower" },
    { key: "largeStraight", name: "Lg. Straight", section: "lower" },
    { key: "yahtzee", name: "Yahtzee", section: "lower" },
    { key: "chance", name: "Chance", section: "lower" },
];

const UPPER_KEYS: Category[] = ["ones", "twos", "threes", "fours", "fives", "sixes"];

function calculateUpperSubtotal(sheet: ScoreSheet) {
    return UPPER_KEYS.reduce((sum, category) => sum + (sheet[category] ?? 0), 0);
}

function calculateBonus(sheet: ScoreSheet) {
    return calculateUpperSubtotal(sheet) >= 63 ? 35 : 0;
}

function calculateTotal(sheet: ScoreSheet) {
    const base = SCOREBOARD_CATEGORIES.reduce((sum, category) => sum + (sheet[category.key] ?? 0), 0);
    return base + calculateBonus(sheet);
}

export function Scoreboard({
    scoreSheets,
    playerNames,
    currentPlayerIndex,
    localPlayerIndex,
    previewScores,
    canScore,
    onCategoryClick,
}: ScoreboardProps) {
    const [viewStartIndex, setViewStartIndex] = useState(0);

    const players = useMemo(() => {
        return scoreSheets.map((sheet, index) => ({
            name: playerNames[index] ?? `Player ${index + 1}`,
            sheet,
        }));
    }, [playerNames, scoreSheets]);

    const maxVisiblePlayers = 2;
    const canNavigateLeft = viewStartIndex > 0;
    const canNavigateRight = viewStartIndex + maxVisiblePlayers < players.length;
    const visiblePlayers = players.slice(viewStartIndex, viewStartIndex + maxVisiblePlayers);

    useEffect(() => {
        if (players.length <= maxVisiblePlayers) return;
        if (currentPlayerIndex < viewStartIndex) {
            setViewStartIndex(currentPlayerIndex);
        } else if (currentPlayerIndex >= viewStartIndex + maxVisiblePlayers) {
            setViewStartIndex(Math.max(0, currentPlayerIndex - maxVisiblePlayers + 1));
        }
    }, [currentPlayerIndex, players.length, viewStartIndex]);

    const handleCategorySelect = (key: Category) => {
        if (!onCategoryClick) return;
        onCategoryClick(key);
    };

    const renderCell = (playerIndex: number, category: ScoreCategory) => {
        const sheet = scoreSheets[playerIndex] ?? {};
        const assignedScore = sheet[category.key];
        const isLocalTurn = localPlayerIndex !== null && localPlayerIndex === currentPlayerIndex;
        const isInteractive =
            Boolean(onCategoryClick) &&
            canScore &&
            isLocalTurn &&
            playerIndex === currentPlayerIndex &&
            typeof assignedScore === "undefined";

        const previewValue = isInteractive && previewScores ? previewScores[category.key] : undefined;

        const baseClass = [
            "relative border-r border-orange-800/20 p-3 text-center text-sm transition-colors last:border-r-0",
            playerIndex === currentPlayerIndex ? "bg-orange-500/10" : "",
            isInteractive ? "cursor-pointer hover:bg-orange-200/30" : "",
        ]
            .filter(Boolean)
            .join(" ");

        return {
            className: baseClass,
            content: (
                <>
                    {typeof assignedScore === "number" ? (
                        <span className="text-orange-900">{assignedScore}</span>
                    ) : typeof previewValue === "number" ? (
                        <span className="text-orange-600">{previewValue}</span>
                    ) : (
                        <span className="text-orange-900/30">-</span>
                    )}
                </>
            ),
            onClick: isInteractive ? () => handleCategorySelect(category.key) : undefined,
        };
    };

    return (
        <div className="w-full max-w-6xl px-4">
            {players.length > 2 && (
                <div className="mb-3 flex items-center justify-between gap-3 md:hidden">
                    <Button
                        type="button"
                        onClick={() => setViewStartIndex(Math.max(0, viewStartIndex - 1))}
                        disabled={!canNavigateLeft}
                        size="sm"
                        variant="outline"
                        className="border-orange-400/40 bg-gradient-to-r from-orange-900/40 to-amber-900/40 text-amber-100 shadow-lg hover:from-orange-800/50 hover:to-amber-800/50 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="flex items-center gap-2 rounded-full border border-orange-400/30 bg-gradient-to-r from-orange-500/20 via-amber-500/20 to-orange-500/20 px-4 py-1.5 text-xs text-amber-100 shadow-lg backdrop-blur-sm">
                        <Users className="h-4 w-4 text-orange-300" />
                        <span>
                            {viewStartIndex + 1}-{Math.min(viewStartIndex + maxVisiblePlayers, players.length)}
                        </span>
                        <span className="text-orange-300/60">von</span>
                        <span className="text-orange-300">{players.length}</span>
                    </div>
                    <Button
                        type="button"
                        onClick={() => setViewStartIndex(Math.min(players.length - maxVisiblePlayers, viewStartIndex + 1))}
                        disabled={!canNavigateRight}
                        size="sm"
                        variant="outline"
                        className="border-orange-400/40 bg-gradient-to-r from-orange-900/40 to-amber-900/40 text-amber-100 shadow-lg hover:from-orange-800/50 hover:to-amber-800/50 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            )}

            <div className="overflow-hidden rounded-xl border-2 border-orange-500/30 bg-gradient-to-br from-[#e8dcc8] to-[#d4c5a9] shadow-[0_0_30px_rgba(249,115,22,0.3)]">
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="border-b-2 border-orange-600/40 bg-gradient-to-r from-[#c9a87c] to-[#b89968]">
                                <th className="p-3 text-left text-orange-900">Kategorie</th>
                                {visiblePlayers.map((player, idx) => {
                                    const absoluteIndex = viewStartIndex + idx;
                                    const isActive = absoluteIndex === currentPlayerIndex;
                                    return (
                                        <th
                                            key={`mobile-${absoluteIndex}`}
                                            className={`md:hidden border-r border-orange-800/20 p-3 text-center text-orange-900 transition-all last:border-r-0 ${isActive ? "bg-orange-500/15 text-orange-600" : ""}`}
                                        >
                                            {isActive && (
                                                <motion.span
                                                    animate={{ opacity: [1, 0.5, 1] }}
                                                    transition={{ duration: 2, repeat: Infinity }}
                                                    className="mr-1 inline-block"
                                                >
                                                    ▸
                                                </motion.span>
                                            )}
                                            {player.name}
                                            {absoluteIndex === localPlayerIndex && " (Du)"}
                                        </th>
                                    );
                                })}
                                {players.map((player, index) => {
                                    const isActive = index === currentPlayerIndex;
                                    return (
                                        <th
                                            key={`desktop-${index}`}
                                            className={`hidden border-r border-orange-800/20 p-3 text-center text-orange-900 transition-all last:border-r-0 md:table-cell ${isActive ? "bg-orange-500/15 text-orange-600" : ""}`}
                                        >
                                            {isActive && (
                                                <motion.span
                                                    animate={{ opacity: [1, 0.5, 1] }}
                                                    transition={{ duration: 2, repeat: Infinity }}
                                                    className="mr-1 inline-block"
                                                >
                                                    ▸
                                                </motion.span>
                                            )}
                                            {player.name}
                                            {index === localPlayerIndex && " (Du)"}
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody>
                            <tr className="bg-orange-700/20">
                                <td colSpan={players.length + 1} className="p-2 text-xs uppercase tracking-wider text-orange-800">
                                    Oberer Bereich
                                </td>
                            </tr>
                            {SCOREBOARD_CATEGORIES.filter((category) => category.section === "upper").map((category) => (
                                <tr key={category.key} className="border-b border-orange-800/10 hover:bg-orange-200/20">
                                    <td className="border-r border-orange-800/20 p-3 text-orange-900">{category.name}</td>
                                    {visiblePlayers.map((_, idx) => {
                                        const absoluteIndex = viewStartIndex + idx;
                                        const cell = renderCell(absoluteIndex, category);
                                        return (
                                            <td key={`mobile-${absoluteIndex}`} className={`md:hidden ${cell.className}`} onClick={cell.onClick}>
                                                {cell.content}
                                            </td>
                                        );
                                    })}
                                    {players.map((_, index) => {
                                        const cell = renderCell(index, category);
                                        return (
                                            <td key={`desktop-${index}`} className={`hidden md:table-cell ${cell.className}`} onClick={cell.onClick}>
                                                {cell.content}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}

                            <tr className="border-t-2 border-orange-700/30 bg-[#c9a87c]/40">
                                <td className="border-r border-orange-800/20 p-3 text-orange-900">Zwischensumme</td>
                                {visiblePlayers.map((player, idx) => {
                                    const absoluteIndex = viewStartIndex + idx;
                                    return (
                                        <td
                                            key={`mobile-${absoluteIndex}`}
                                            className="md:hidden border-r border-orange-800/20 p-3 text-center text-orange-900 last:border-r-0"
                                        >
                                            {calculateUpperSubtotal(player.sheet)}
                                        </td>
                                    );
                                })}
                                {players.map((player, index) => (
                                    <td
                                        key={`desktop-${index}`}
                                        className="hidden border-r border-orange-800/20 p-3 text-center text-orange-900 last:border-r-0 md:table-cell"
                                    >
                                        {calculateUpperSubtotal(player.sheet)}
                                    </td>
                                ))}
                            </tr>

                            <tr className="border-b-2 border-orange-700/40 bg-[#c9a87c]/40">
                                <td className="border-r border-orange-800/20 p-3 text-orange-900">Bonus (≥63)</td>
                                {visiblePlayers.map((player, idx) => {
                                    const absoluteIndex = viewStartIndex + idx;
                                    const bonus = calculateBonus(player.sheet);
                                    const subtotal = calculateUpperSubtotal(player.sheet);
                                    const label = bonus > 0 ? bonus : "-";
                                    return (
                                        <td
                                            key={`mobile-${absoluteIndex}`}
                                            className="md:hidden border-r border-orange-800/20 p-3 text-center text-orange-900 last:border-r-0"
                                        >
                                            <span className={bonus > 0 ? "text-emerald-700" : "text-orange-900/40"}>{label}</span>
                                            {subtotal > 0 && subtotal < 63 && (
                                                <div className="mt-0.5 text-[0.65rem] text-amber-600">{63 - subtotal} fehlen</div>
                                            )}
                                        </td>
                                    );
                                })}
                                {players.map((player, index) => {
                                    const bonus = calculateBonus(player.sheet);
                                    const subtotal = calculateUpperSubtotal(player.sheet);
                                    const label = bonus > 0 ? bonus : "-";
                                    return (
                                        <td
                                            key={`desktop-${index}`}
                                            className="hidden border-r border-orange-800/20 p-3 text-center text-orange-900 last:border-r-0 md:table-cell"
                                        >
                                            <span className={bonus > 0 ? "text-emerald-700" : "text-orange-900/40"}>{label}</span>
                                            {subtotal > 0 && subtotal < 63 && (
                                                <div className="mt-0.5 text-[0.65rem] text-amber-600">{63 - subtotal} fehlen</div>
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>

                            <tr className="bg-orange-700/20">
                                <td colSpan={players.length + 1} className="p-2 text-xs uppercase tracking-wider text-orange-800">
                                    Unterer Bereich
                                </td>
                            </tr>
                            {SCOREBOARD_CATEGORIES.filter((category) => category.section === "lower").map((category) => (
                                <tr key={category.key} className="border-b border-orange-800/10 hover:bg-orange-200/20">
                                    <td className="border-r border-orange-800/20 p-3 text-orange-900">{category.name}</td>
                                    {visiblePlayers.map((_, idx) => {
                                        const absoluteIndex = viewStartIndex + idx;
                                        const cell = renderCell(absoluteIndex, category);
                                        return (
                                            <td key={`mobile-${absoluteIndex}`} className={`md:hidden ${cell.className}`} onClick={cell.onClick}>
                                                {cell.content}
                                            </td>
                                        );
                                    })}
                                    {players.map((_, index) => {
                                        const cell = renderCell(index, category);
                                        return (
                                            <td key={`desktop-${index}`} className={`hidden md:table-cell ${cell.className}`} onClick={cell.onClick}>
                                                {cell.content}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}

                            <tr className="border-t-2 border-orange-700/50 bg-gradient-to-r from-orange-700/30 to-amber-700/30">
                                <td className="border-r border-orange-800/20 p-3 text-orange-900">Gesamt</td>
                                {visiblePlayers.map((player, idx) => {
                                    const absoluteIndex = viewStartIndex + idx;
                                    return (
                                        <td
                                            key={`mobile-${absoluteIndex}`}
                                            className="md:hidden border-r border-orange-800/20 p-3 text-center text-orange-900 last:border-r-0"
                                        >
                                            {calculateTotal(player.sheet)}
                                        </td>
                                    );
                                })}
                                {players.map((player, index) => (
                                    <td
                                        key={`desktop-${index}`}
                                        className="hidden border-r border-orange-800/20 p-3 text-center text-orange-900 last:border-r-0 md:table-cell"
                                    >
                                        {calculateTotal(player.sheet)}
                                    </td>
                                ))}
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
