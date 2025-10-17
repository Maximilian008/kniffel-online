import dotenv from "dotenv";
import express from "express";
import http from "http";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Server, Socket } from "socket.io";
import {
  deriveScores,
  deriveWinner,
  initDb,
  listHistory,
  listHistoryFiltered,
  loadGame,
  saveGame,
  toPersistedGame,
} from "./db.js";
import type {
  Category,
  Dice,
  GameState,
  HistoryEntry,
  PlayerIndex,
  SerializedGameState,
} from "./types/shared.js";
import { MAX_ROLLS_PER_TURN } from "./types/shared.js";
import { rollDice, scoreCategory } from "./utils/gameRules.js";
import { normaliseName } from "./utils/names.js";

dotenv.config();
initDb();

const bootStartedAt = Date.now();
const ROLE_RELEASE_TIMEOUT_MS = 120_000;
const ROOM_ID = "kniffel-room" as const;
const NODE_ENV = process.env.NODE_ENV?.toLowerCase() ?? "development";
const DEV_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://localhost:5176",
  "http://localhost:5177",
  "http://localhost:5178",
  "http://localhost:5179"
];

const envOrigins = parseAllowedOrigins(process.env.ALLOWED_ORIGINS);
const allowedOriginSet = new Set(envOrigins);
if (NODE_ENV !== "production" && !allowedOriginSet.has("*")) {
  DEV_ORIGINS.forEach(origin => allowedOriginSet.add(origin));
}
const allowAllOrigins = allowedOriginSet.has("*");
if (allowAllOrigins) {
  allowedOriginSet.clear();
}
const allowedOriginList = Array.from(allowedOriginSet);

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

type LogLevel = "info" | "warn" | "error";

function log(level: LogLevel, message: string, meta?: unknown) {
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
  } else {
    if (level === "error") {
      console.error(prefix, message);
    } else if (level === "warn") {
      console.warn(prefix, message);
    } else {
      console.log(prefix, message);
    }
  }
}
function readPackageVersion(): string {
  try {
    const packageJsonUrl = new URL('../package.json', import.meta.url);
    const raw = fs.readFileSync(fileURLToPath(packageJsonUrl), 'utf8');
    const parsed = JSON.parse(raw) as { version?: string | null };
    if (parsed && typeof parsed.version === 'string' && parsed.version.trim().length > 0) {
      return parsed.version;
    }
  } catch (error) {
    log('warn', 'Unable to resolve package version from package.json', error);
  }
  return process.env.npm_package_version ?? '0.0.0';
}
type Role = "p1" | "p2";
const ROLES: Role[] = ["p1", "p2"];

type PlayerSlot = {
  role: Role;
  index: 0 | 1;
  name: string;
  socketId: string | null;
  connected: boolean;
  releaseTimer: NodeJS.Timeout | null;
  releaseDeadline: number | null;
};

type RoomStatusPayloadRole = {
  role: Role;
  name: string | null;
  occupied: boolean;
  connected: boolean;
  releaseDeadline: number | null;
};

type RoomStatusPayload = {
  roomId: string;
  roles: Record<Role, RoomStatusPayloadRole>;
};

type RoleClaimPayload = {
  role?: Role;
  name?: string;
};

type RoleReleaseOptions = {
  notify?: boolean;
};

type GameRoom = {
  id: string;
  state: GameState;
  createdAt: number;
  players: Record<Role, PlayerSlot>;
  tokens: [string, string];
};

const rooms = new Map<string, GameRoom>();
const socketAssignments = new Map<string, { roomId: string; role: Role }>();

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
  res.header(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,PATCH,DELETE,OPTIONS"
  );
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
});

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
        ? rawPlayers.split(",").map((s) => s.trim()).filter(Boolean)
        : [];
    const mode = (req.query.mode as string | undefined) === "contains" ? "contains" : "exact";

    const history: HistoryEntry[] = players.length > 0 || limit !== undefined || mode
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
    next: express.NextFunction
  ) => {
    if (res.headersSent) {
      return next(error);
    }
    log("error", "Unhandled application error", error);
    res.status(500).json({ error: "internal_error" });
  }
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

ensureRoom(ROOM_ID);

