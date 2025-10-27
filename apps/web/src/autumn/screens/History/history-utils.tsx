import { Trophy } from "lucide-react";
import type { Category } from "../../../types/shared";

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

function lowerSubtotal(scores: PlayerScoreMap) {
    return LOWER.reduce((total, category) => total + (scores[category.key] ?? 0), 0);
}

const palette = {
    text: "#6b3f23",
    heading: "#84512a",
    winner: "#b45f16",
    summaryBackground: "rgba(209, 157, 102, 0.12)",
    totalBackground: "rgba(209, 157, 102, 0.24)",
    indicatorBackground: "rgba(248, 180, 109, 0.18)",
};

const headGradient = {
    start: "#c9a87c",
    end: "#b89968",
};

type ScoreRow =
    | { kind: "summary" | "total"; label: string; values: Array<number | string>; emphasis?: boolean }
    | { kind: "indicator"; label: string; values: Array<string> };

export function CompactScoreboard({ game }: { game: HistoryGame }) {
    const needsScroll = game.players.length > 3;
    const minWidth = needsScroll ? 320 + game.players.length * 120 : undefined;

    const rows: ScoreRow[] = [
        {
            kind: "summary",
            label: "Oberer Bereich",
            values: game.players.map((player) => upperSubtotal(player.scores) + bonus(player.scores)),
        },
        {
            kind: "summary",
            label: "Unterer Bereich",
            values: game.players.map((player) => lowerSubtotal(player.scores)),
        },
        {
            kind: "indicator",
            label: "Kniffel",
            values: game.players.map((player) => {
                const yahtzeeScore = player.scores.yahtzee ?? 0;
                return typeof yahtzeeScore === "number" && yahtzeeScore > 0 ? `✔︎ (${yahtzeeScore})` : "–";
            }),
        },
        {
            kind: "total",
            label: "Gesamt",
            values: game.players.map((player) => player.total),
            emphasis: true,
        },
    ];

    return (
        <div className="overflow-hidden rounded-xl border border-orange-800/20 bg-white/70 shadow-inner">
            <div className="overflow-x-auto">
                <table
                    className="w-full border-collapse text-sm leading-tight"
                    style={{
                        color: palette.text,
                        minWidth: minWidth ? `${minWidth}px` : "100%",
                        tableLayout: needsScroll ? "auto" : "fixed",
                    }}
                >
                    <thead>
                        <tr
                            className="border-b-2 border-orange-600/40"
                            style={{ backgroundImage: `linear-gradient(90deg, ${headGradient.start}, ${headGradient.end})` }}
                        >
                            <th className="px-3 py-2 text-left text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-orange-900">
                                Kategorie
                            </th>
                            {game.players.map((player, index) => (
                                <th key={`header-${index}`} className="px-3 py-2 text-center">
                                    <div className="flex items-center justify-center gap-1 text-[0.75rem] font-semibold" style={{ color: palette.heading }}>
                                        <span className="max-w-[5.5rem] truncate" title={player.name}>
                                            {player.name}
                                        </span>
                                        {player.name === game.winner && <Trophy className="h-3 w-3 text-amber-600" />}
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, rowIndex) => {
                            if (row.kind === "summary") {
                                return (
                                    <tr key={`row-${rowIndex}`} style={{ backgroundColor: palette.summaryBackground }}>
                                        <td className="px-3 py-2 text-left font-semibold">{row.label}</td>
                                        {row.values.map((value, valueIndex) => (
                                            <td key={`row-${rowIndex}-value-${valueIndex}`} className="px-3 py-2 text-center font-semibold">
                                                {value}
                                            </td>
                                        ))}
                                    </tr>
                                );
                            }

                            if (row.kind === "indicator") {
                                return (
                                    <tr key={`row-${rowIndex}`} style={{ backgroundColor: palette.indicatorBackground }}>
                                        <td className="px-3 py-2 text-left font-semibold">{row.label}</td>
                                        {row.values.map((value, valueIndex) => {
                                            const isHit = value.includes("✔︎");
                                            return (
                                                <td
                                                    key={`row-${rowIndex}-value-${valueIndex}`}
                                                    className="px-3 py-2 text-center font-semibold"
                                                    style={{ color: isHit ? palette.winner : palette.text }}
                                                >
                                                    {value}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                );
                            }

                            // total row
                            return (
                                <tr key={`row-${rowIndex}`} style={{ backgroundColor: palette.totalBackground }}>
                                    <td className="px-3 py-2 text-left font-semibold uppercase">{row.label}</td>
                                    {row.values.map((value, valueIndex) => {
                                        const isWinner = game.players[valueIndex].name === game.winner;
                                        return (
                                            <td
                                                key={`row-${rowIndex}-value-${valueIndex}`}
                                                className="px-3 py-2 text-center font-semibold"
                                                style={{ color: isWinner ? palette.winner : palette.text }}
                                            >
                                                {value}
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export { bonus, LOWER, UPPER, upperSubtotal };
export type { HistoryGame, HistoryPlayer, PlayerScoreMap };

