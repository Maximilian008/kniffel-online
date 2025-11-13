import { Router } from "express";
import type { Router as ExpressRouter } from "express";
import { randomUUID } from "node:crypto";

import { saveGame, toPersistedGame } from "../db.js";
import {
    buildGameRoom,
    createInitialState,
    createPlayerSlot,
    generateToken,
    serializeGameState,
} from "../rooms/GameRoom.js";
import { InMemoryRoomStore } from "../rooms/RoomStore.js";
import { RoomDirectory, type RoomDirectoryEntry } from "../rooms/RoomDirectory.js";
import { roleByIndex, type GameRoom } from "../rooms/types.js";
import type { Logger } from "../rooms/helpers/index.js";
import { normaliseName } from "../utils/names.js";
import InviteStore, { type InviteRecord } from "../invites/InviteStore.js";

type CreateRoomsRouterDeps = {
    roomStore: InMemoryRoomStore;
    directory: RoomDirectory;
    inviteStore: InviteStore;
    log: Logger;
    persistDirectoryEntry: (entry: RoomDirectoryEntry) => void;
};

function persistSnapshot(room: GameRoom) {
    const serializedState = serializeGameState(room.state);
    const persisted = toPersistedGame({
        roomId: room.id,
        playerTokens: room.tokens,
        state: serializedState,
        createdAt: room.createdAt,
        updatedAt: Date.now(),
        capacity: room.capacity,
        meta: {
            hostId: room.meta.hostId ?? null,
        },
    });
    saveGame(persisted);
}