io.on("connection", (socket) => {
  const room = ensureRoom(ROOM_ID);
  socket.join(room.id);

  log("info", "Socket connected", { socketId: socket.id });

  socket.emit("room:status", buildRoomStatus(room));
  socket.emit("state", serializeState(room.state));
  socket.emit("phase", room.state.phase);

  registerGameEventHandlers(socket);

  socket.on("room:status", () => {
    socket.emit("room:status", buildRoomStatus(room));
  });

  socket.on("room:claimRole", (payload: RoleClaimPayload = {}) => {
    handleRoleClaim(socket, payload.role, payload.name);
  });

  socket.on("room:releaseRole", () => {
    handleRoleRelease(socket);
  });

  socket.on("disconnect", () => {
    log("warn", "Socket disconnected", { socketId: socket.id });
    handleDisconnect(socket);
  });
});

const PORT = Number(process.env.PORT) || 3000;
const httpServer = server.listen(PORT, () => {
  log('info', `Server listening on http://localhost:${PORT}`, { version: packageVersion, environment: NODE_ENV });
  const originsForLog = allowAllOrigins
    ? '*'
    : allowedOriginList.length > 0
      ? allowedOriginList.join(', ')
      : '(none)';
  log('info', `Allowed origins: ${originsForLog}`);
});

const shutdownSignals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
let shuttingDown = false;

function shutdown(signal: NodeJS.Signals) {
  if (shuttingDown) return;
  shuttingDown = true;
  log("warn", `Received ${signal}. Shutting down gracefully.`);

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
}

for (const signal of shutdownSignals) {
  process.on(signal, shutdown);
}

function handleRoleClaim(socket: Socket, role?: Role, rawName?: string) {
  if (!role || !ROLES.includes(role)) {
    socket.emit("room:roleDenied", { reason: "Ungueltige Rolle." });
    return;
  }

  if (typeof rawName !== "string") {
    socket.emit("room:roleDenied", { reason: "Bitte gib einen Namen ein." });
    return;
  }

  const room = ensureRoom(ROOM_ID);
  const normalizedName = normaliseName(rawName);

  if (!normalizedName) {
    socket.emit("room:roleDenied", { reason: "Name darf nicht leer sein." });
    return;
  }

  const slot = room.players[role];
  const requestedKey = normalizedName.toLowerCase();
  const existingKey = slot.name.trim().toLowerCase();

  const currentAssignment = socketAssignments.get(socket.id);
  if (currentAssignment && currentAssignment.roomId === room.id && currentAssignment.role !== role) {
    releaseSlot(room, currentAssignment.role, { notify: false });
  }

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
    socketAssignments.delete(slot.socketId);
    previousSocket?.emit("room:roleRevoked");
  }

  clearReleaseTimer(slot);
  slot.socketId = socket.id;
  slot.connected = true;
  slot.releaseDeadline = null;
  slot.name = normalizedName;
  socketAssignments.set(socket.id, { roomId: room.id, role });

  room.state.playerNames[slot.index] = normalizedName;
  room.state.ready[slot.index] = false;

  persistRoom(room);
  emitRoomStatus(room);
  broadcastState(room);
  notifyConnectionStatus(room);

  socket.emit("room:roleConfirmed", {
    roomId: room.id,
    role,
    name: normalizedName,
    playerIndex: slot.index,
  });

  log("info", "Role claimed", { socketId: socket.id, role, name: normalizedName });
}

function handleRoleRelease(socket: Socket) {
  const assignment = socketAssignments.get(socket.id);
  if (!assignment) return;

  const room = rooms.get(assignment.roomId);
  if (!room) {
    socketAssignments.delete(socket.id);
    return;
  }

  const slot = room.players[assignment.role];
  if (slot.socketId !== socket.id) {
    socketAssignments.delete(socket.id);
    return;
  }

  socketAssignments.delete(socket.id);
  releaseSlot(room, assignment.role, { notify: false });
  socket.emit("room:status", buildRoomStatus(room));

  log("info", "Role released", { socketId: socket.id, role: assignment.role });
}

