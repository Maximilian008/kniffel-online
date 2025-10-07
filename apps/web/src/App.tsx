import { scoreAllCategories } from "./utils/gameRules";
import type {
  Category,
  GamePhase,
  HistoryEntry,
  PlayerIndex,
  SerializedGameState,
} from "./types/shared";
import { useEffect, useMemo, useRef, useState } from "react";

import GameScreen from "./components/GameScreen";
import HistoryPanel from "./components/HistoryPanel";
import ResultScreen from "./components/ResultScreen";
import RoleSelectModal from "./components/RoleSelectModal";
import SetupScreen from "./components/SetupScreen";
import { usePlayerIdentity } from "./hooks/usePlayerIdentity";
import { createSocket, ROLE_LABELS, type AppSocket, type OpponentStatusPayload } from "./lib/socket";

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

type ConnectionPhase = "connecting" | "waiting" | "matched";

function defaultName(index: PlayerIndex) {
  return index === 0 ? "Player 1" : "Player 2";
}

function calculateFinalScore(sheet: Record<Category, number | undefined>) {
  const upper = UPPER_CATEGORIES.reduce(
    (sum, category) => sum + (sheet[category] ?? 0),
    0
  );
  const lower = LOWER_CATEGORIES.reduce(
    (sum, category) => sum + (sheet[category] ?? 0),
    0
  );
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

function cacheHistory(history: HistoryEntry[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(HISTORY_CACHE_KEY, JSON.stringify(history));
}

export default function App() {
  const socketRef = useRef<AppSocket | null>(null);

  const [socket, setSocket] = useState<AppSocket | null>(null);
  const [connectionPhase, setConnectionPhase] = useState<ConnectionPhase>("connecting");
  const [gameState, setGameState] = useState<SerializedGameState | null>(null);
  const [opponentConnected, setOpponentConnected] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistoryCache);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [localNameDraft, setLocalNameDraft] = useState("");
  const [isEditingName, setIsEditingName] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [isRolling, setIsRolling] = useState(false);

  const socketUrl = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    // In development, use proxy. In production, use VITE_SOCKET_URL or current origin
    const envUrl = import.meta.env.VITE_SOCKET_URL as string | undefined;
    if (envUrl) return envUrl;
    // Development: use current origin (proxy will handle it)
    // Production: use current origin
    return window.location.origin;
  }, []);

  useEffect(() => {
    const instance = createSocket(socketUrl);
    socketRef.current = instance;
    setSocket(instance);

    instance.on("connect", () => {
      // Don't immediately set to "matched" - wait for identity confirmation
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
    });

    instance.on("action-denied", ({ message }: { message?: string }) => {
      if (message) {
        setNotification(message);
        window.setTimeout(() => setNotification(null), 2500);
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
  }, [socketUrl]);

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
    resetSession,
    isClaiming,
    error: roleError,
    clearError,
    suggestedName,
  } = identityApi;

  const playerIndex = identity ? (identity.role === "p1" ? 0 : 1) : null;
  const playerNumber = playerIndex !== null ? ((playerIndex + 1) as 1 | 2) : null;

  // Update connection phase based on session state and socket status
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
      // Don't show any UI while session is being restored
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
      return;
    }
    if (!roomStatus) return;
    const opponentRole = identity.role === "p1" ? "p2" : "p1";
    const opponentSlot = roomStatus.roles[opponentRole];
    setOpponentConnected(Boolean(opponentSlot?.connected));
  }, [roomStatus, identity]);

  useEffect(() => {
    if (!historyOpen) return;
    fetchHistory().catch(() => {
      socketRef.current?.emit("request-history");
    });
  }, [historyOpen]);

  async function fetchHistory() {
    try {
      const response = await fetch("/api/history");
      if (!response.ok) return;
      const data = (await response.json()) as { history: HistoryEntry[] };
      setHistory(data.history);
      cacheHistory(data.history);
    } catch {
      // Ignored, socket fallback can update history later
    }
  }

  const localPlaceholder =
    identity?.name ?? (playerIndex !== null ? defaultName(playerIndex) : "Dein Name");
  const localNameTrimmed = localNameDraft.trim();
  const localNameValid = localNameTrimmed.length > 0;
  const canEditName = Boolean(identity);

  function submitName(name: string) {
    if (!socketRef.current || playerIndex === null || !identity) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    socketRef.current.emit("set-name", { name: trimmed });
  }

  function handleNameFocus() {
    if (!canEditName) return;
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
    // Reset game state on server
    socketRef.current?.emit("reset");
    // Reset player session for new game
    resetSession();
  }

  function handleShowHistory() {
    setHistoryOpen(true);
  }

  function handleCloseHistory() {
    setHistoryOpen(false);
  }

  function handleRefreshHistory() {
    fetchHistory().catch(() => {
      socketRef.current?.emit("request-history");
    });
  }

  const opponentIndex =
    playerIndex !== null ? ((playerIndex === 0 ? 1 : 0) as PlayerIndex) : null;
  const displayNames: [string, string] = [
    gameState?.playerNames[0] || defaultName(0),
    gameState?.playerNames[1] || defaultName(1),
  ];

  const opponentName = opponentIndex !== null ? displayNames[opponentIndex] : "Opponent";

  const localReady =
    playerIndex !== null && gameState?.ready ? gameState.ready[playerIndex] : false;

  const opponentReady =
    opponentIndex !== null && gameState?.ready ? gameState.ready[opponentIndex] : false;

  const effectiveConnectionPhase: ConnectionPhase =
    connectionPhase === "matched" && !opponentConnected ? "waiting" : connectionPhase;

  const finalScores: [number, number] | null = gameState
    ? [
      calculateFinalScore(gameState.scoreSheets[0] as Record<Category, number | undefined>),
      calculateFinalScore(gameState.scoreSheets[1] as Record<Category, number | undefined>),
    ]
    : null;

  const winner = useMemo(() => {
    if (!gameState || gameState.phase !== "finished" || !finalScores) return "";
    if (finalScores[0] > finalScores[1]) return gameState.playerNames[0] || defaultName(0);
    if (finalScores[1] > finalScores[0]) return gameState.playerNames[1] || defaultName(1);
    return "Draw";
  }, [finalScores, gameState]);

  const isCurrentPlayer = Boolean(
    gameState &&
    playerNumber &&
    gameState.phase === "playing" &&
    gameState.currentPlayer === playerNumber
  );

  const previewScores = useMemo(() => {
    if (!gameState || !isCurrentPlayer || playerIndex === null) return null;
    return scoreAllCategories(gameState.dice);
  }, [gameState, isCurrentPlayer, playerIndex]);

  const startDisabled =
    !identity || !localNameValid || effectiveConnectionPhase !== "matched" || playerIndex === null;

  return (
    <div className="app-shell">
      {identity && (
        <div
          style={{
            position: "fixed",
            top: 24,
            right: 24,
            display: "flex",
            gap: "8px",
            zIndex: 60,
          }}
        >
          <button
            type="button"
            className="btn btn-ghost"
            onClick={openModal}
            title="Rolle wechseln"
          >
            {ROLE_LABELS[identity.role]} - {identity.name}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={releaseRole}
            title="Reservierung aufheben"
          >
            Abmelden
          </button>
        </div>
      )}
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

      {historyOpen && (
        <HistoryPanel
          history={history}
          onClose={handleCloseHistory}
          onRefresh={handleRefreshHistory}
        />
      )}

      {notification && <div className="toast">{notification}</div>}

      {/* Don't show any UI while session is being restored */}
      {sessionState === "loading" || sessionState === "restoring" ? (
        <div className="loading-overlay">
          <div>Verbindung wird hergestellt...</div>
        </div>
      ) : (
        <>
          {!gameState && (
            <SetupScreen
              connectionPhase={effectiveConnectionPhase}
              localName={localNameDraft}
              localPlaceholder={localPlaceholder}
              onNameChange={handleNameChange}
              onNameFocus={handleNameFocus}
              onNameBlur={handleNameBlur}
              onStart={handleStart}
              onOpenHistory={handleShowHistory}
              canEdit={canEditName}
              opponentConnected={opponentConnected}
              opponentReady={opponentReady}
              localReady={localReady}
              startDisabled={startDisabled}
            />
          )}

          {gameState && gameState.phase === "setup" && (
            <SetupScreen
              connectionPhase={effectiveConnectionPhase}
              localName={localNameDraft}
              localPlaceholder={localPlaceholder}
              onNameChange={handleNameChange}
              onNameFocus={handleNameFocus}
              onNameBlur={handleNameBlur}
              onStart={handleStart}
              onOpenHistory={handleShowHistory}
              canEdit={canEditName}
              opponentConnected={opponentConnected}
              opponentReady={opponentReady}
              localReady={localReady}
              startDisabled={startDisabled}
              opponentName={opponentName}
            />
          )}

          {gameState && gameState.phase === "playing" && playerIndex !== null && (
            <GameScreen
              state={gameState}
              playerIndex={playerIndex}
              names={displayNames}
              isCurrentPlayer={isCurrentPlayer}
              isRolling={isRolling}
              previewScores={previewScores}
              onRoll={handleRoll}
              onToggleHold={handleToggleHold}
              onChooseCategory={handleChoose}
              onReset={handleReset}
              onOpenHistory={handleShowHistory}
              opponentConnected={opponentConnected}
            />
          )}

          {gameState && gameState.phase === "finished" && (
            <ResultScreen
              state={gameState}
              scores={finalScores ?? [0, 0]}
              winner={winner}
              onReset={handleReset}
              onOpenHistory={handleShowHistory}
            />
          )}
        </>
      )}
    </div>
  );
}