export function createRoomsRouter({
    roomStore,
    directory,
    inviteStore,
    log,
    persistDirectoryEntry,
}: CreateRoomsRouterDeps): ExpressRouter {
    const router: ExpressRouter = Router();

    router.post("/rooms", async (req, res) => {
        try {
            const body = (req.body ?? {}) as {
                playerCount?: unknown;
                displayName?: unknown;
                playerId?: unknown;
                hostId?: unknown;
            };

            const fallbackCount = 2;
            const requestedCount = typeof body.playerCount === "number" ? Math.floor(body.playerCount) : fallbackCount;
            if (!Number.isFinite(requestedCount) || requestedCount < 2 || requestedCount > 6) {
                return res.status(400).json({ error: "invalid_player_count" });
            }

            const rawName = typeof body.displayName === "string" ? body.displayName : "";
            const hostName = normaliseName(rawName);
            const hostIdRaw = typeof body.hostId === "string" ? body.hostId.trim() : "";
            const playerIdRaw = typeof body.playerId === "string" ? body.playerId.trim() : "";
            const hostId = playerIdRaw || hostIdRaw || roomId;

            const roomId = randomUUID();
            const capacity = requestedCount;
            const state = createInitialState(capacity);
            if (hostName) {
                state.playerNames[0] = hostName;
            }

            const room = buildGameRoom({
                id: roomId,
                capacity,
                state,
                tokens: [generateToken("p"), generateToken("p")],
                playerNames: state.playerNames,
                createdAt: Date.now(),
                meta: {
                    hostId,
                },
            });

            for (let index = 0; index < capacity; index += 1) {
                const role = roleByIndex(index);
                if (!room.players[role]) {
                    const initialPlayerId = index === 0 ? hostId : null;
                    room.players[role] = createPlayerSlot(role, index, state.playerNames[index], initialPlayerId);
                }
            }

            roomStore.set(room);
            persistSnapshot(room);

            const invite = await inviteStore.issue(roomId);
            const entry = directory.create(roomId, { inviteToken: invite.token });
            persistDirectoryEntry(entry);

            log("info", "Room created", { roomId, capacity });

            return res.status(201).json({
                roomId,
                token: invite.token,
                inviteExpiresAt: invite.expiresAt,
                code: entry.code,
                hostId,
            });
        } catch (error) {
            log("error", "Failed to create room", error);
            return res.status(500).json({ error: "room_create_failed" });
        }
    });

    router.post("/rooms/join", async (req, res) => {
        try {
            const body = (req.body ?? {}) as {
                code?: unknown;
                token?: unknown;
            };

            let entry: RoomDirectoryEntry | undefined;
            let inviteRecord: InviteRecord | null = null;

            const token = typeof body.token === "string" ? body.token.trim() : "";
            if (token) {
                const verification = await inviteStore.verify(token);
                if (!verification.ok) {
                    const status =
                        verification.code === "INVITE_EXPIRED" || verification.code === "INVITE_REVOKED"
                            ? 410
                            : 400;
                    return res.status(status).json({ error: verification.code });
                }
                inviteRecord = verification.record;
                entry = directory.getByRoomId(verification.record.roomId);
                if (!entry) {
                    return res.status(404).send("room not found");
                }
            }

            if (!entry && typeof body.code === "string") {
                entry = directory.getByCode(body.code);
            }

            if (!entry) {
                return res.status(404).send("room not found");
            }

            const room = roomStore.ensure(entry.roomId);
            const hostId =
                room.meta.hostId ??
                room.players[roleByIndex(0)]?.playerId ??
                room.id;
            const refreshed = directory.touch(entry.roomId);
            if (refreshed) persistDirectoryEntry(refreshed);

            if (!inviteRecord) {
                inviteRecord = inviteStore.getByRoom(entry.roomId) ?? null;
            }

            if (inviteRecord && inviteRecord.expiresAt <= Date.now()) {
                inviteStore.revokeRoom(entry.roomId);
                inviteRecord = null;
            }

            if (!inviteRecord) {
                inviteRecord = await inviteStore.issue(entry.roomId);
                entry = directory.create(entry.roomId, { inviteToken: inviteRecord.token });
                persistDirectoryEntry(entry);
            }

            return res.json({
                roomId: entry.roomId,
                code: entry.code,
                hostId,
                token: inviteRecord.token,
                inviteExpiresAt: inviteRecord.expiresAt,
            });
        } catch (error) {
            log("error", "Failed to join room", error);
            return res.status(500).json({ error: "room_join_failed" });
        }
    });

    router.post("/rooms/:roomId/invite", async (req, res) => {
        try {
            const roomId = typeof req.params.roomId === "string" ? req.params.roomId.trim() : "";
            if (!roomId) {
                return res.status(400).json({ error: "invalid_room_id" });
            }

            const entry = directory.getByRoomId(roomId);
            if (!entry) {
                return res.status(404).json({ error: "room_not_found" });
            }

            const body = (req.body ?? {}) as { playerId?: unknown; token?: unknown };
            const playerId = typeof body.playerId === "string" ? body.playerId.trim() : "";
            const providedToken = typeof body.token === "string" ? body.token.trim() : "";

            if (!playerId) {
                return res.status(403).json({ error: "invite_refresh_forbidden" });
            }

            const room = roomStore.ensure(roomId);
            const expectedHost = room.meta.hostId ?? null;
            if (expectedHost && expectedHost !== playerId) {
                return res.status(403).json({ error: "invite_refresh_forbidden" });
            }

            if (providedToken && entry.inviteToken !== providedToken) {
                return res.status(403).json({ error: "invite_refresh_forbidden" });
            }

            const invite = await inviteStore.issue(roomId);
            const updated = directory.create(roomId, { inviteToken: invite.token });
            persistDirectoryEntry(updated);

            return res.json({
                roomId,
                code: updated.code,
                token: invite.token,
                inviteExpiresAt: invite.expiresAt,
                hostId: room.meta.hostId ?? null,
            });
        } catch (error) {
            log("error", "Failed to refresh invite", error);
            return res.status(500).json({ error: "invite_refresh_failed" });
        }
    });

    router.post("/rooms/rejoin", (req, res) => {
        try {
            const body = (req.body ?? {}) as { roomId?: unknown };
            const roomId = typeof body.roomId === "string" ? body.roomId.trim() : "";
            if (!roomId) {
                return res.status(400).send("room not found");
            }

            const entry = directory.getByRoomId(roomId);
            if (!entry) {
                return res.status(404).send("room not found");
            }

            roomStore.ensure(entry.roomId);
            const refreshed = directory.touch(entry.roomId);
            if (refreshed) persistDirectoryEntry(refreshed);
            return res.json({ ok: true as const });
        } catch (error) {
            log("error", "Failed to rejoin room", error);
            return res.status(500).json({ error: "room_rejoin_failed" });
        }
    });

    router.get("/rooms/:roomId", (req, res) => {
        const { roomId } = req.params;
        const entry = directory.getByRoomId(roomId);
        if (!entry) {
            return res.status(404).send("room not found");
        }

        const room = roomStore.ensure(roomId);
        const players = Array.from({ length: room.capacity }, (_value, index) => {
            const role = roleByIndex(index);
            const slot = room.players[role];
            return {
                id: role,
                name: slot?.name ?? "",
                connected: Boolean(slot?.connected),
            };
        });
        return res.json({
            id: room.id,
            capacity: room.capacity,
            phase: room.state.phase,
            players,
        });
    });

    return router;
}

export default createRoomsRouter;
