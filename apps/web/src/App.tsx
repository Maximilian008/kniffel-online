import {
    determineWinner,
    roleToSeat,
    scoreAllCategories,
    totalScore,
    type Category,
    type GamePhase,
    type GameState,
    type HistoryEntry,
    type HistoryQuery,
} from "@kniffel/game";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatedBackground } from "./autumn/components/common/AnimatedBackground";
import { StatusToast } from "./autumn/components/common/StatusToast";
import { TopBar } from "./autumn/components/common/TopBar";
import { FinishedView } from "./autumn/screens/Game/FinishedView";
import { GameView, type PlayerStatus } from "./autumn/screens/Game/GameView";
import { HistoryModal } from "./autumn/screens/History/HistoryModal";
import type { HistoryGame } from "./autumn/screens/History/history-utils";
import { SetupScreen, type SetupPlayer } from "./autumn/screens/Setup/SetupScreen";
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
import { createSocket, historyUrl, ROLE_LABELS, type AppSocket, type RoomRole } from "./lib/socket";
import { soundManager } from "./lib/sounds";

const HISTORY_CACHE_KEY = "kniffel-history-cache";

type ConnectionPhase = "connecting" | "waiting" | "matched";

const historyFormatter = new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
});

function defaultName(index: number) {
    return `Spieler ${index + 1}`;
}

function loadHistoryCache(): HistoryEntry[] {
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
    try {
        window.localStorage.setItem(HISTORY_CACHE_KEY, JSON.stringify(entries));
    } catch {
        // storage unavailable (private mode) – the cache is optional
    }
}

