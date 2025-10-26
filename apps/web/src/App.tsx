import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatedBackground } from "./autumn/components/common/AnimatedBackground";
import { StatusToast } from "./autumn/components/common/StatusToast";
import { TopBar } from "./autumn/components/common/TopBar";
import { FinishedView } from "./autumn/screens/Game/FinishedView";
import { GameView, type PlayerStatus } from "./autumn/screens/Game/GameView";
import { GameHistory } from "./autumn/screens/History/GameHistory";
import { PlayerSetupNew, type SetupPlayer } from "./autumn/screens/Setup/PlayerSetupNew";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "./autumn/ui/alert-dialog";
import RoleSelectModal from "./components/RoleSelectModal";
import { usePlayerIdentity } from "./hooks/usePlayerIdentity";
import {
    createSocket,
    ROLE_LABELS,
    type AppSocket,
    type OpponentStatusPayload,
    type RoomRole,
} from "./lib/socket";
import { soundManager } from "./lib/sounds";
import type {
    Category,
    GamePhase,
    HistoryEntry,
    PlayerIndex,
    SerializedGameState,
} from "./types/shared";
import { scoreAllCategories } from "./utils/gameRules";

const HISTORY_CACHE_KEY = "kniffel-history-cache";

const UPPER_CATEGORIES: Category[] = [
    "ones",
    "twos",
    "threes",
    "fours",
    "fives",
    "sixes",
];

const LOWER_CATEGORIES: Category[] = [
    "threeKind",
    "fourKind",
    "fullHouse",
    "smallStraight",
    "largeStraight",
    "yahtzee",
    "chance",
];

const ALL_CATEGORIES: Category[] = [...UPPER_CATEGORIES, ...LOWER_CATEGORIES];

type ConnectionPhase = "connecting" | "waiting" | "matched";

type HistoryGame = {
    id: string;
    date: string;
    players: Array<{ name: string; scores: Record<Category, number | null>; total: number }>;
    winner: string;
    winnerScore: number;
};

const historyFormatter = new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
});

function defaultName(index: PlayerIndex) {
    return `Player ${index + 1}`;
}

function calculateFinalScore(sheet: Record<Category, number | undefined>) {
    const upper = UPPER_CATEGORIES.reduce((sum, category) => sum + (sheet[category] ?? 0), 0);
    const lower = LOWER_CATEGORIES.reduce((sum, category) => sum + (sheet[category] ?? 0), 0);
    const bonus = upper >= 63 ? 35 : 0;
    return upper + bonus + lower;
}

function loadHistoryCache(): HistoryEntry[] {
    if (typeof window === "undefined") return [];
    try {
        const raw = window.localStorage.getItem(HISTORY_CACHE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed as HistoryEntry[];
    } catch {
        return [];
    }
}

function cacheHistory(entries: HistoryEntry[]) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(HISTORY_CACHE_KEY, JSON.stringify(entries));
}

function transformHistoryEntries(entries: HistoryEntry[]): HistoryGame[] {
    return [...entries]
        .sort((a, b) => b.finishedAt - a.finishedAt)
        .map((entry) => {
            const playerCount = Math.max(
                entry.playerNames.length,
                entry.scoreSheets.length,
                entry.scores.length,
                2,
            );

            const players = Array.from({ length: playerCount }, (_, index) => {
                const name = entry.playerNames[index]?.trim() || `Spieler ${index + 1}`;
                const sheet = entry.scoreSheets[index] ?? {};
                const scores: Record<Category, number | null> = ALL_CATEGORIES.reduce(
                    (acc, category) => {
                        acc[category] = sheet[category] ?? null;
                        return acc;
                    },
                    {} as Record<Category, number | null>,
                );
                const computedTotal = calculateFinalScore(sheet as Record<Category, number | undefined>);
                const total = entry.scores[index] ?? computedTotal;
                return { name, scores, total };
            });

            const totals = players.map((player) => player.total);
            const bestScore = totals.length ? Math.max(...totals) : 0;
            const declaredWinner = entry.winner?.trim() ?? "";
            const winnerName = declaredWinner === "Draw" || declaredWinner.length === 0 ? "Unentschieden" : declaredWinner;

            let winnerScore = bestScore;
            if (declaredWinner && declaredWinner !== "Draw") {
                const index = players.findIndex((player) => player.name === declaredWinner);
                if (index >= 0) {
                    winnerScore = players[index]?.total ?? bestScore;
                }
            }

            return {
                id: entry.id,
                date: historyFormatter.format(new Date(entry.finishedAt)),
                players,
                winner: winnerName,
                winnerScore,
            };
        });
}

