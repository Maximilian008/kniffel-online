import { useCallback, useState } from "react";

const LAST_ROOM_KEY = "yahtzee.lastRoomId";
const ROOM_CODE_PATTERN = /^[A-Z2-9]{3}-[A-Z2-9]{3}$/;
const INVITE_PREFIX = "mock.";

export type RoomState = "idle" | "creating" | "joining" | "lobby";
export type CreateArgs = { name: string; playerCount: number };
export type JoinArgs = { code?: string; token?: string };

function generateRoomId() {
    if (typeof window !== "undefined" && window.crypto?.randomUUID) {
        return window.crypto.randomUUID().slice(0, 8);
    }
    const random = Math.random().toString(36).slice(2, 10);
    return random.toUpperCase();
}

function generateCode(roomId: string) {
    const base = roomId.replace(/[^A-Z0-9]/gi, "").toUpperCase().padEnd(6, "A").slice(0, 6);
    return `${base.slice(0, 3)}-${base.slice(3, 6)}`;
}

function readLastRoomId() {
    if (typeof window === "undefined") return null;
    try {
        const value = window.localStorage.getItem(LAST_ROOM_KEY);
        return value && value.length > 0 ? value : null;
    } catch {
        return null;
    }
}

function writeLastRoomId(roomId: string | null) {
    if (typeof window === "undefined") return;
    try {
        if (roomId) {
            window.localStorage.setItem(LAST_ROOM_KEY, roomId);
        } else {
            window.localStorage.removeItem(LAST_ROOM_KEY);
        }
    } catch {
        // ignore
    }
}

/**
 * Provides mocked room management helpers for the new start flow.
 * Keeps the latest room identifier in localStorage for rejoin attempts.
 */
export function useRoom() {
    const [state, setState] = useState<RoomState>("idle");
    const [error, setError] = useState<string | null>(null);

    /**
     * Creates a mock room using supplied name and player count.
     */
    const create = useCallback(async ({ name, playerCount }: CreateArgs) => {
        setError(null);
        setState("creating");
        await new Promise((resolve) => setTimeout(resolve, 300));

        if (!name.trim()) {
            setError("Name darf nicht leer sein.");
            setState("idle");
            throw new Error("Name required");
        }
        if (playerCount < 2 || playerCount > 6) {
            setError("Spieleranzahl außerhalb des erlaubten Bereichs.");
            setState("idle");
            throw new Error("Invalid player count");
        }

        const roomId = generateRoomId();
        const code = generateCode(roomId);
        const inviteToken = `${INVITE_PREFIX}${roomId}`;
        writeLastRoomId(roomId);
        setState("lobby");
        return { roomId, code, inviteToken } as const;
    }, []);

    /**
     * Attempts to join a room using either a short code or invite token.
     */
    const join = useCallback(async ({ code, token }: JoinArgs) => {
        setError(null);
        setState("joining");
        await new Promise((resolve) => setTimeout(resolve, 200));

        let roomId: string | null = null;
        if (token) {
            if (!token.startsWith(INVITE_PREFIX)) {
                setError("Einladungstoken ungültig.");
                setState("idle");
                throw new Error("Invalid token");
            }
            roomId = token.slice(INVITE_PREFIX.length);
        } else if (code) {
            if (!ROOM_CODE_PATTERN.test(code)) {
                setError("Spielcode ungültig.");
                setState("idle");
                throw new Error("Invalid code");
            }
            roomId = code.replace("-", "");
        } else {
            setError("Bitte Code oder Einladungstoken angeben.");
            setState("idle");
            throw new Error("Missing join argument");
        }

        writeLastRoomId(roomId);
        setState("lobby");
        return { roomId } as const;
    }, []);

    /**
     * Rejoins a room when the cached last room id matches the requested id.
     */
    const rejoin = useCallback(async ({ roomId }: { roomId: string }) => {
        setError(null);
        setState("joining");
        await new Promise((resolve) => setTimeout(resolve, 150));

        const stored = readLastRoomId();
        if (!stored || stored !== roomId) {
            setError("Keine laufende Sitzung gefunden.");
            setState("idle");
            throw new Error("Room mismatch");
        }

        setState("lobby");
    }, []);

    return {
        state,
        error,
        create,
        join,
        rejoin,
    } as const;
}
