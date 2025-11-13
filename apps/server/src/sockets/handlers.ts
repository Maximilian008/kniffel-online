import type { Server as SocketIOServer, Socket } from "socket.io";

import { listHistory, listHistoryFiltered } from "../db.js";
import { scoreCategory, rollDice } from "../utils/gameRules.js";
import { normaliseName } from "../utils/names.js";
import { createPlayerSlot, serializeGameState } from "../rooms/GameRoom.js";
import type { InMemoryRoomStore } from "../rooms/RoomStore.js";
import {
    ROLES,
    roleByIndex,
    type GameRoom,
    type PlayerSlot,
    type Role,
} from "../rooms/types.js";
import {
    advanceTurn,
    buildRoomStatus,
    broadcastState,
    emitRoomStatus,
    notifyConnectionStatus,
    persistRoom,
    releaseSlot,
    resetRoom,
    startMatch,
    type Logger,
} from "../rooms/helpers/index.js";
import type { PlayerContext, SocketAssignment } from "./context.js";
import { withPlayerContext } from "./context.js";
import type { Category, Dice } from "../types/shared.js";

export type RoleClaimPayload = {
    roomId?: string;
    role?: Role;
    name?: string;
    playerId?: string;
};

type SocketData = {
    roomId?: string;
};

type RegisterSocketParams = {
    socket: Socket;
    io: SocketIOServer;
    roomStore: InMemoryRoomStore;
    assignments: Map<string, SocketAssignment>;
    log: Logger;
    defaultRoomId: string;
    roleReleaseTimeoutMs: number;
    touchRoom?: (roomId: string) => void;
};

