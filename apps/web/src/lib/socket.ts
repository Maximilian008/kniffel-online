import { io, type Socket } from "socket.io-client";

export type RoomRole = "p1" | "p2" | "p3" | "p4" | "p5" | "p6";

export type RoleStatus = {
  role: RoomRole;
  name: string | null;
  occupied: boolean;
  connected: boolean;
  playerId: string | null;
  isHost: boolean;
  releaseDeadline: number | null;
};

export type RoomStatusPayload = {
  roomId: string;
  capacity: number; // 2..6
  hostId: string | null;
  roles: Partial<Record<RoomRole, RoleStatus>>;
};

export type RoleConfirmedPayload = {
  roomId: string;
  role: RoomRole;
  name: string;
  playerIndex: number; // 0..N-1
  playerId: string | null;
};

export type RoleDeniedPayload = {
  reason: string;
};

export type RoleRevokedPayload = {
  reason?: string;
};

export type OpponentStatusPayload = {
  connected: boolean;
};

export type AppSocket = Socket;

export const ROLE_LABELS: Record<RoomRole, string> = {
  p1: "Spieler 1",
  p2: "Spieler 2",
  p3: "Spieler 3",
  p4: "Spieler 4",
  p5: "Spieler 5",
  p6: "Spieler 6",
};

const DEFAULT_SOCKET_URL = "http://localhost:3000";
const RECONNECTION_DELAY_MS = 1_000;
const RECONNECTION_DELAY_MAX_MS = 5_000;
const CONNECTION_TIMEOUT_MS = 20_000;

const SOCKET_DISABLED =
  import.meta.env.VITE_NEW_START_FLOW === "1" || import.meta.env.VITE_DISABLE_SOCKETS === "1";

export function createSocket(url?: string): AppSocket | null {
  if (SOCKET_DISABLED) {
    return null;
  }
  // Use provided URL, or fallback to default for server-side rendering
  const target = url ?? DEFAULT_SOCKET_URL;

  return io(target, {
    transports: ["websocket", "polling"],
    withCredentials: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: RECONNECTION_DELAY_MS,
    reconnectionDelayMax: RECONNECTION_DELAY_MAX_MS,
    timeout: CONNECTION_TIMEOUT_MS,
    autoConnect: true,
    forceNew: false,
  });
}

export { SOCKET_DISABLED };