function getSetupStatusMessage(args: {
    connectionPhase: ConnectionPhase;
    opponentConnected: boolean;
    localReady: boolean;
    opponentReady: boolean;
}) {
    if (args.connectionPhase === "connecting") {
        return "Verbindung zum Spielserver wird hergestellt...";
    }
    if (args.connectionPhase === "waiting") {
        return "Warten auf weitere Spieler...";
    }
    if (!args.opponentConnected) {
        return "Teile den Link, damit Mitspieler beitreten können.";
    }
    if (!args.opponentReady) {
        return "Mitspieler sind verbunden. Warten auf Start.";
    }
    if (!args.localReady) {
        return "Drücke \"Spiel starten\", wenn du bereit bist.";
    }
    return "Alle Spieler sind bereit!";
}

function getTopBarHint(
    connectionPhase: ConnectionPhase,
    phase: GamePhase | null,
    opponentConnected: boolean,
) {
    if (connectionPhase === "connecting") return "Verbindung wird hergestellt...";
    if (connectionPhase === "waiting") return "Warte auf Mitspieler";
    if (!phase) return opponentConnected ? "Lobby geöffnet" : "Bereit zum Start";
    if (phase === "setup") return opponentConnected ? "Mitspieler verbunden" : "Lobby offen";
    if (phase === "playing") return "Spiel läuft";
    if (phase === "finished") return "Spiel beendet";
    return undefined;
}