export function registerSocketHandlers(params: RegisterSocketParams): void {
    const {
        socket,
        io,
        roomStore,
        assignments,
        log,
        defaultRoomId,
        roleReleaseTimeoutMs,
        touchRoom,
    } = params;

    const baseDeps = { io, log, touchRoom };
    const releaseDeps = { ...baseDeps, assignments };

    const resolveRoomId = (roomId?: string): string => {
        const trimmed = typeof roomId === "string" ? roomId.trim() : "";
        return trimmed.length > 0 ? trimmed : defaultRoomId;
    };

    const ensureRoom = (roomId?: string): GameRoom => {
        const id = resolveRoomId(roomId);
        const room = roomStore.ensure(id);
        if (!socket.rooms.has(id)) {
            socket.join(id);
        }
        (socket.data as SocketData).roomId = id;
        return room;
    };

    const cancelReleaseTimer = (slot: PlayerSlot) => {
        if (slot.releaseTimer) {
            clearTimeout(slot.releaseTimer);
        }
        slot.releaseTimer = null;
        slot.releaseDeadline = null;
    };

    const isHostPlayer = (ctx: PlayerContext): boolean => {
        const hostId = ctx.room.meta.hostId;
        if (!hostId) return true;
        return ctx.playerId !== null && ctx.playerId === hostId;
    };

    const requireHost = (ctx: PlayerContext): boolean => {
        if (isHostPlayer(ctx)) return true;
        socket.emit("action-denied", { message: "Nur der Host kann diese Aktion ausführen." });
        return false;
    };

    const handleRoleClaim = (payload: RoleClaimPayload = {}) => {
        const role = payload.role;
        if (!role || !ROLES.includes(role)) {
            socket.emit("room:roleDenied", { reason: "Ungueltige Rolle." });
            return;
        }

        if (typeof payload.name !== "string") {
            socket.emit("room:roleDenied", { reason: "Bitte gib einen Namen ein." });
            return;
        }

        const room = ensureRoom(payload.roomId);
        if (room.id !== defaultRoomId && socket.rooms.has(defaultRoomId)) {
            socket.leave(defaultRoomId);
        }
        const normalizedName = normaliseName(payload.name);
        if (!normalizedName) {
            socket.emit("room:roleDenied", { reason: "Name darf nicht leer sein." });
            return;
        }

        const rawPlayerId = typeof payload.playerId === "string" ? payload.playerId.trim() : "";
        let effectivePlayerId = rawPlayerId.length > 0 ? rawPlayerId : null;

        const slot = room.players[role];
        if (!slot) {
            socket.emit("room:roleDenied", { reason: "Ungueltige Rolle." });
            return;
        }

        const currentAssignment = assignments.get(socket.id);
        if (currentAssignment) {
            const previousRoom = roomStore.get(currentAssignment.roomId);
            if (previousRoom && (previousRoom.id !== room.id || currentAssignment.role !== role)) {
                releaseSlot(previousRoom, currentAssignment.role, releaseDeps, { notify: false });
                if (previousRoom.id !== room.id) {
                    socket.leave(previousRoom.id);
                }
            }
        }

        if (!effectivePlayerId && currentAssignment?.playerId) {
            effectivePlayerId = currentAssignment.playerId;
        }

        const requestedKey = normalizedName.toLowerCase();
        const existingKey = slot.name.trim().toLowerCase();

        if (slot.name.trim().length > 0 && slot.socketId !== socket.id) {
            const isSameName = existingKey === requestedKey;
            if (!isSameName) {
                socket.emit("room:roleDenied", {
                    reason: `Diese Rolle ist bereits von ${slot.name} reserviert.`,
                });
                return;
            }
        }

        if (slot.socketId && slot.socketId !== socket.id) {
            const previousSocket = io.sockets.sockets.get(slot.socketId);
            assignments.delete(slot.socketId);
            previousSocket?.emit("room:roleRevoked");
        }

        cancelReleaseTimer(slot);
        slot.socketId = socket.id;
        slot.connected = true;
        slot.releaseDeadline = null;
        slot.name = normalizedName;
        const assignedPlayerId = effectivePlayerId ?? slot.playerId ?? currentAssignment?.playerId ?? socket.id;
        slot.playerId = assignedPlayerId;
        if (!room.meta.hostId && assignedPlayerId) {
            room.meta.hostId = assignedPlayerId;
        }
        assignments.set(socket.id, { roomId: room.id, role, playerId: assignedPlayerId });

        room.state.playerNames[slot.index] = normalizedName;
        room.state.ready[slot.index] = false;

        persistRoom(room, baseDeps);
        emitRoomStatus(io, room);
        broadcastState(io, room);
        notifyConnectionStatus(io, room);

        socket.emit("room:roleConfirmed", {
            roomId: room.id,
            role,
            name: normalizedName,
            playerIndex: slot.index,
            playerId: assignedPlayerId,
        });

        touchRoom?.(room.id);
        log("info", "Role claimed", { socketId: socket.id, roomId: room.id, role, name: normalizedName });
    };

    const handleRoleRelease = () => {
        const assignment = assignments.get(socket.id);
        if (!assignment) return;

        const room = roomStore.get(assignment.roomId);
        assignments.delete(socket.id);

        if (!room) return;

        const slot = room.players[assignment.role];
        if (!slot || slot.socketId !== socket.id) return;

        releaseSlot(room, assignment.role, releaseDeps, { notify: false });
        socket.emit("room:status", buildRoomStatus(room));

        log("info", "Role released", { socketId: socket.id, roomId: room.id, role: assignment.role });
    };

    const handleDisconnect = () => {
        const assignment = assignments.get(socket.id);
        if (!assignment) return;

        assignments.delete(socket.id);

        const room = roomStore.get(assignment.roomId);
        if (!room) return;

        const slot = room.players[assignment.role];
        if (!slot || slot.socketId !== socket.id) return;

        slot.socketId = null;
        slot.connected = false;
        slot.releaseDeadline = Date.now() + roleReleaseTimeoutMs;
        slot.releaseTimer = setTimeout(() => {
            releaseSlot(room, assignment.role, releaseDeps, { notify: false });
        }, roleReleaseTimeoutMs);

        persistRoom(room, baseDeps);
        emitRoomStatus(io, room);
        notifyConnectionStatus(io, room);

        log("warn", "Role retained for grace period", {
            roomId: room.id,
            role: assignment.role,
            deadline: slot.releaseDeadline,
        });
    };

    socket.on("room:status", (payload?: { roomId?: string }) => {
        const room = ensureRoom(payload?.roomId);
        socket.emit("room:status", buildRoomStatus(room));
        socket.emit("state", serializeGameState(room.state));
        socket.emit("phase", room.state.phase);
    });

    socket.on("room:claimRole", handleRoleClaim);

    socket.on("room:releaseRole", handleRoleRelease);

    socket.on("disconnect", handleDisconnect);

    socket.on("room:setCapacity", (payload?: { capacity?: number }) => {
        const requested = typeof payload?.capacity === "number" ? Math.floor(payload.capacity) : NaN;
        withPlayerContext(socket, assignments, roomStore, (ctx) => {
            const { room } = ctx;
            if (room.state.phase !== "setup") return;
            if (!requireHost(ctx)) return;

            const next = Number.isFinite(requested) ? Math.max(2, Math.min(6, requested)) : 2;
            if (room.capacity === next) return;

            const previous = room.capacity;
            room.capacity = next;

            if (next > previous) {
                for (let index = previous; index < next; index += 1) {
                    const role = roleByIndex(index);
                    if (!room.players[role]) {
                        room.players[role] = createPlayerSlot(role, index, room.state.playerNames[index]);
                    }
                }
            } else if (next < previous) {
                for (let index = next; index < previous; index += 1) {
                    const role = roleByIndex(index);
                    if (room.players[role]) {
                        releaseSlot(room, role, releaseDeps, { notify: true });
                        delete room.players[role];
                    }
                }
            }

            while (room.state.playerNames.length < next) room.state.playerNames.push("");
            room.state.playerNames.length = next;
            while (room.state.ready.length < next) room.state.ready.push(false);
            room.state.ready.length = next;
            while (room.state.scoreSheets.length < next) room.state.scoreSheets.push({});
            room.state.scoreSheets.length = next;
            while (room.state.usedCategories.length < next) room.state.usedCategories.push(new Set());
            room.state.usedCategories.length = next;

            persistRoom(room, baseDeps);
            emitRoomStatus(io, room);
            broadcastState(io, room);
        });
    });

    socket.on("set-name", ({ name }: { name: string }) => {
        const trimmed = normaliseName(name);
        if (!trimmed) return;

        withPlayerContext(socket, assignments, roomStore, ({ room, index, role }) => {
            const slot = room.players[role];
            if (slot) {
                slot.name = trimmed;
            }
            room.state.playerNames[index] = trimmed;
            room.state.ready[index] = false;

            persistRoom(room, baseDeps);
            emitRoomStatus(io, room);
            broadcastState(io, room);

            socket.emit("room:roleConfirmed", {
                roomId: room.id,
                role,
                name: trimmed,
                playerIndex: index,
            });
        });
    });

    socket.on("ready", () => {
        withPlayerContext(socket, assignments, roomStore, ({ room, index }) => {
            if (room.state.phase !== "setup") return;

            room.state.ready[index] = true;
            const everyoneReady =
                room.state.ready.every(Boolean) &&
                room.state.playerNames.every((playerName) => playerName.trim().length > 0);

            if (everyoneReady) {
                startMatch(room);
            }

            persistRoom(room, baseDeps);
            broadcastState(io, room);
            emitRoomStatus(io, room);
        });
    });

    socket.on("roll", () => {
        withPlayerContext(socket, assignments, roomStore, ({ room, playerNumber }) => {
            const state = room.state;
            if (state.phase !== "playing") {
                socket.emit("action-denied", { message: "The game has not started yet." });
                return;
            }
            if (state.currentPlayer !== playerNumber) {
                socket.emit("action-denied", { message: "It is not your turn." });
                return;
            }
            if (state.rollsLeft <= 0) {
                socket.emit("action-denied", { message: "No rolls left." });
                return;
            }
            const fresh = rollDice();
            state.dice = state.dice.map((value, index) => (state.held[index] ? value : fresh[index])) as Dice;
            state.rollsLeft -= 1;
            persistRoom(room, baseDeps);
            broadcastState(io, room);
        });
    });

    socket.on("toggle-hold", ({ index }: { index: number }) => {
        withPlayerContext(socket, assignments, roomStore, ({ room, playerNumber }) => {
            const state = room.state;
            if (state.phase !== "playing") {
                socket.emit("action-denied", { message: "The game has not started yet." });
                return;
            }
            if (state.currentPlayer !== playerNumber) {
                socket.emit("action-denied", { message: "It is not your turn." });
                return;
            }
            if (index < 0 || index >= state.held.length) {
                socket.emit("action-denied", { message: "Invalid dice index." });
                return;
            }
            state.held[index] = !state.held[index];
            persistRoom(room, baseDeps);
            broadcastState(io, room);
        });
    });

    socket.on("choose", ({ category }: { category: Category }) => {
        withPlayerContext(socket, assignments, roomStore, ({ room, index, playerNumber }) => {
            const state = room.state;
            if (state.phase !== "playing") {
                socket.emit("action-denied", { message: "The game has not started yet." });
                return;
            }
            if (state.currentPlayer !== playerNumber) {
                socket.emit("action-denied", { message: "It is not your turn." });
                return;
            }
            if (state.usedCategories[index].has(category)) {
                socket.emit("action-denied", { message: "Category already chosen." });
                return;
            }

            const points = scoreCategory(state.dice, category);
            state.scoreSheets[index][category] = points;
            state.usedCategories[index].add(category);

            const allFilled = state.usedCategories.every((set) => set.size === 13);

            if (allFilled) {
                state.gameOver = true;
                state.phase = "finished";
                state.ready = Array.from({ length: state.playerNames.length }, () => false);
            } else {
                advanceTurn(state);
            }

            persistRoom(room, baseDeps);
            broadcastState(io, room);
        });
    });

    socket.on("reset", () => {
        withPlayerContext(socket, assignments, roomStore, (ctx) => {
            const { room } = ctx;
            if (!requireHost(ctx)) return;
            resetRoom(room);
            persistRoom(room, baseDeps);
            broadcastState(io, room);
            emitRoomStatus(io, room);
        });
    });

    socket.on(
        "request-history",
        (payload?: { players?: string[]; limit?: number; mode?: "exact" | "contains" }) => {
            try {
                const limit = payload?.limit;
                const players = payload?.players ?? [];
                const mode = payload?.mode === "contains" ? "contains" : "exact";
                const history =
                    players.length > 0 || limit !== undefined
                        ? listHistoryFiltered({ limit, players, mode })
                        : listHistory(50);
                socket.emit("history", history);
            } catch (error) {
                log("error", "Failed to deliver history", error);
                socket.emit("history", []);
            }
        },
    );
}
