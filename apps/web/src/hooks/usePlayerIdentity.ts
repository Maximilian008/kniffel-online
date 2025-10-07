import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AppSocket,
  RoleConfirmedPayload,
  RoleDeniedPayload,
  RoleRevokedPayload,
  RoomRole,
  RoomStatusPayload,
} from "../lib/socket";

const PLAYER_SESSION_KEY = "kniffel-player-session";

export type PlayerSession = {
  role: RoomRole;
  name: string;
  sessionId: string;
  timestamp: number;
};

export type Identity = {
  role: RoomRole;
  name: string;
};

type SessionState = "loading" | "no_session" | "restoring" | "active" | "conflict";

type UsePlayerIdentityResult = {
  identity: Identity | null;
  status: RoomStatusPayload | null;
  sessionState: SessionState;
  isModalOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
  claimRole: (role: RoomRole, name: string) => void;
  releaseRole: () => void;
  resetSession: () => void;
  isClaiming: RoomRole | null;
  error: string | null;
  clearError: () => void;
  suggestedName: string;
};

export function usePlayerIdentity(socket: AppSocket | null): UsePlayerIdentityResult {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [status, setStatus] = useState<RoomStatusPayload | null>(null);
  const [sessionState, setSessionState] = useState<SessionState>("loading");
  const [isModalOpen, setModalOpen] = useState(false);
  const [isClaiming, setIsClaiming] = useState<RoomRole | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [suggestedName, setSuggestedName] = useState("");

  const sessionRef = useRef<PlayerSession | null>(null);
  const restorationAttempted = useRef(false);

  // Initialize session on mount
  useEffect(() => {
    const savedSession = readPlayerSession();
    sessionRef.current = savedSession;

    if (savedSession) {
      setSuggestedName(savedSession.name);
      setSessionState("restoring");
    } else {
      setSessionState("no_session");
      setModalOpen(true);
    }
  }, []);

  // Socket event handlers
  const attemptSessionRestore = useCallback((roomStatus: RoomStatusPayload) => {
    if (!sessionRef.current || !socket) return;

    const session = sessionRef.current;
    const slot = roomStatus.roles[session.role];

    // Check if slot is available or occupied by us
    if (!slot.occupied || (slot.name && equalsIgnoreCase(slot.name, session.name))) {
      setIsClaiming(session.role);
      socket.emit("room:claimRole", {
        role: session.role,
        name: session.name,
      });
    } else {
      // Slot is occupied by someone else, session conflict
      setSessionState("conflict");
      setModalOpen(true);
      setSuggestedName(session.name);
    }
  }, [socket]);

  useEffect(() => {
    if (!socket) return;

    const handleStatus = (payload: RoomStatusPayload) => {
      setStatus(payload);

      // Try to restore session if we have one but no identity yet
      if (sessionState === "restoring" && !identity && sessionRef.current && !restorationAttempted.current) {
        restorationAttempted.current = true;
        attemptSessionRestore(payload);
      }
    };

    const handleRoleConfirmed = (payload: RoleConfirmedPayload) => {
      const newIdentity: Identity = { role: payload.role, name: payload.name };
      setIdentity(newIdentity);
      setIsClaiming(null);
      setError(null);
      setModalOpen(false);
      setSessionState("active");

      // Save new session
      const newSession: PlayerSession = {
        role: payload.role,
        name: payload.name,
        sessionId: generateSessionId(),
        timestamp: Date.now(),
      };
      sessionRef.current = newSession;
      savePlayerSession(newSession);
    };

    const handleRoleDenied = (payload: RoleDeniedPayload) => {
      setError(payload?.reason ?? "Rolle kann nicht reserviert werden.");
      setIsClaiming(null);

      if (sessionState === "restoring") {
        // Session restore failed, show modal for new session
        setSessionState("conflict");
        setModalOpen(true);
        setSuggestedName(sessionRef.current?.name ?? "");
      } else if (!identity) {
        setModalOpen(true);
      }
    };

    const handleRoleRevoked = (_payload: RoleRevokedPayload) => {
      setIdentity(null);
      setIsClaiming(null);
      setSessionState("conflict");
      setModalOpen(true);
      setSuggestedName(sessionRef.current?.name ?? "");
    };

    const handleConnect = () => {
      socket.emit("room:status");
    };

    socket.on("room:status", handleStatus);
    socket.on("room:roleConfirmed", handleRoleConfirmed);
    socket.on("room:roleDenied", handleRoleDenied);
    socket.on("room:roleRevoked", handleRoleRevoked);
    socket.on("connect", handleConnect);

    handleConnect();

    return () => {
      socket.off("room:status", handleStatus);
      socket.off("room:roleConfirmed", handleRoleConfirmed);
      socket.off("room:roleDenied", handleRoleDenied);
      socket.off("room:roleRevoked", handleRoleRevoked);
      socket.off("connect", handleConnect);
    };
  }, [socket, identity, sessionState, attemptSessionRestore]);

  // Helper functions
  const claimRole = useCallback(
    (role: RoomRole, name: string) => {
      if (!socket) return;
      const normalized = normaliseName(name);
      if (!normalized) {
        setError("Name darf nicht leer sein.");
        return;
      }
      setSuggestedName(normalized);
      setIsClaiming(role);
      setError(null);
      socket.emit("room:claimRole", { role, name: normalized });
    },
    [socket]
  );

  const releaseRole = useCallback(() => {
    if (!socket || !identity) return;
    socket.emit("room:releaseRole");
    setIdentity(null);
    setIsClaiming(null);
    setSessionState("no_session");
    setModalOpen(true);
    sessionRef.current = null;
    clearPlayerSession();
    setSuggestedName("");
  }, [socket, identity]);

  const resetSession = useCallback(() => {
    if (socket && identity) {
      socket.emit("room:releaseRole");
    }
    setIdentity(null);
    setIsClaiming(null);
    setSessionState("no_session");
    setModalOpen(true);
    sessionRef.current = null;
    clearPlayerSession();
    setSuggestedName("");
    setError(null);
    restorationAttempted.current = false;
  }, [socket, identity]);

  const openModal = useCallback(() => {
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    if (identity) {
      setModalOpen(false);
    }
  }, [identity]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    identity,
    status,
    sessionState,
    isModalOpen,
    openModal,
    closeModal,
    claimRole,
    releaseRole,
    resetSession,
    isClaiming,
    error,
    clearError,
    suggestedName,
  };
}

// Session management functions
function readPlayerSession(): PlayerSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PLAYER_SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as PlayerSession;

    // Check if session is not too old (24 hours)
    if (Date.now() - session.timestamp > 24 * 60 * 60 * 1000) {
      clearPlayerSession();
      return null;
    }

    return session;
  } catch {
    clearPlayerSession();
    return null;
  }
}

function savePlayerSession(session: PlayerSession) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PLAYER_SESSION_KEY, JSON.stringify(session));
}

function clearPlayerSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(PLAYER_SESSION_KEY);
}

function generateSessionId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

function normaliseName(value: string): string {
  return value.trim().replace(/\s+/g, " ").slice(0, 40);
}

function equalsIgnoreCase(a: string, b: string): boolean {
  return a.localeCompare(b, undefined, { sensitivity: "accent" }) === 0;
}
