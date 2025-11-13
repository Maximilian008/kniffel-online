import type { GameState } from "../types/shared.js";

export const ROLES = ["p1", "p2", "p3", "p4", "p5", "p6"] as const;
export type Role = (typeof ROLES)[number];

export interface PlayerSlot {
    role: Role;
    index: number;
    name: string;
    playerId: string | null;
    socketId: string | null;
    connected: boolean;
    releaseTimer: NodeJS.Timeout | null;
    releaseDeadline: number | null;
}

export interface GameRoom {
    id: string;
    state: GameState;
    createdAt: number;
    capacity: number;
    players: Partial<Record<Role, PlayerSlot>>;
    meta: {
        hostId: string | null;
    };
    tokens: [string, string];
}

export type RoomId = string;

export function indexFromRole(role: Role): number {
    return Number(role.slice(1)) - 1;
}

export function roleByIndex(index: number): Role {
    const clamped = Math.max(0, Math.min(ROLES.length - 1, index));
    return ROLES[clamped];
}

export type RoomStatusPayloadRole = {
    role: Role;
    name: string | null;
    occupied: boolean;
    connected: boolean;
    playerId: string | null;
    isHost: boolean;
    releaseDeadline: number | null;
};

export type RoomStatusPayload = {
    roomId: RoomId;
    capacity: number;
    hostId: string | null;
    roles: Partial<Record<Role, RoomStatusPayloadRole>>;
};

export type RoleAssignment = {
    roomId: RoomId;
    role: Role;
};
