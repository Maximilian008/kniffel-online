import { MAX_PLAYERS, type GameState, type HistoryEntry } from "./types";

/**
 * Messages exchanged over the WebSocket at /api/ws. Every frame is JSON: { type, data }.
 * The plain-text frame "ping" is answered with "pong" to keep the connection alive.
 */

export const WS_PATH = "/api/ws";
export const HISTORY_PATH = "/api/history";
export const PING = "ping";
export const PONG = "pong";

/** A disconnected player keeps their seat this long before someone else may take it. */
export const SEAT_RELEASE_GRACE_MS = 120_000;

export type Role = "p1" | "p2" | "p3" | "p4" | "p5" | "p6";
export const ROLES: readonly Role[] = ["p1", "p2", "p3", "p4", "p5", "p6"];

export function seatToRole(seat: number): Role {
  return ROLES[Math.max(0, Math.min(MAX_PLAYERS - 1, seat))];
}

export function roleToSeat(role: unknown): number | null {
  const index = ROLES.indexOf(role as Role);
  return index >= 0 ? index : null;
}

export interface RoleStatus {
  role: Role;
  name: string | null;
  occupied: boolean;
  connected: boolean;
  /** When a disconnected player's seat becomes free for others (epoch ms), otherwise null. */
  releaseDeadline: number | null;
}

export interface RoomStatus {
  roomId: string;
  capacity: number;
  roles: Partial<Record<Role, RoleStatus>>;
}

export interface RoleConfirmed {
  roomId: string;
  role: Role;
  name: string;
  playerIndex: number;
}

export type HistoryMode = "exact" | "contains";

export interface HistoryQuery {
  players?: string[];
  mode?: HistoryMode;
  limit?: number;
}

export interface ServerEvents {
  "room:status": RoomStatus;
  state: GameState;
  "room:roleConfirmed": RoleConfirmed;
  "room:roleDenied": { reason: string };
  "room:roleRevoked": { reason?: string };
  "action-denied": { message: string };
  history: HistoryEntry[];
}

export interface ClientEvents {
  "room:status": undefined;
  "room:claimRole": { role: Role; name: string; playerId: string };
  "room:releaseRole": undefined;
  "room:setCapacity": { capacity: number };
  /** Omitted or true: ready; { ready: false } takes it back. */
  ready: { ready: boolean } | undefined;
  "room:freeSeat": { role: Role };
  roll: undefined;
  "toggle-hold": { index: number };
  choose: { category: string };
  reset: undefined;
  "request-history": HistoryQuery | undefined;
}

export interface Envelope {
  type: string;
  data?: unknown;
}
