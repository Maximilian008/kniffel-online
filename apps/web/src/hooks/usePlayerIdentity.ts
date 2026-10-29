import { normaliseName } from "@kniffel/game";
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
const PLAYER_ID_KEY = "kniffel-player-id";
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/** The seat this browser last played on; used to rejoin automatically. */
export type PlayerSession = {
  role: RoomRole;
  name: string;
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
  isClaiming: RoomRole | null;
  error: string | null;
  clearError: () => void;
  suggestedName: string;
};

/**
 * Seat handling for this browser. A random player id (kept in localStorage) identifies the
 * browser to the server, so after a reload or a dropped connection the seat is claimed again
 * automatically.
 */
export function usePlayerIdentity(socket: AppSocket | null): UsePlayerIdentityResult {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [status, setStatus] = useState<RoomStatusPayload | null>(null);
  const [sessionState, setSessionState] = useState<SessionState>("loading");
  const [isModalOpen, setModalOpen] = useState(false);
  const [isClaiming, setIsClaiming] = useState<RoomRole | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [suggestedName, setSuggestedName] = useState("");

  const sessionRef = useRef<PlayerSession | null>(null);
  const identityRef = useRef<Identity | null>(null);
  const playerIdRef = useRef<string>("");
  identityRef.current = identity;

  useEffect(() => {
    playerIdRef.current = readOrCreatePlayerId();
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

  useEffect(() => {
    if (!socket) return;

    const rejoin = () => {
      const session = sessionRef.current;
      if (!session) return;
      setIsClaiming(session.role);
      if (!identityRef.current) setSessionState("restoring");
      socket.emit("room:claimRole", { role: session.role, name: session.name, playerId: playerIdRef.current });
    };

    const handleStatus = (payload: RoomStatusPayload) => setStatus(payload);

    const handleRoleConfirmed = (payload: RoleConfirmedPayload) => {
      setIdentity({ role: payload.role, name: payload.name });
      setIsClaiming(null);
      setError(null);
      setModalOpen(false);
      setSessionState("active");
      const session: PlayerSession = { role: payload.role, name: payload.name, timestamp: Date.now() };
      sessionRef.current = session;
      savePlayerSession(session);
    };

    const handleRoleDenied = (payload: RoleDeniedPayload) => {
      setError(payload?.reason ?? "Platz kann nicht reserviert werden.");
      setIsClaiming(null);
      if (!identityRef.current) {
        setSessionState(sessionRef.current ? "conflict" : "no_session");
        setSuggestedName(sessionRef.current?.name ?? "");
        setModalOpen(true);
      }
    };

    const handleRoleRevoked = (payload: RoleRevokedPayload) => {
      setIdentity(null);
      setIsClaiming(null);
      setSessionState("conflict");
      setError(payload?.reason ?? null);
      setSuggestedName(sessionRef.current?.name ?? "");
      sessionRef.current = null;
      clearPlayerSession();
      setModalOpen(true);
    };

    socket.on("room:status", handleStatus);
    socket.on("room:roleConfirmed", handleRoleConfirmed);
    socket.on("room:roleDenied", handleRoleDenied);
    socket.on("room:roleRevoked", handleRoleRevoked);
    socket.on("connect", rejoin);
    if (socket.connected) rejoin();

    return () => {
      socket.off("room:status", handleStatus);
      socket.off("room:roleConfirmed", handleRoleConfirmed);
      socket.off("room:roleDenied", handleRoleDenied);
      socket.off("room:roleRevoked", handleRoleRevoked);
      socket.off("connect", rejoin);
    };
  }, [socket]);

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
      socket.emit("room:claimRole", { role, name: normalized, playerId: playerIdRef.current });
    },
    [socket],
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

  const openModal = useCallback(() => setModalOpen(true), []);

  const closeModal = useCallback(() => {
    if (identity) setModalOpen(false);
  }, [identity]);

  const clearError = useCallback(() => setError(null), []);

  return {
    identity,
    status,
    sessionState,
    isModalOpen,
    openModal,
    closeModal,
    claimRole,
    releaseRole,
    isClaiming,
    error,
    clearError,
    suggestedName,
  };
}

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readPlayerSession(): PlayerSession | null {
  try {
    const raw = storage()?.getItem(PLAYER_SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as PlayerSession;
    if (!session?.role || !session.name || Date.now() - session.timestamp > SESSION_MAX_AGE_MS) {
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
  try {
    storage()?.setItem(PLAYER_SESSION_KEY, JSON.stringify(session));
  } catch {
    // private mode: the seat simply is not restored after a reload
  }
}

function clearPlayerSession() {
  try {
    storage()?.removeItem(PLAYER_SESSION_KEY);
  } catch {
    // ignore
  }
}

function readOrCreatePlayerId(): string {
  const existing = storage()?.getItem(PLAYER_ID_KEY);
  if (existing && /^[A-Za-z0-9_-]{8,64}$/.test(existing)) return existing;
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const id = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  try {
    storage()?.setItem(PLAYER_ID_KEY, id);
  } catch {
    // without storage the id lives for this page load only
  }
  return id;
}
