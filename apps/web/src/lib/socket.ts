import { io, type Socket } from "socket.io-client";

export type RoomRole = "p1" | "p2";

export type RoleStatus = {
  role: RoomRole;
  name: string | null;
  occupied: boolean;
  connected: boolean;
  releaseDeadline: number | null;
};

export type RoomStatusPayload = {
  roomId: string;
  roles: Record<RoomRole, RoleStatus>;
};

export type RoleConfirmedPayload = {
  roomId: string;
  role: RoomRole;
  name: string;
  playerIndex: 0 | 1;
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
};

const DEFAULT_SOCKET_URL = "http://localhost:3000";
const RECONNECTION_DELAY_MS = 1_000;
const RECONNECTION_DELAY_MAX_MS = 5_000;
const CONNECTION_TIMEOUT_MS = 20_000;

export function createSocket(url?: string): AppSocket {
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
