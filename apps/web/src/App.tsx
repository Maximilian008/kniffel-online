import { useEffect, useMemo, useRef, useState } from "react";
import type {
  Category,
  GamePhase,
  HistoryEntry,
  PlayerIndex,
  SerializedGameState,
} from "./types/shared";
import { scoreAllCategories } from "./utils/gameRules";

import GameScreen from "./components/GameScreen";
import HelpModal from "./components/HelpModal";
import HistoryPanel from "./components/HistoryPanel";
import ResultScreen from "./components/ResultScreen";
import RoleSelectModal from "./components/RoleSelectModal";
import SetupScreen from "./components/SetupScreen";
import { usePlayerIdentity } from "./hooks/usePlayerIdentity";
import { createSocket, ROLE_LABELS, type AppSocket, type OpponentStatusPayload, type RoomRole } from "./lib/socket";

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
  return `Player ${index + 1}`;
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
  const [playerStatuses, setPlayerStatuses] = useState<Array<{ connected: boolean; ready: boolean }>>([]);
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistoryCache);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [localNameDraft, setLocalNameDraft] = useState("");
  const [isEditingName, setIsEditingName] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [playerCount, setPlayerCount] = useState<number>(2);

  // Resolve server base URLs for sockets and API
  const { socketUrl, apiBaseUrl } = useMemo(() => {
    if (typeof window === "undefined") return { socketUrl: undefined, apiBaseUrl: "" } as const;
    const isDev = import.meta.env.DEV;
    const envServer = (import.meta.env.VITE_SOCKET_URL as string | undefined)
      || (import.meta.env.VITE_SERVER_URL as string | undefined)
      || undefined;
    if (isDev) {
      // In dev we rely on Vite proxy, so use the current origin and relative API
      return { socketUrl: window.location.origin, apiBaseUrl: "" } as const;
    }
    // In production we expect an explicit backend URL; if missing, fall back to same-origin
    const resolved = envServer ?? window.location.origin;
    return { socketUrl: resolved, apiBaseUrl: resolved } as const;
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
    isClaiming,
    error: roleError,
    clearError,
    suggestedName,
  } = identityApi;

  const playerIndex = identity ? (Number(identity.role.slice(1)) - 1 || 0) : null;
  const playerNumber = playerIndex !== null ? playerIndex : null;

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
      setPlayerStatuses([]);
      return;
    }
    if (!roomStatus) return;
    const opponentRole = identity.role === "p1" ? "p2" : "p1";
    const opponentSlot = roomStatus.roles[opponentRole];
    setOpponentConnected(Boolean(opponentSlot?.connected));
    // Build per-player statuses from roles + ready state
    const n = Math.max(2, Math.min(6, roomStatus.capacity || 2));
    const statuses: Array<{ connected: boolean; ready: boolean }> = Array.from({ length: n }, (_, i) => {
      const role = (`p${i + 1}`) as keyof typeof roomStatus.roles;
      const s = roomStatus.roles[role];
      const connected = Boolean(s?.connected);
      const ready = Boolean(gameState?.ready?.[i]);
      return { connected, ready };
    });
    setPlayerStatuses(statuses);
    // Sync capacity to local playerCount for UI
    if (typeof roomStatus.capacity === "number" && roomStatus.capacity >= 2 && roomStatus.capacity <= 6) {
      setPlayerCount(roomStatus.capacity);
    }
  }, [roomStatus, identity, gameState?.ready]);

  useEffect(() => {
    if (!historyOpen) return;
    fetchHistory().catch(() => {
      const filter = getHistoryFilter();
      socketRef.current?.emit("request-history", filter);
    });
  }, [historyOpen]);

  // Build history filter based on current identity and known player names
  function getHistoryFilter(): { players?: string[]; limit?: number; mode?: "exact" | "contains" } {
    const pNames = (gameState?.playerNames ?? []).map((n) => (n ?? "").trim()).filter(Boolean);
    if (pNames.length >= 2) {
      return { players: pNames, limit: 50, mode: "exact" };
    }
    const me = identity?.name?.trim();
    if (me && me.length > 0) {
      return { players: [me], limit: 50, mode: "contains" };
    }
    return { limit: 50 };
  }

  async function fetchHistory() {
    try {
      const filter = getHistoryFilter();
      const params = new URLSearchParams();
      if (filter.players && filter.players.length > 0) {
        // Support API contract: players=comma,separated OR repeated param; we'll use comma-separated
        params.set("players", filter.players.join(","));
      }
      if (filter.limit) params.set("limit", String(filter.limit));
      if (filter.mode) params.set("mode", filter.mode);
      const base = apiBaseUrl ?? "";
      const url = `${base}/api/history${params.toString() ? `?${params.toString()}` : ""}`;
      const response = await fetch(url);
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
    // Do NOT reset the local session; keep roles and names for quick rematch
  }

  function handleShowHistory() {
    setHistoryOpen(true);
  }

  function handleCloseHistory() {
    setHistoryOpen(false);
  }

  function handleRefreshHistory() {
    fetchHistory().catch(() => {
      const filter = getHistoryFilter();
      socketRef.current?.emit("request-history", filter);
    });
  }

  // On identity/players change, proactively request filtered history once
  const lastHistoryKeyRef = useRef<string>("");
  useEffect(() => {
    const filter = getHistoryFilter();
    const key = JSON.stringify(filter);
    if (key === lastHistoryKeyRef.current) return;
    lastHistoryKeyRef.current = key;
    // Try fetch first; if it fails, fall back to socket
    fetchHistory().catch(() => {
      socketRef.current?.emit("request-history", filter);
    });
  }, [identity?.name, gameState?.playerNames?.[0], gameState?.playerNames?.[1]]);

  const displayNames: string[] = gameState?.playerNames?.length
    ? gameState.playerNames.map((n, i) => n || defaultName(i))
    : [defaultName(0), defaultName(1)];

  const localReady = playerIndex !== null && gameState?.ready ? Boolean(gameState.ready[playerIndex]) : false;

  const effectiveConnectionPhase: ConnectionPhase = connectionPhase;

  const finalScores: number[] | null = gameState
    ? gameState.scoreSheets.map((s) => calculateFinalScore(s as Record<Category, number | undefined>))
    : null;

  const winner = useMemo(() => {
    if (!gameState || gameState.phase !== "finished" || !finalScores) return "";
    const max = Math.max(...finalScores);
    const winners = finalScores.map((v, i) => (v === max ? (gameState.playerNames[i] || defaultName(i)) : null)).filter(Boolean) as string[];
    return winners.length === 1 ? winners[0]! : "Draw";
  }, [finalScores, gameState]);

  const isCurrentPlayer = Boolean(
    gameState &&
    playerNumber !== null &&
    gameState.phase === "playing" &&
    gameState.currentPlayer === playerNumber
  );

  const previewScores = useMemo(() => {
    if (!gameState || !isCurrentPlayer || playerIndex === null) return null;
    return scoreAllCategories(gameState.dice);
  }, [gameState, isCurrentPlayer, playerIndex]);

  const startDisabled =
    !identity || !localNameValid || effectiveConnectionPhase !== "matched" || playerIndex === null;

  // Emit capacity changes during setup to server (no-op during playing/finished)
  // Emit capacity changes only on explicit user action to avoid race/flicker on join
  function handlePlayerCountChange(next: number) {
    setPlayerCount(next);
    if (!socketRef.current) return;
    if (!gameState || gameState.phase !== "setup") return;
    socketRef.current.emit("room:setCapacity", { capacity: next });
  }

  // Build players list for SetupScreen (names + online + ready)
  function getSetupPlayers(): Array<{ name: string; connected: boolean; ready: boolean; isSelf?: boolean }> | undefined {
    const cap = roomStatus?.capacity ?? 2;
    const names: string[] = (gameState?.playerNames ?? Array.from({ length: cap }, (_, i) => defaultName(i)))
      .map((n, i) => (n && n.trim().length > 0 ? n.trim() : defaultName(i)));
    if (!roomStatus) {
      // Without room status, we can't show connection state; omit list to keep fallback UI
      return undefined;
    }
    return names.map((name, i) => {
      const roleKey = (`p${i + 1}`) as RoomRole;
      const connected = Boolean(roomStatus.roles?.[roleKey]?.connected);
      const ready = Boolean(gameState?.ready?.[i]);
      const isSelf = identity ? (i === (Number(identity.role.slice(1)) - 1 || 0)) : false;
      return { name: name || defaultName(i), connected, ready, isSelf };
    });
  }

  return (
    <div className="app-shell">
      <div className="top-actions">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => setIsHelpOpen(true)}
          title="Hilfe anzeigen"
        >
          Hilfe
        </button>
        {identity && (
          <>
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
          </>
        )}
      </div>
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

      {isHelpOpen && (
        <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
      )}

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
              localReady={localReady}
              startDisabled={startDisabled}
              playerCount={playerCount}
              onPlayerCountChange={handlePlayerCountChange}
              players={getSetupPlayers()}
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
              opponentReady={false}
              localReady={localReady}
              startDisabled={startDisabled}
              playerCount={playerCount}
              onPlayerCountChange={handlePlayerCountChange}
              players={getSetupPlayers()}
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
              playerStatuses={playerStatuses}
            />
          )}

          {gameState && gameState.phase === "finished" && (
            <ResultScreen
              state={gameState}
              scores={finalScores ?? []}
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















