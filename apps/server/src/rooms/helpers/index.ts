import type { Server as SocketIOServer } from "socket.io";

import {
    deriveScores,
    deriveWinner,
    listHistory,
    saveGame,
    toPersistedGame,
} from "../../db.js";
import type { Category, Dice, GameState } from "../../types/shared.js";
import { MAX_ROLLS_PER_TURN } from "../../types/shared.js";
import { rollDice } from "../../utils/gameRules.js";
import { createInitialState, serializeGameState } from "../GameRoom.js";
import {
    roleByIndex,
    type GameRoom,
    type PlayerSlot,
    type Role,
    type RoleAssignment,
    type RoomStatusPayload,
    type RoomStatusPayloadRole,
} from "../types.js";

export type Logger = (level: "info" | "warn" | "error", message: string, meta?: unknown) => void;

export type RoleReleaseOptions = {
    notify?: boolean;
};

type PersistDeps = {
    io: SocketIOServer;
    log: Logger;
    touchRoom?: (roomId: string) => void;
};

type ReleaseDeps = PersistDeps & {
    assignments: Map<string, RoleAssignment>;
};

function clearReleaseTimer(slot: PlayerSlot) {
    if (slot.releaseTimer) {
        clearTimeout(slot.releaseTimer);
    }
    slot.releaseTimer = null;
    slot.releaseDeadline = null;
}

function padArray<T>(source: T[], size: number, fill: T): T[] {
    const out = source.slice();
    while (out.length < size) out.push(fill);
    if (out.length > size) out.length = size;
    return out;
}

function padArrayWithFactory<T>(source: T[], size: number, factory: () => T): T[] {
    const out = source.slice();
    while (out.length < size) out.push(factory());
    if (out.length > size) out.length = size;
    return out;
}

export function startMatch(room: GameRoom): void {
    const state = room.state;
    state.phase = "playing";
    state.gameOver = false;
    state.dice = rollDice() as Dice;
    state.held = [false, false, false, false, false];
    state.rollsLeft = MAX_ROLLS_PER_TURN - 1;
    state.currentPlayer = 0;
    const n = room.capacity;
    state.ready = Array.from({ length: n }, () => false);
    state.playerNames = padArray(state.playerNames, n, "");
    state.scoreSheets = padArrayWithFactory(state.scoreSheets, n, () => ({}));
    state.usedCategories = padArrayWithFactory(state.usedCategories, n, () => new Set<Category>());
}

export function advanceTurn(state: GameState): void {
    state.dice = rollDice() as Dice;
    state.held = [false, false, false, false, false];
    state.rollsLeft = MAX_ROLLS_PER_TURN - 1;
    const totalPlayers = Math.max(1, state.playerNames.length);
    state.currentPlayer = (state.currentPlayer + 1) % totalPlayers;
}

export function resetRoom(room: GameRoom): void {
    const n = room.capacity;
    const preservedNames = room.state.playerNames.slice(0, n);
    room.state = createInitialState(n);
    for (let index = 0; index < n; index += 1) {
        room.state.playerNames[index] = preservedNames[index] ?? "";
    }
    room.createdAt = Date.now();
}

export function buildRoomStatus(room: GameRoom): RoomStatusPayload {
    const hostId = room.meta.hostId ?? null;
    const roles: Partial<Record<Role, RoomStatusPayloadRole>> = {};
    for (let index = 0; index < room.capacity; index += 1) {
        const role = roleByIndex(index);
        const slot = room.players[role];
        if (slot) roles[role] = buildRoleStatus(slot, hostId);
    }
    return {
        roomId: room.id,
        capacity: room.capacity,
        hostId,
        roles,
    };
}

function buildRoleStatus(slot: PlayerSlot, hostId: string | null): RoomStatusPayloadRole {
    const hasName = slot.name.trim().length > 0;
    return {
        role: slot.role,
        name: hasName ? slot.name : null,
        occupied: hasName,
        connected: slot.connected,
        playerId: slot.playerId,
        isHost: Boolean(slot.playerId) && slot.playerId === hostId,
        releaseDeadline: slot.releaseDeadline,
    };
}

export function emitRoomStatus(io: SocketIOServer, room: GameRoom): void {
    io.to(room.id).emit("room:status", buildRoomStatus(room));
}

export function broadcastState(io: SocketIOServer, room: GameRoom): void {
    const payload = serializeGameState(room.state);
    io.to(room.id).emit("state", payload);
    io.to(room.id).emit("phase", room.state.phase);
}

export function notifyConnectionStatus(io: SocketIOServer, room: GameRoom): void {
    for (let index = 0; index < room.capacity; index += 1) {
        const me = room.players[roleByIndex(index)];
        if (!me?.socketId) continue;

        const anyOther = (() => {
            for (let other = 0; other < room.capacity; other += 1) {
                if (other === index) continue;
                if (room.players[roleByIndex(other)]?.connected) return true;
            }
            return false;
        })();

        const target = io.sockets.sockets.get(me.socketId);
        target?.emit("opponent-status", { connected: anyOther });
    }
}

export function persistRoom(room: GameRoom, deps: PersistDeps): void {
    const { io, log, touchRoom } = deps;
    const serializedState = serializeGameState(room.state);
    const isFinished = room.state.phase === "finished";

    const gameId = isFinished ? `${room.id}-finished-${room.createdAt}` : room.id;
    const now = Date.now();

    const persistedGame = toPersistedGame({
        roomId: gameId,
        playerTokens: room.tokens,
        state: serializedState,
        createdAt: room.createdAt,
        updatedAt: now,
        capacity: room.capacity,
        meta: {
            hostId: room.meta.hostId ?? null,
        },
    });

    if (isFinished) {
        const scores = deriveScores(serializedState);
        const winner = deriveWinner(serializedState, scores);
        persistedGame.finishedAt = now;
        persistedGame.scores = scores;
        persistedGame.winner = winner;
    }

    saveGame(persistedGame);
    touchRoom?.(room.id);

    if (isFinished) {
        try {
            const history = listHistory(50);
            io.to(room.id).emit("history", history);
        } catch (error) {
            log("warn", "Failed to emit updated history after finish", error);
        }
    }
}

export function releaseSlot(
    room: GameRoom,
    role: Role,
    deps: ReleaseDeps,
    options: RoleReleaseOptions = {},
): void {
    const slot = room.players[role];
    if (!slot) return;

    clearReleaseTimer(slot);
    const previousPlayerId = slot.playerId;

    if (slot.socketId) {
        if (options.notify) {
            deps.io.sockets.sockets.get(slot.socketId)?.emit("room:roleRevoked");
        }
        deps.assignments.delete(slot.socketId);
    }

    slot.socketId = null;
    slot.connected = false;
    slot.releaseDeadline = null;
    slot.name = "";
    slot.playerId = null;

    room.state.playerNames[slot.index] = "";
    room.state.ready[slot.index] = false;

    if (previousPlayerId && room.meta.hostId === previousPlayerId) {
        room.meta.hostId = null;
    }

    persistRoom(room, deps);
    emitRoomStatus(deps.io, room);
    broadcastState(deps.io, room);
    notifyConnectionStatus(deps.io, room);
}
