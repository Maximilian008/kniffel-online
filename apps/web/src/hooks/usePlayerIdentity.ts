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
 * Seat handling for this tab. A random player id (kept in sessionStorage, so every tab is its
 * own player) identifies the tab to the server. After a reload or a dropped connection the seat
 * is claimed again automatically; a new tab or browser rejoins by name once the old one is gone.
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
  /** True while an automatic rejoin is pending; its denial is expected and needs no error text. */
  const autoClaimRef = useRef(false);
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
      autoClaimRef.current = true;
      socket.emit("room:claimRole", { role: session.role, name: session.name, playerId: playerIdRef.current });
    };

    const handleStatus = (payload: RoomStatusPayload) => setStatus(payload);

    const handleRoleConfirmed = (payload: RoleConfirmedPayload) => {
      autoClaimRef.current = false;
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
      // e.g. a second tab finds its last seat taken by the first one: just ask for a seat.
      if (!autoClaimRef.current) setError(payload?.reason ?? "Platz kann nicht reserviert werden.");
      autoClaimRef.current = false;
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
      autoClaimRef.current = false;
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

function storage(kind: "localStorage" | "sessionStorage" = "localStorage"): Storage | null {
  try {
    return window[kind];
  } catch {
    return null;
  }
}

/** The tab's own seat wins; the browser-wide copy lets a new tab or a restarted browser rejoin. */
function readPlayerSession(): PlayerSession | null {
  try {
    const raw = storage("sessionStorage")?.getItem(PLAYER_SESSION_KEY) ?? storage()?.getItem(PLAYER_SESSION_KEY);
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
  const raw = JSON.stringify(session);
  try {
    storage("sessionStorage")?.setItem(PLAYER_SESSION_KEY, raw);
    storage()?.setItem(PLAYER_SESSION_KEY, raw);
  } catch {
    // private mode: the seat simply is not restored after a reload
  }
}

function clearPlayerSession() {
  try {
    storage("sessionStorage")?.removeItem(PLAYER_SESSION_KEY);
    storage()?.removeItem(PLAYER_SESSION_KEY);
  } catch {
    // ignore
  }
}

function readOrCreatePlayerId(): string {
  const existing = storage("sessionStorage")?.getItem(PLAYER_ID_KEY);
  if (existing && /^[A-Za-z0-9_-]{8,64}$/.test(existing)) return existing;
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const id = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  try {
    storage("sessionStorage")?.setItem(PLAYER_ID_KEY, id);
  } catch {
    // without storage the id lives for this page load only
  }
  return id;
}