function transformHistoryEntries(entries: HistoryEntry[]): HistoryGame[] {
    return [...entries]
        .sort((a, b) => b.finishedAt - a.finishedAt)
        .map((entry) => {
            const playerCount = Math.max(entry.playerNames.length, entry.scoreSheets.length, entry.scores.length, 2);
            const players = Array.from({ length: playerCount }, (_, index) => {
                const name = entry.playerNames[index]?.trim() || defaultName(index);
                const sheet = entry.scoreSheets[index] ?? {};
                const total = entry.scores[index] ?? totalScore(sheet);
                return { name, scores: sheet, total };
            });
            const winnerScore = Math.max(...players.map((player) => player.total));
            return {
                id: entry.id,
                date: historyFormatter.format(new Date(entry.finishedAt)),
                players,
                winner: entry.winner,
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
    const [isConnected, setIsConnected] = useState(false);
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [history, setHistory] = useState<HistoryEntry[]>(loadHistoryCache);
    const [historyOpen, setHistoryOpen] = useState(false);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const toastTimeoutRef = useRef<number | undefined>(undefined);
    const [isRolling, setIsRolling] = useState(false);
    const [isHelpOpen, setIsHelpOpen] = useState(false);
    const [playerCount, setPlayerCount] = useState<number>(2);
    const [soundEnabled, setSoundEnabled] = useState(() => soundManager.isAudioEnabled());

    const showToast = useCallback((message: string, duration = 3000) => {
        setToastMessage(message);
        window.clearTimeout(toastTimeoutRef.current);
        toastTimeoutRef.current = window.setTimeout(() => setToastMessage(null), duration);
    }, []);

    useEffect(() => () => window.clearTimeout(toastTimeoutRef.current), []);

    useEffect(() => {
        const unsubscribe = soundManager.subscribe((enabled) => setSoundEnabled(enabled));
        return unsubscribe;
    }, []);

    useEffect(() => {
        const instance = createSocket();
        socketRef.current = instance;
        setSocket(instance);

        instance.on("connect", () => {
            setIsConnected(true);
            setIsRolling(false);
        });
        instance.on("disconnect", () => setIsConnected(false));
        instance.on("state", (state) => {
            setGameState(state);
            setIsRolling(false);
        });
        instance.on("history", (entries) => {
            setHistory(entries);
            cacheHistory(entries);
            setHistoryLoading(false);
        });
        instance.on("action-denied", ({ message }) => {
            if (message) showToast(message);
            setIsRolling(false);
        });

        return () => {
            instance.removeAllListeners();
            instance.disconnect();
            socketRef.current = null;
            setSocket(null);
        };
    }, [showToast]);

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
    } = usePlayerIdentity(socket);

    const playerIndex = identity ? roleToSeat(identity.role) : null;

    const connectionPhase: ConnectionPhase = !isConnected
        ? "connecting"
        : identity
            ? "matched"
            : sessionState === "loading" || sessionState === "restoring"
                ? "connecting"
                : "waiting";

    const playerStatuses: PlayerStatus[] = useMemo(() => {
        if (!identity || !roomStatus) return [];
        const capacity = Math.max(2, Math.min(6, roomStatus.capacity || 2));
        return Array.from({ length: capacity }, (_, index) => ({
            connected: Boolean(roomStatus.roles[`p${index + 1}` as RoomRole]?.connected),
            ready: Boolean(gameState?.ready?.[index]),
        }));
    }, [roomStatus, identity, gameState?.ready]);

    // Any other seat with a connected player counts as "Mitspieler verbunden".
    const opponentConnected = playerStatuses.some((status, index) => index !== playerIndex && status.connected);

    useEffect(() => {
        if (roomStatus && roomStatus.capacity >= 2 && roomStatus.capacity <= 6) {
            setPlayerCount(roomStatus.capacity);
        }
    }, [roomStatus]);

    // A string key keeps the filter stable across state updates (new arrays on every roll).
    const playerNamesKey = (gameState?.playerNames ?? []).join("\n");
    const historyFilter = useMemo((): HistoryQuery => {
        const playerNames = playerNamesKey.split("\n").map((name) => name.trim()).filter(Boolean);
        if (playerNames.length >= 2) {
            return { players: playerNames, limit: 50, mode: "exact" };
        }
        const me = identity?.name?.trim();
        if (me) {
            return { players: [me], limit: 50, mode: "contains" };
        }
        return { limit: 50 };
    }, [playerNamesKey, identity?.name]);

    const fetchHistory = useCallback(async () => {
        setHistoryLoading(true);
        const params = new URLSearchParams();
        if (historyFilter.players?.length) params.set("players", historyFilter.players.join(","));
        if (historyFilter.limit) params.set("limit", String(historyFilter.limit));
        if (historyFilter.mode) params.set("mode", historyFilter.mode);
        try {
            const response = await fetch(historyUrl(params));
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = (await response.json()) as { history: HistoryEntry[] };
            setHistory(data.history);
            cacheHistory(data.history);
            setHistoryLoading(false);
        } catch {
            // Fall back to the WebSocket; the "history" handler ends the loading state.
            if (socketRef.current?.connected) {
                socketRef.current.emit("request-history", historyFilter);
            } else {
                setHistoryLoading(false);
            }
        }
    }, [historyFilter]);

    useEffect(() => {
        if (historyOpen) void fetchHistory();
    }, [historyOpen, fetchHistory]);

    // Refresh the (personalised) history whenever the set of players changes.
    useEffect(() => {
        void fetchHistory();
    }, [fetchHistory]);

    const displayNames: string[] = gameState?.playerNames?.length
        ? gameState.playerNames.map((name, index) => name || defaultName(index))
        : [defaultName(0), defaultName(1)];

    const localReady = playerIndex !== null && gameState?.ready ? Boolean(gameState.ready[playerIndex]) : false;

    const finalScores: number[] | null = useMemo(
        () => (gameState ? gameState.scoreSheets.map(totalScore) : null),
        [gameState],
    );

    const winner = useMemo(() => {
        if (!gameState || gameState.phase !== "finished" || !finalScores) return null;
        return determineWinner(gameState.playerNames, finalScores);
    }, [finalScores, gameState]);

    const isCurrentPlayer = Boolean(
        gameState &&
        playerIndex !== null &&
        gameState.phase === "playing" &&
        gameState.currentPlayer === playerIndex,
    );

    const previewScores = useMemo(() => {
        if (!gameState || !isCurrentPlayer || playerIndex === null) return null;
        return scoreAllCategories(gameState.dice);
    }, [gameState, isCurrentPlayer, playerIndex]);

    const startDisabled = !identity || connectionPhase !== "matched" || playerIndex === null;

    const topBarHint = getTopBarHint(connectionPhase, gameState?.phase ?? null, opponentConnected);

    const setupStatusMessage = getSetupStatusMessage({
        connectionPhase,
        opponentConnected,
        localReady,
        opponentReady: playerStatuses.some((status, index) => index !== playerIndex && status.ready),
    });

    const historyGames = useMemo(() => transformHistoryEntries(history), [history]);

    /** Sends a game action, or explains why nothing happens while the connection is down. */
    function sendAction(send: (socket: AppSocket) => void): boolean {
        const current = socketRef.current;
        if (!current?.connected) {
            showToast("Keine Verbindung – einen Moment, sie wird wiederhergestellt …");
            return false;
        }
        send(current);
        return true;
    }

    function handleStart() {
        if (playerIndex === null || !identity) return;
        sendAction((socket) => socket.emit("ready"));
    }

    function handleRoll() {
        if (sendAction((socket) => socket.emit("roll"))) setIsRolling(true);
    }

    function handleToggleHold(index: number) {
        sendAction((socket) => socket.emit("toggle-hold", { index }));
    }

    function handleChoose(category: Category) {
        sendAction((socket) => socket.emit("choose", { category }));
    }

    function handleReset() {
        sendAction((socket) => socket.emit("reset"));
    }

    function handleShowHistory() {
        setHistoryOpen(true);
    }

    function handleCloseHistory() {
        setHistoryOpen(false);
    }

    function handleRefreshHistory() {
        void fetchHistory();
    }

    // Before anyone has a seat, the first visitor sets the player count in the seat dialog.
    const tableIsEmpty = Boolean(roomStatus) && !Object.values(roomStatus!.roles).some((role) => role?.occupied);
    const canChangePlayerCount = gameState?.phase === "setup" && (identity !== null || tableIsEmpty);

    function handlePlayerCountChange(next: number) {
        if (!canChangePlayerCount) return;
        if (sendAction((socket) => socket.emit("room:setCapacity", { capacity: next }))) setPlayerCount(next);
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
            const isSelf = index === playerIndex;
            return { name: name || defaultName(index), connected, ready, isSelf };
        });
    }

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
                    <SetupScreen
                        playerCount={playerCount}
                        onPlayerCountChange={handlePlayerCountChange}
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
        // Only celebrate the moment a game ends, not when (re)loading a finished game.
        if (previousPhaseRef.current === "playing" && currentPhase === "finished" && finalScores) {
            soundManager.gameWin();
            const maxScore = Math.max(...finalScores);
            if (maxScore > 0) {
                showToast(
                    winner === null
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

                <main className="flex flex-1 flex-col items-center pb-[calc(var(--autumn-bottom-breath)+env(safe-area-inset-bottom,0px))]">
                    {phaseContent}
                </main>

                <StatusToast message={toastMessage} isVisible={Boolean(toastMessage)} />

                <HistoryModal
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
                    onPlayerCountChange={canChangePlayerCount ? handlePlayerCountChange : undefined}
                />

                <AlertDialog open={isHelpOpen} onOpenChange={setIsHelpOpen}>
                    <AlertDialogContent className="border-2 border-orange-500/30 bg-[#3d2549] text-amber-100">
                        <AlertDialogHeader>
                            <AlertDialogTitle className="text-orange-300">So wird gespielt 🎲</AlertDialogTitle>
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
