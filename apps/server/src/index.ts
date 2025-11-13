import dotenv from "dotenv";
import express from "express";
import http from "http";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { Server } from "socket.io";

import {
    initDb,
    listDirectoryEntries,
    listHistory,
    listHistoryFiltered,
    loadGame,
    removeDirectoryEntry,
    saveGame,
    toPersistedGame,
    upsertDirectoryEntry,
} from "./db.js";
import createRoomsRouter from "./routes/rooms.js";
import {
    buildGameRoom,
    createInitialState,
    createPlayerSlot,
    generateToken,
    materialiseGameState,
    serializeGameState,
} from "./rooms/GameRoom.js";
import { InMemoryRoomStore } from "./rooms/RoomStore.js";
import { roleByIndex, type GameRoom } from "./rooms/types.js";
import { buildRoomStatus, type Logger } from "./rooms/helpers/index.js";
import { registerSocketHandlers } from "./sockets/handlers.js";
import type { SocketAssignment } from "./sockets/context.js";
import { RoomDirectory } from "./rooms/RoomDirectory.js";
import InviteStore from "./invites/InviteStore.js";

dotenv.config();
initDb();

const bootStartedAt = Date.now();
const ROLE_RELEASE_TIMEOUT_MS = 120_000;
const ROOM_ID = "kniffel-room" as const;
const ROOM_INACTIVE_TTL_MS = 72 * 60 * 60 * 1000;
const ROOM_GC_INTERVAL_MS = 60 * 60 * 1000;
const NODE_ENV = process.env.NODE_ENV?.toLowerCase() ?? "development";
const DEV_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://localhost:5176",
    "http://localhost:5177",
    "http://localhost:5178",
    "http://localhost:5179",
];

const envOrigins = parseAllowedOrigins(process.env.ALLOWED_ORIGINS);
const allowedOriginSet = new Set(envOrigins);
if (NODE_ENV !== "production" && !allowedOriginSet.has("*")) {
    DEV_ORIGINS.forEach((origin) => allowedOriginSet.add(origin));
}
const allowAllOrigins = allowedOriginSet.has("*");
if (allowAllOrigins) {
    allowedOriginSet.clear();
}
const allowedOriginList = Array.from(allowedOriginSet);

type LogLevel = "info" | "warn" | "error";

const log: Logger = (level: LogLevel, message: string, meta?: unknown) => {
    const stamp = new Date().toISOString();
    const prefix = `[${stamp}] [${level.toUpperCase()}]`;
    if (meta !== undefined) {
        if (level === "error") {
            console.error(prefix, message, meta);
        } else if (level === "warn") {
            console.warn(prefix, message, meta);
        } else {
            console.log(prefix, message, meta);
        }
    } else if (level === "error") {
        console.error(prefix, message);
    } else if (level === "warn") {
        console.warn(prefix, message);
    } else {
        console.log(prefix, message);
    }
};

const readPackageVersion = (): string => {
    try {
        const packageJsonUrl = new URL("../package.json", import.meta.url);
        const raw = fs.readFileSync(fileURLToPath(packageJsonUrl), "utf8");
        const parsed = JSON.parse(raw) as { version?: string | null };
        if (parsed && typeof parsed.version === "string" && parsed.version.trim().length > 0) {
            return parsed.version;
        }
    } catch (error) {
        log("warn", "Unable to resolve package version from package.json", error);
    }
    return process.env.npm_package_version ?? "0.0.0";
};

function parseAllowedOrigins(value?: string | null): string[] {
    if (!value) return [];
    return value
        .split(/[\s,]+/)
        .map((origin) => origin.trim())
        .filter(Boolean);
}

function isOriginAllowed(origin: string | undefined): boolean {
    if (allowAllOrigins) return true;
    if (!origin) return allowedOriginSet.size === 0;
    return allowedOriginSet.size === 0 || allowedOriginSet.has(origin.trim());
}

const buildHealthPayload = () => ({
    status: "ok",
    uptime: Math.round((Date.now() - bootStartedAt) / 1000),
    version: packageVersion,
    environment: NODE_ENV,
});

const resolveInviteSecret = (): string => {
    const raw = process.env.INVITE_SECRET?.trim() ?? "";
    if (raw.length > 0) {
        return raw;
    }
    const fallback = randomUUID().replace(/-/g, "");
    log("warn", "INVITE_SECRET not set. Using ephemeral value; invites reset on restart.");
    return fallback;
};