function handleDisconnect(socket: Socket) {
  const assignment = socketAssignments.get(socket.id);
  if (!assignment) return;

  socketAssignments.delete(socket.id);

  const room = rooms.get(assignment.roomId);
  if (!room) return;

  const slot = room.players[assignment.role];
  if (slot.socketId !== socket.id) return;

  slot.socketId = null;
  slot.connected = false;
  slot.releaseDeadline = Date.now() + ROLE_RELEASE_TIMEOUT_MS;
  slot.releaseTimer = setTimeout(() => {
    releaseSlot(room, assignment.role, { notify: false });
  }, ROLE_RELEASE_TIMEOUT_MS);

  persistRoom(room);
  emitRoomStatus(room);
  notifyConnectionStatus(room);

  log("warn", "Role retained for grace period", {
    role: assignment.role,
    releaseDeadline: slot.releaseDeadline,
  });
}

function releaseSlot(room: GameRoom, role: Role, options: RoleReleaseOptions = {}) {
  const slot = room.players[role];
  clearReleaseTimer(slot);

  if (slot.socketId) {
    const previousSocket = io.sockets.sockets.get(slot.socketId);
    if (previousSocket && options.notify) {
      previousSocket.emit("room:roleRevoked");
    }
    socketAssignments.delete(slot.socketId);
  }

  slot.socketId = null;
  slot.connected = false;
  slot.releaseDeadline = null;
  slot.name = "";
  room.state.playerNames[slot.index] = "";
  room.state.ready[slot.index] = false;

  persistRoom(room);
  emitRoomStatus(room);
  broadcastState(room);
  notifyConnectionStatus(room);
}

function clearReleaseTimer(slot: PlayerSlot) {
  if (slot.releaseTimer) {
    clearTimeout(slot.releaseTimer);
  }
  slot.releaseTimer = null;
  slot.releaseDeadline = null;
}

function buildRoomStatus(room: GameRoom): RoomStatusPayload {
  const roles: Record<Role, RoomStatusPayloadRole> = {
    p1: buildRoleStatus(room.players.p1),
    p2: buildRoleStatus(room.players.p2),
  };
  return { roomId: room.id, roles };
}

function buildRoleStatus(slot: PlayerSlot): RoomStatusPayloadRole {
  const occupied = slot.name.trim().length > 0;
  return {
    role: slot.role,
    name: occupied ? slot.name : null,
    occupied,
    connected: slot.connected,
    releaseDeadline: slot.releaseDeadline,
  };
}

function emitRoomStatus(room: GameRoom) {
  io.to(room.id).emit("room:status", buildRoomStatus(room));
}

function broadcastState(room: GameRoom) {
  const payload = serializeState(room.state);
  io.to(room.id).emit("state", payload);
  io.to(room.id).emit("phase", room.state.phase);
}

function notifyConnectionStatus(room: GameRoom) {
  const p1Socket = room.players.p1.socketId
    ? io.sockets.sockets.get(room.players.p1.socketId)
    : null;
  const p2Socket = room.players.p2.socketId
    ? io.sockets.sockets.get(room.players.p2.socketId)
    : null;

  if (p1Socket) {
    p1Socket.emit("opponent-status", {
      connected: room.players.p2.connected,
    });
  }
  if (p2Socket) {
    p2Socket.emit("opponent-status", {
      connected: room.players.p1.connected,
    });
  }
}

