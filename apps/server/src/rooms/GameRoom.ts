import { randomBytes } from "node:crypto";

import type {
    Category,
    Dice,
    GameState,
    SerializedGameState,
} from "../types/shared.js";
import { MAX_ROLLS_PER_TURN } from "../types/shared.js";
import { rollDice } from "../utils/gameRules.js";
import type { GameRoom, PlayerSlot, Role } from "./types.js";

export function createInitialState(capacity = 2): GameState {
    const n = Math.max(2, Math.min(6, capacity));
    return {
        dice: rollDice() as Dice,
        held: [false, false, false, false, false],
        rollsLeft: MAX_ROLLS_PER_TURN - 1,
        currentPlayer: 0,
        scoreSheets: Array.from({ length: n }, () => ({})),
        usedCategories: Array.from({ length: n }, () => new Set<Category>()),
        gameOver: false,
        playerNames: Array.from({ length: n }, () => ""),
        phase: "setup",
        ready: Array.from({ length: n }, () => false),
    };
}

export function serializeGameState(state: GameState): SerializedGameState {
    return {
        ...state,
        usedCategories: state.usedCategories.map((s) => Array.from(s)),
    };
}

export function materialiseGameState(serialized: SerializedGameState): GameState {
    const used = (serialized.usedCategories ?? []).map((arr) => new Set(arr));
    const n = Math.max(
        2,
        used.length,
        serialized.playerNames?.length ?? 0,
        serialized.scoreSheets?.length ?? 0,
    );
    return {
        ...serialized,
        usedCategories: used,
        ready:
            serialized.ready && serialized.ready.length === n
                ? serialized.ready
                : Array.from({ length: n }, () => false),
        phase: serialized.phase ?? (serialized.gameOver ? "finished" : "setup"),
    };
}

export function createPlayerSlot(
    role: Role,
    index: number,
    initialName?: string,
    playerId: string | null = null,
): PlayerSlot {
    const safeName = initialName?.trim() ?? "";
    return {
        role,
        index,
        name: safeName,
        playerId,
        socketId: null,
        connected: false,
        releaseTimer: null,
        releaseDeadline: null,
    };
}

export function generateToken(prefix: string) {
    return `${prefix}-${randomBytes(12).toString("hex")}`;
}

export function buildGameRoom(params: {
    id: string;
    capacity: number;
    state: GameState;
    tokens: [string, string];
    playerNames?: string[];
    createdAt?: number;
    meta?: {
        hostId?: string | null;
    };
}): GameRoom {
    const { id, capacity, state, tokens, playerNames } = params;

    if (playerNames) {
        playerNames.forEach((name, index) => {
            if (state.playerNames[index] === undefined) {
                state.playerNames[index] = name;
            }
        });
    }

    return {
        id,
        state,
        createdAt: params.createdAt ?? Date.now(),
        capacity,
        players: {
            p1: createPlayerSlot("p1", 0, state.playerNames[0]),
            p2: createPlayerSlot("p2", 1, state.playerNames[1]),
        },
        meta: {
            hostId: params.meta?.hostId ?? null,
        },
        tokens,
    };
}