const INVITE_TTL_SECONDS = (() => {
    const raw = process.env.INVITE_TTL_SECONDS;
    if (!raw) return 60 * 60;
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed > 0) {
        return Math.floor(parsed);
    }
    log("warn", `Invalid INVITE_TTL_SECONDS value (${raw}). Falling back to default.`);
    return 60 * 60;
})();

const ensureRoomSlots = (room: GameRoom) => {
    for (let index = 0; index < room.capacity; index += 1) {
        const role = roleByIndex(index);
        if (!room.players[role]) {
            room.players[role] = createPlayerSlot(role, index, room.state.playerNames[index]);
        }
    }
};

const saveInitialRoom = (room: GameRoom) => {
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
};

const loadOrCreateRoom = (roomId: string): GameRoom => {
    const persisted = loadGame(roomId);
    if (persisted) {
        const state = materialiseGameState(persisted.state);
        const fallbackCapacity = state.playerNames.length || 2;
        const rawCapacity = persisted.capacity ?? fallbackCapacity;
        const capacity = Math.max(2, Math.min(6, rawCapacity));
        const tokens: [string, string] = persisted.playerTokens ?? [generateToken("p"), generateToken("p")];

        const room = buildGameRoom({
            id: roomId,
            capacity,
            state,
            tokens,
            playerNames: state.playerNames,
            createdAt: persisted.createdAt ?? Date.now(),
            meta: {
                hostId: persisted.meta?.hostId ?? null,
            },
        });
        ensureRoomSlots(room);
        return room;
    }

    const initialState = createInitialState();
    const capacity = Math.max(2, initialState.playerNames.length || 2);
    const room = buildGameRoom({
        id: roomId,
        capacity,
        state: initialState,
        tokens: [generateToken("p"), generateToken("p")],
        playerNames: initialState.playerNames,
        meta: {
            hostId: null,
        },
    });
    ensureRoomSlots(room);
    saveInitialRoom(room);
    return room;
};

const roomDirectory = new RoomDirectory(listDirectoryEntries());
const inviteStore = new InviteStore({
    secret: resolveInviteSecret(),
    ttlSeconds: INVITE_TTL_SECONDS,
});
const roomStore = new InMemoryRoomStore(loadOrCreateRoom);
roomStore.ensure(ROOM_ID);

const socketAssignments: Map<string, SocketAssignment> = new Map();

const touchDirectoryEntry = (roomId: string) => {
    const entry = roomDirectory.touch(roomId);
    if (entry) {
        upsertDirectoryEntry(entry);
    }
};

function cleanupStaleRooms() {
    const now = Date.now();
    for (const entry of roomDirectory.values()) {
        if (entry.roomId === ROOM_ID) continue;
        if (now - entry.updatedAt < ROOM_INACTIVE_TTL_MS) continue;
        const hasActiveSockets = Array.from(socketAssignments.values()).some(
            (assignment) => assignment.roomId === entry.roomId,
        );
        if (hasActiveSockets) continue;
        log("info", "Pruning inactive room", { roomId: entry.roomId });
        roomDirectory.delete(entry.roomId);
        inviteStore.revokeRoom(entry.roomId);
        removeDirectoryEntry(entry.roomId);
        roomStore.delete(entry.roomId);
        for (const [socketId, assignment] of socketAssignments) {
            if (assignment.roomId === entry.roomId) {
                socketAssignments.delete(socketId);
            }
        }
    }
}

cleanupStaleRooms();
const gcTimer = setInterval(cleanupStaleRooms, ROOM_GC_INTERVAL_MS);
gcTimer.unref?.();

const app = express();
app.disable("x-powered-by");
app.use(express.json());