function registerGameEventHandlers(socket: Socket) {
  socket.on("set-name", ({ name }: { name: string }) => {
    withPlayerContext(socket, ({ room, index, role, roomId }) => {
      const trimmed = normaliseName(name);
      if (!trimmed) return;
      room.players[role].name = trimmed;
      room.state.playerNames[index] = trimmed;
      room.state.ready[index] = false;
      persistRoom(room);
      emitRoomStatus(room);
      broadcastState(room);
      socket.emit("room:roleConfirmed", {
        roomId,
        role,
        name: trimmed,
        playerIndex: index,
      });
    });
  });

  socket.on("ready", () => {
    withPlayerContext(socket, ({ room, index }) => {
      if (room.state.phase !== "setup") return;
      room.state.ready[index] = true;
      const bothReady =
        room.state.ready.every(Boolean) &&
        room.state.playerNames.every((playerName) => playerName.trim().length > 0);
      if (bothReady) {
        startMatch(room);
      }
      persistRoom(room);
      broadcastState(room);
      emitRoomStatus(room);
    });
  });

  socket.on("roll", () => {
    withPlayerContext(socket, ({ room, playerNumber }) => {
      const state = room.state;
      if (state.phase !== "playing") {
        sendDenied(socket, "The game has not started yet.");
        return;
      }
      if (state.currentPlayer !== playerNumber) {
        sendDenied(socket, "It is not your turn.");
        return;
      }
      if (state.rollsLeft <= 0) {
        sendDenied(socket, "No rolls left.");
        return;
      }
      const fresh = rollDice();
      state.dice = state.dice.map((value, index) =>
        state.held[index] ? value : fresh[index]
      ) as Dice;
      state.rollsLeft -= 1;
      persistRoom(room);
      broadcastState(room);
    });
  });

  socket.on("toggle-hold", ({ index }: { index: number }) => {
    withPlayerContext(socket, ({ room, playerNumber }) => {
      const state = room.state;
      if (state.phase !== "playing") {
        sendDenied(socket, "The game has not started yet.");
        return;
      }
      if (state.currentPlayer !== playerNumber) {
        sendDenied(socket, "It is not your turn.");
        return;
      }
      if (index < 0 || index >= state.held.length) {
        sendDenied(socket, "Invalid dice index.");
        return;
      }
      state.held[index] = !state.held[index];
      persistRoom(room);
      broadcastState(room);
    });
  });

  socket.on("choose", ({ category }: { category: Category }) => {
    withPlayerContext(socket, ({ room, index, playerNumber }) => {
      const state = room.state;
      if (state.phase !== "playing") {
        sendDenied(socket, "The game has not started yet.");
        return;
      }
      if (state.currentPlayer !== playerNumber) {
        sendDenied(socket, "It is not your turn.");
        return;
      }
      if (state.usedCategories[index].has(category)) {
        sendDenied(socket, "Category already chosen.");
        return;
      }

      const points = scoreCategory(state.dice, category);
      state.scoreSheets[index][category] = points;
      state.usedCategories[index].add(category);

      const allFilled =
        state.usedCategories[0].size === 13 && state.usedCategories[1].size === 13;

      if (allFilled) {
        state.gameOver = true;
        state.phase = "finished";
        state.ready = [false, false];
      } else {
        advanceTurn(state);
      }

      persistRoom(room);
      broadcastState(room);
    });
  });

  socket.on("reset", () => {
    withPlayerContext(socket, ({ room }) => {
      resetRoom(room);
      persistRoom(room);
      broadcastState(room);
      emitRoomStatus(room);
    });
  });

  socket.on("request-history", (payload?: { players?: string[]; limit?: number; mode?: "exact" | "contains" }) => {
    try {
      const limit = payload?.limit;
      const players = payload?.players ?? [];
      const mode = payload?.mode === "contains" ? "contains" : "exact";
      const history = (players.length > 0 || limit !== undefined)
        ? listHistoryFiltered({ limit, players, mode })
        : listHistory(50);
      socket.emit("history", history);
    } catch (error) {
      log("error", "Failed to deliver history", error);
      socket.emit("history", []);
    }
  });
}

function withPlayerContext(
  socket: Socket,
  handler: (ctx: {
    roomId: string;
    room: GameRoom;
    index: PlayerIndex;
    role: Role;
    playerNumber: 1 | 2;
  }) => void
) {
  const assignment = socketAssignments.get(socket.id);
  if (!assignment) return;
  const room = rooms.get(assignment.roomId);
  if (!room) return;
  handler({
    roomId: room.id,
    room,
    role: assignment.role,
    index: assignment.role === "p1" ? 0 : 1,
    playerNumber: assignment.role === "p1" ? 1 : 2,
  });
}

function startMatch(room: GameRoom) {
  const state = room.state;
  state.phase = "playing";
  state.gameOver = false;
  state.dice = rollDice() as Dice;
  state.held = [false, false, false, false, false];
  state.rollsLeft = MAX_ROLLS_PER_TURN - 1;
  state.currentPlayer = 1;
  state.ready = [false, false];
}

function advanceTurn(state: GameState) {
  state.dice = rollDice() as Dice;
  state.held = [false, false, false, false, false];
  state.rollsLeft = MAX_ROLLS_PER_TURN - 1;
  state.currentPlayer = state.currentPlayer === 1 ? 2 : 1;
}