export default function App() {
    const socketRef = useRef<AppSocket | null>(null);
    const [socket, setSocket] = useState<AppSocket | null>(null);
    const [connectionPhase, setConnectionPhase] = useState<ConnectionPhase>("connecting");
    const [gameState, setGameState] = useState<SerializedGameState | null>(null);
    const [opponentConnected, setOpponentConnected] = useState(false);
    const [playerStatuses, setPlayerStatuses] = useState<PlayerStatus[]>([]);
    const [history, setHistory] = useState<HistoryEntry[]>(loadHistoryCache);
    const [historyOpen, setHistoryOpen] = useState(false);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [localNameDraft, setLocalNameDraft] = useState("");
    const [isEditingName, setIsEditingName] = useState(false);
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const toastTimeoutRef = useRef<number | undefined>(undefined);
    const [isRolling, setIsRolling] = useState(false);
    const [isHelpOpen, setIsHelpOpen] = useState(false);
    const [playerCount, setPlayerCount] = useState<number>(2);
    const [soundEnabled, setSoundEnabled] = useState(() => soundManager.isAudioEnabled());

    const showToast = useCallback((message: string, duration = 3000) => {
        setToastMessage(message);
        if (typeof window === "undefined") {
            return;
        }
        if (toastTimeoutRef.current) {
            window.clearTimeout(toastTimeoutRef.current);
        }
        toastTimeoutRef.current = window.setTimeout(() => setToastMessage(null), duration);
    }, []);

    useEffect(() => {
        return () => {
            if (typeof window !== "undefined" && toastTimeoutRef.current) {
                window.clearTimeout(toastTimeoutRef.current);
            }
        };
    }, []);

    useEffect(() => {
        const unsubscribe = soundManager.subscribe((enabled) => setSoundEnabled(enabled));
        return unsubscribe;
    }, []);

    const { socketUrl, apiBaseUrl } = useMemo(() => {
        if (typeof window === "undefined") return { socketUrl: undefined, apiBaseUrl: "" } as const;
        const isDev = import.meta.env.DEV;
        const envServer =
            (import.meta.env.VITE_SOCKET_URL as string | undefined) ||
            (import.meta.env.VITE_SERVER_URL as string | undefined) ||
            undefined;
        if (isDev) {
            return { socketUrl: window.location.origin, apiBaseUrl: "" } as const;
        }
        const resolved = envServer ?? window.location.origin;
        return { socketUrl: resolved, apiBaseUrl: resolved } as const;
    }, []);

    useEffect(() => {
        const instance = createSocket(socketUrl);
        socketRef.current = instance;
        setSocket(instance);

        instance.on("connect", () => {
            setIsRolling(false);
        });

        instance.on("disconnect", () => {
            setConnectionPhase("connecting");
            setOpponentConnected(false);
        });

        instance.on("state", (state: SerializedGameState) => {
            setGameState(state);
            setIsRolling(false);
        });

        instance.on("phase", (phase: GamePhase) => {
            if (phase === "setup") {
                setConnectionPhase("matched");
            }
        });

        instance.on("history", (entries: HistoryEntry[]) => {
            setHistory(entries);
            cacheHistory(entries);
            setHistoryLoading(false);
        });

        instance.on("action-denied", ({ message }: { message?: string }) => {
            if (message) {
                showToast(message);
            }
            setIsRolling(false);
        });

        instance.on("opponent-status", ({ connected }: OpponentStatusPayload) => {
            setOpponentConnected(connected);
        });

        return () => {
            instance.removeAllListeners();
            instance.disconnect();
            socketRef.current = null;
            setSocket(null);
        };
    }, [showToast, socketUrl]);

    const identityApi = usePlayerIdentity(socket);
    const {
        identity,
        status: roomStatus,
        sessionState,
        isModalOpen,
        openModal,
        closeModal,
        claimRole,
        releaseRole,
        isClaiming,
        error: roleError,
        clearError,
        suggestedName,
    } = identityApi;

    const playerIndex = identity ? (Number(identity.role.slice(1)) - 1 || 0) : null;
    const playerNumber = playerIndex !== null ? playerIndex : null;

    useEffect(() => {
        if (!socket) {
            setConnectionPhase("connecting");
            return;
        }

        if (!socket.connected) {
            setConnectionPhase("connecting");
            return;
        }

        if (identity) {
            setConnectionPhase("matched");
        } else if (sessionState === "loading" || sessionState === "restoring") {
            return;
        } else if (!isModalOpen && !isClaiming) {
            setConnectionPhase("waiting");
        }
    }, [socket, identity, sessionState, isModalOpen, isClaiming]);

    useEffect(() => {
        if (isEditingName) return;
        if (!identity) {
            setLocalNameDraft("");
            return;
        }
        setLocalNameDraft((previous) => (previous ? previous : identity.name));
    }, [identity, isEditingName]);

    useEffect(() => {
        if (playerIndex === null || !gameState) return;
        if (isEditingName) return;
        const serverName = gameState.playerNames[playerIndex]?.trim();
        if (serverName) {
            if (serverName !== localNameDraft) {
                setLocalNameDraft(serverName);
            }
            return;
        }
        const fallback = identity?.name ?? defaultName(playerIndex);
        if (fallback !== localNameDraft) {
            setLocalNameDraft(fallback);
        }
    }, [playerIndex, gameState, identity?.name, isEditingName, localNameDraft]);

    useEffect(() => {
        if (!identity) {
            setOpponentConnected(false);
            setPlayerStatuses([]);
            return;
        }
        if (!roomStatus) return;
        const opponentRole = identity.role === "p1" ? "p2" : "p1";
        const opponentSlot = roomStatus.roles[opponentRole];
        setOpponentConnected(Boolean(opponentSlot?.connected));
        const capacity = Math.max(2, Math.min(6, roomStatus.capacity || 2));
        const statuses: PlayerStatus[] = Array.from({ length: capacity }, (_, index) => {
            const role = (`p${index + 1}`) as RoomRole;
            const entry = roomStatus.roles[role];
            const connected = Boolean(entry?.connected);
            const ready = Boolean(gameState?.ready?.[index]);
            return { connected, ready };
        });
        setPlayerStatuses(statuses);
        if (typeof roomStatus.capacity === "number" && roomStatus.capacity >= 2 && roomStatus.capacity <= 6) {
            setPlayerCount(roomStatus.capacity);
        }
    }, [roomStatus, identity, gameState?.ready]);

    useEffect(() => {
        if (!historyOpen) return;
        setHistoryLoading(true);
        fetchHistory().catch(() => {
            const filter = getHistoryFilter();
            socketRef.current?.emit("request-history", filter);
        });
    }, [historyOpen]);

    const lastHistoryKeyRef = useRef<string>("");
    useEffect(() => {
        const filter = getHistoryFilter();
        const key = JSON.stringify(filter);
        if (key === lastHistoryKeyRef.current) return;
        lastHistoryKeyRef.current = key;
        fetchHistory().catch(() => {
            socketRef.current?.emit("request-history", filter);
        });
    }, [identity?.name, gameState?.playerNames?.[0], gameState?.playerNames?.[1]]);

    const displayNames: string[] = gameState?.playerNames?.length
        ? gameState.playerNames.map((name, index) => name || defaultName(index))
        : [defaultName(0), defaultName(1)];

    const localReady = playerIndex !== null && gameState?.ready ? Boolean(gameState.ready[playerIndex]) : false;

    const finalScores: number[] | null = gameState
        ? gameState.scoreSheets.map((sheet) => calculateFinalScore(sheet as Record<Category, number | undefined>))
        : null;

    const winner = useMemo(() => {
        if (!gameState || gameState.phase !== "finished" || !finalScores) return "";
        const max = Math.max(...finalScores);
        const winners = finalScores
            .map((value, index) => (value === max ? gameState.playerNames[index] || defaultName(index) : null))
            .filter(Boolean) as string[];
        return winners.length === 1 ? winners[0]! : "Draw";
    }, [finalScores, gameState]);

    const isCurrentPlayer = Boolean(
        gameState &&
        playerNumber !== null &&
        gameState.phase === "playing" &&
        gameState.currentPlayer === playerNumber,
    );

    const previewScores = useMemo(() => {
        if (!gameState || !isCurrentPlayer || playerIndex === null) return null;
        return scoreAllCategories(gameState.dice);
    }, [gameState, isCurrentPlayer, playerIndex]);

    const startDisabled =
        !identity || !localNameDraft.trim() || connectionPhase !== "matched" || playerIndex === null;

    const topBarHint = getTopBarHint(connectionPhase, gameState?.phase ?? null, opponentConnected);

    const setupStatusMessage = getSetupStatusMessage({
        connectionPhase,
        opponentConnected,
        localReady,
        opponentReady: playerStatuses.some((status, index) => index !== playerIndex && status.ready),
    });

    const transformedHistory = useMemo(() => transformHistoryEntries(history), [history]);

    const historyGames = transformedHistory;

    function getHistoryFilter(): { players?: string[]; limit?: number; mode?: "exact" | "contains" } {
        const playerNames = (gameState?.playerNames ?? [])
            .map((name) => (name ?? "").trim())
            .filter(Boolean);
        if (playerNames.length >= 2) {
            return { players: playerNames, limit: 50, mode: "exact" };
        }
        const me = identity?.name?.trim();
        if (me && me.length > 0) {
            return { players: [me], limit: 50, mode: "contains" };
        }
        return { limit: 50 };
    }

    async function fetchHistory() {
        try {
            setHistoryLoading(true);
            const filter = getHistoryFilter();
            const params = new URLSearchParams();
            if (filter.players && filter.players.length > 0) {
                params.set("players", filter.players.join(","));
            }
            if (filter.limit) params.set("limit", String(filter.limit));
            if (filter.mode) params.set("mode", filter.mode);
            const base = apiBaseUrl ?? "";
            const url = `${base}/api/history${params.toString() ? `?${params.toString()}` : ""}`;
            const response = await fetch(url);
            if (!response.ok) {
                return;
            }
            const data = (await response.json()) as { history: HistoryEntry[] };
            setHistory(data.history);
            cacheHistory(data.history);
            setHistoryLoading(false);
        } catch {
            // Keep spinner until socket fallback delivers data
        }
    }

    function submitName(name: string) {
        if (!socketRef.current || playerIndex === null || !identity) return;
        const trimmed = name.trim();
        if (!trimmed) return;
        socketRef.current.emit("set-name", { name: trimmed });
    }

    function handleNameFocus() {
        if (!identity) return;
        setIsEditingName(true);
        if (playerIndex !== null && localNameDraft === defaultName(playerIndex)) {
            setLocalNameDraft("");
        }
    }

    function handleNameBlur() {
        setIsEditingName(false);
        const trimmed = localNameDraft.trim();
        if (playerIndex === null) {
            setLocalNameDraft(trimmed);
            return;
        }
        if (!trimmed) {
            const fallback = identity?.name ?? defaultName(playerIndex);
            setLocalNameDraft(fallback);
            submitName(fallback);
        } else {
            setLocalNameDraft(trimmed);
            submitName(trimmed);
        }
    }

    function handleNameChange(value: string) {
        setLocalNameDraft(value.slice(0, 40));
    }

    function handleStart() {
        if (!socketRef.current || playerIndex === null || !identity) return;
        const trimmed = localNameDraft.trim() || identity.name;
        submitName(trimmed);
        socketRef.current.emit("ready");
    }

    function handleRoll() {
        if (!socketRef.current) return;
        setIsRolling(true);
        socketRef.current.emit("roll");
    }

    function handleToggleHold(index: number) {
        socketRef.current?.emit("toggle-hold", { index });
    }

    function handleChoose(category: Category) {
        socketRef.current?.emit("choose", { category });
    }

    function handleReset() {
        socketRef.current?.emit("reset");
    }

    function handleShowHistory() {
        setHistoryOpen(true);
    }

    function handleCloseHistory() {
        setHistoryOpen(false);
    }

    function handleRefreshHistory() {
        setHistoryLoading(true);
        fetchHistory().catch(() => {
            const filter = getHistoryFilter();
            socketRef.current?.emit("request-history", filter);
        });
    }

    function handlePlayerCountChange(next: number) {
        setPlayerCount(next);
        if (!socketRef.current) return;
        if (!gameState || gameState.phase !== "setup") return;
        socketRef.current.emit("room:setCapacity", { capacity: next });
    }

    function getSetupPlayers(): SetupPlayer[] | undefined {
        const capacity = roomStatus?.capacity ?? playerCount;
        const names: string[] = (gameState?.playerNames ?? Array.from({ length: capacity }, (_, index) => defaultName(index)))
            .map((name, index) => (name && name.trim().length > 0 ? name.trim() : defaultName(index)));
        if (!roomStatus) {
            return undefined;
        }
        return names.map((name, index) => {
            const role = (`p${index + 1}`) as RoomRole;
            const connected = Boolean(roomStatus.roles?.[role]?.connected);
            const ready = Boolean(gameState?.ready?.[index]);
            const isSelf = identity ? index === (Number(identity.role.slice(1)) - 1 || 0) : false;
            return { name: name || defaultName(index), connected, ready, isSelf };
        });
    }

    const canEditName = Boolean(identity);

    const phaseContent = (() => {
        if (sessionState === "loading" || sessionState === "restoring") {
            return (
                <div className="flex flex-1 items-center justify-center text-amber-100/80">
                    Verbindung wird hergestellt...
                </div>
            );
        }

        if (!gameState || gameState.phase === "setup") {
            return (
                <div className="flex flex-1 items-center justify-center p-4">
                    <PlayerSetupNew
                        playerCount={playerCount}
                        onPlayerCountChange={handlePlayerCountChange}
                        localName={localNameDraft}
                        localPlaceholder={identity?.name ?? (playerIndex !== null ? defaultName(playerIndex) : "Dein Name")}
                        canEditName={canEditName}
                        onNameChange={handleNameChange}
                        onNameFocus={handleNameFocus}
                        onNameBlur={handleNameBlur}
                        onStart={handleStart}
                        onOpenHistory={handleShowHistory}
                        startDisabled={startDisabled}
                        localReady={localReady}
                        statusMessage={setupStatusMessage}
                        players={getSetupPlayers()}
                    />
                </div>
            );
        }

        if (gameState.phase === "playing" && playerIndex !== null) {
            return (
                <GameView
                    state={gameState}
                    playerIndex={playerIndex}
                    playerNames={displayNames}
                    isCurrentPlayer={isCurrentPlayer}
                    isRolling={isRolling}
                    previewScores={previewScores}
                    onRoll={handleRoll}
                    onToggleHold={handleToggleHold}
                    onChooseCategory={handleChoose}
                    onReset={handleReset}
                    onOpenHistory={handleShowHistory}
                    playerStatuses={playerStatuses}
                    soundEnabled={soundEnabled}
                    onToggleSound={(enabled) => {
                        setSoundEnabled(enabled);
                        showToast(enabled ? "Sound aktiviert 🔊" : "Sound deaktiviert 🔇", 2000);
                    }}
                />
            );
        }

        if (gameState.phase === "finished") {
            return (
                <FinishedView
                    state={gameState}
                    playerNames={displayNames}
                    scores={finalScores ?? []}
                    winner={winner}
                    onReset={handleReset}
                    onOpenHistory={handleShowHistory}
                />
            );
        }

        return (
            <div className="flex flex-1 items-center justify-center text-amber-100/80">
                Wähle einen Sitz, um dem Spiel beizutreten.
            </div>
        );
    })();

    const previousPhaseRef = useRef<GamePhase | null>(null);
    useEffect(() => {
        const currentPhase = gameState?.phase ?? null;
        if (previousPhaseRef.current !== "finished" && currentPhase === "finished" && finalScores) {
            soundManager.gameWin();
            const maxScore = Math.max(...finalScores);
            if (maxScore > 0) {
                showToast(
                    winner === "Draw"
                        ? `🏆 Unentschieden mit ${maxScore} Punkten`
                        : `🏆 ${winner} gewinnt mit ${maxScore} Punkten!`,
                    4000,
                );
            }
        }
        previousPhaseRef.current = currentPhase;
    }, [gameState?.phase, finalScores, winner, showToast]);

    return (
        <div className="min-h-screen w-full overflow-x-hidden bg-transparent text-amber-100">
            <AnimatedBackground />
            <div className="relative z-10 flex min-h-screen flex-col">
                <TopBar
                    onHelp={() => setIsHelpOpen(true)}
                    onOpenHistory={handleShowHistory}
                    onOpenRoleModal={openModal}
                    onReleaseSeat={identity ? releaseRole : undefined}
                    identityLabel={identity ? ROLE_LABELS[identity.role] : undefined}
                    identityName={identity?.name}
                    connectionHint={topBarHint}
                />

                <main className="flex flex-1 flex-col items-center">
                    {phaseContent}
                </main>

                <StatusToast message={toastMessage} isVisible={Boolean(toastMessage)} />

                <GameHistory
                    isOpen={historyOpen}
                    onClose={handleCloseHistory}
                    history={historyGames}
                    onRefresh={handleRefreshHistory}
                    isLoading={historyLoading}
                />

                <RoleSelectModal
                    isOpen={isModalOpen}
                    status={roomStatus}
                    suggestedName={suggestedName}
                    onClose={closeModal}
                    onClaim={(role, name) => claimRole(role, name)}
                    isClaiming={isClaiming}
                    error={roleError}
                    clearError={clearError}
                />

                <AlertDialog open={isHelpOpen} onOpenChange={setIsHelpOpen}>
                    <AlertDialogContent className="border-2 border-orange-500/30 bg-[#3d2549] text-amber-100">
                        <AlertDialogHeader>
                            <AlertDialogTitle className="text-orange-300">How to Play 🎲</AlertDialogTitle>
                            <AlertDialogDescription className="text-amber-100/90">
                                Erziele die meisten Punkte, indem du clevere Würfelkombinationen wählst.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <div className="space-y-4 text-sm text-amber-100/90">
                            <div>
                                <div className="mb-2 font-semibold text-orange-200">Spielablauf</div>
                                <ul className="list-inside list-disc space-y-1">
                                    <li>Bis zu drei Würfe pro Zug</li>
                                    <li>Wähle Würfel aus, die gehalten werden sollen</li>
                                    <li>Trage das Ergebnis in eine freie Kategorie ein</li>
                                    <li>Jede Kategorie kann nur einmal verwendet werden</li>
                                </ul>
                            </div>
                            <div>
                                <div className="mb-2 font-semibold text-orange-200">Kombinationen</div>
                                <ul className="list-inside list-disc space-y-1">
                                    <li>Full House: 3 gleiche + 2 gleiche (25 Punkte)</li>
                                    <li>Kleine Straße: Vier in Folge (30 Punkte)</li>
                                    <li>Große Straße: Fünf in Folge (40 Punkte)</li>
                                    <li>Kniffel: Fünf gleiche (50 Punkte)</li>
                                </ul>
                            </div>
                        </div>
                        <AlertDialogFooter>
                            <AlertDialogAction className="bg-orange-500 hover:bg-orange-600">
                                Verstanden
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </div>
    );
}