app.use((req, res, next) => {
    const startedAt = Date.now();
    res.on("finish", () => {
        const duration = Date.now() - startedAt;
        log("info", `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
    });
    next();
});

app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && isOriginAllowed(origin)) {
        res.header("Access-Control-Allow-Origin", origin);
        res.header("Vary", "Origin");
        res.header("Access-Control-Allow-Credentials", "true");
    } else if (!origin && (allowAllOrigins || allowedOriginSet.size === 0)) {
        res.header("Access-Control-Allow-Origin", "*");
    }
    res.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.header(
        "Access-Control-Allow-Headers",
        "Origin, X-Requested-With, Content-Type, Accept, Authorization",
    );
    if (req.method === "OPTIONS") {
        res.status(204).end();
        return;
    }
    next();
});

app.use(
    "/api",
    createRoomsRouter({
        roomStore,
        directory: roomDirectory,
        inviteStore,
        log,
        persistDirectoryEntry: upsertDirectoryEntry,
    }),
);

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const packageVersion = readPackageVersion();
const webDistPath = path.resolve(__dirname, "../../web/dist");

app.get("/healthz", (_req, res) => {
    res.json(buildHealthPayload());
});

app.get("/health", (_req, res) => {
    res.json(buildHealthPayload());
});

app.get("/api/history", (req, res) => {
    try {
        const limit = req.query.limit ? Number(req.query.limit) : undefined;
        const rawPlayers = (req.query.players ?? req.query.player ?? req.query.p) as
            | string
            | string[]
            | undefined;
        const players: string[] = Array.isArray(rawPlayers)
            ? rawPlayers
            : typeof rawPlayers === "string" && rawPlayers.trim().length > 0
              ? rawPlayers.split(",").map((value) => value.trim()).filter(Boolean)
              : [];
        const mode = (req.query.mode as string | undefined) === "contains" ? "contains" : "exact";

        const history =
            players.length > 0 || limit !== undefined
                ? listHistoryFiltered({ limit, players, mode })
                : listHistory(100);
        res.json({ history });
    } catch (error) {
        log("error", "Failed to load history", error);
        res.status(500).json({ error: "history_unavailable" });
    }
});

if (fs.existsSync(webDistPath)) {
    app.use(express.static(webDistPath));
    app.get("*", (_req, res) => {
        res.sendFile(path.join(webDistPath, "index.html"));
    });
}

app.use(
    (
        error: unknown,
        _req: express.Request,
        res: express.Response,
        next: express.NextFunction,
    ) => {
        if (res.headersSent) {
            return next(error);
        }
        log("error", "Unhandled application error", error);
        res.status(500).json({ error: "internal_error" });
    },
);

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: allowAllOrigins
            ? true
            : allowedOriginList.length > 0
              ? allowedOriginList
              : true,
        credentials: true,
    },
    transports: ["websocket"],
    pingInterval: 25_000,
    pingTimeout: 20_000,
});

io.on("connection", (socket) => {
    const room = roomStore.ensure(ROOM_ID);
    socket.join(room.id);

    log("info", "Socket connected", { socketId: socket.id });

    socket.emit("room:status", buildRoomStatus(room));
    socket.emit("state", serializeGameState(room.state));
    socket.emit("phase", room.state.phase);

    registerSocketHandlers({
        socket,
        io,
        roomStore,
        assignments: socketAssignments,
        log,
        defaultRoomId: ROOM_ID,
        roleReleaseTimeoutMs: ROLE_RELEASE_TIMEOUT_MS,
        touchRoom: touchDirectoryEntry,
    });
});

const PORT = Number(process.env.PORT) || 3000;
const httpServer = server.listen(PORT, () => {
    log("info", `Server listening on http://localhost:${PORT}`, {
        version: packageVersion,
        environment: NODE_ENV,
    });
    const originsForLog = allowAllOrigins
        ? "*"
        : allowedOriginList.length > 0
          ? allowedOriginList.join(", ")
          : "(none)";
    log("info", `Allowed origins: ${originsForLog}`);
});

const shutdownSignals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
let shuttingDown = false;

const shutdown = (signal: NodeJS.Signals) => {
    if (shuttingDown) return;
    shuttingDown = true;
    log("warn", `Received ${signal}. Shutting down gracefully.`);
    clearInterval(gcTimer);

    io.close(() => {
        log("info", "Socket.io server closed.");
    });

    httpServer.close((error) => {
        if (error) {
            log("error", "Error while closing HTTP server", error);
            process.exit(1);
        }
        log("info", "HTTP server closed.");
        process.exit(0);
    });

    setTimeout(() => {
        log("error", "Graceful shutdown timed out. Forcing exit.");
        process.exit(1);
    }, 10_000);
};

for (const signal of shutdownSignals) {
    process.on(signal, shutdown);
}