function resetRoom(room: GameRoom) {
  const [nameA, nameB] = room.state.playerNames;
  room.state = {
    ...createInitialState(),
    playerNames: [nameA, nameB],
  };
  // Update the createdAt to mark this as a new game
  room.createdAt = Date.now();
}

function persistRoom(room: GameRoom) {
  const serializedState = serializeState(room.state);
  const isFinished = room.state.phase === "finished";

  // Verwende eine stabile ID für abgeschlossene Spiele, damit spätere Persist-Aufrufe
  // (z. B. Disconnect/Release) den gleichen Datensatz aktualisieren statt Duplikate zu erzeugen.
  // Stabil: createdAt dient als eindeutiger Marker einer Partie.
  const gameId = isFinished
    ? `${room.id}-finished-${room.createdAt}`
    : room.id;

  const now = Date.now();
  const persistedGame = toPersistedGame({
    roomId: gameId,
    playerTokens: room.tokens,
    state: serializedState,
    createdAt: room.createdAt,
    updatedAt: now,
  });

  if (isFinished) {
    const scores = deriveScores(serializedState);
    const winner = deriveWinner(serializedState, scores);
    persistedGame.finishedAt = now;
    persistedGame.scores = scores;
    persistedGame.winner = winner;
  }

  saveGame(persistedGame);

  // Nach Abschluss sofort aktualisierte History an alle im Raum senden,
  // damit die UI ohne manuellen Refresh die neue Partie sieht.
  if (isFinished) {
    try {
      const history = listHistory(50);
      io.to(room.id).emit("history", history);
    } catch (error) {
      log("warn", "Failed to emit updated history after finish", error);
    }
  }
}

function createInitialState(): GameState {
  return {
    dice: rollDice() as Dice,
    held: [false, false, false, false, false],
    rollsLeft: MAX_ROLLS_PER_TURN - 1,
    currentPlayer: 1,
    scoreSheets: [{}, {}],
    usedCategories: [new Set<Category>(), new Set<Category>()],
    gameOver: false,
    playerNames: ["", ""],
    phase: "setup",
    ready: [false, false],
  };
}

function serializeState(state: GameState): SerializedGameState {
  return {
    ...state,
    usedCategories: [
      Array.from(state.usedCategories[0]),
      Array.from(state.usedCategories[1]),
    ],
  };
}

function materialiseState(serialized: SerializedGameState): GameState {
  return {
    ...serialized,
    usedCategories: [
      new Set(serialized.usedCategories[0]),
      new Set(serialized.usedCategories[1]),
    ],
    ready: serialized.ready ?? [false, false],
    phase: serialized.phase ?? (serialized.gameOver ? "finished" : "setup"),
  };
}

function ensureRoom(roomId: string): GameRoom {
  const existing = rooms.get(roomId);
  if (existing) return existing;

  const persisted = loadGame(roomId);
  const state = persisted ? materialiseState(persisted.state) : createInitialState();
  const createdAt = persisted?.createdAt ?? Date.now();
  const tokens: [string, string] = persisted?.playerTokens ?? [
    generateId("p"),
    generateId("p"),
  ];

  const room: GameRoom = {
    id: roomId,
    state,
    createdAt,
    tokens,
    players: {
      p1: createSlot("p1", 0, state.playerNames[0]),
      p2: createSlot("p2", 1, state.playerNames[1]),
    },
  };

  rooms.set(roomId, room);
  persistRoom(room);
  return room;
}

function createSlot(role: Role, index: 0 | 1, initialName?: string): PlayerSlot {
  const safeName = initialName?.trim() ?? "";
  return {
    role,
    index,
    name: safeName,
    socketId: null,
    connected: false,
    releaseTimer: null,
    releaseDeadline: null,
  };
}

function generateId(prefix: string) {
  return `${prefix}-${randomBytes(12).toString("hex")}`;
}

function sendDenied(socket: Socket, message: string) {
  socket.emit("action-denied", { message });
}

// moved to utils/names.ts

function buildHealthPayload() {
  return {
    status: "ok",
    uptime: Math.round((Date.now() - bootStartedAt) / 1000),
    version: process.env.npm_package_version ?? "0.0.0",
    environment: NODE_ENV,
  };
}








