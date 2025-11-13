import { useCallback, useEffect, useState } from "react";

import { a2Key, ensureStorageMigration } from "../storage";

const PLAYER_ID_KEY = a2Key("playerId");
const DISPLAY_NAME_KEY = a2Key("displayName");

function readLocalStorageValue(key: string) {
    if (typeof window === "undefined") return null;
    ensureStorageMigration();
    try {
        const value = window.localStorage.getItem(key);
        return value && value.length > 0 ? value : null;
    } catch {
        return null;
    }
}

function writeLocalStorageValue(key: string, value: string) {
    if (typeof window === "undefined") return;
    ensureStorageMigration();
    try {
        window.localStorage.setItem(key, value);
    } catch {
        // ignore storage failures (e.g., quota exceeded, private mode)
    }
}

function generateId() {
    if (typeof window !== "undefined" && typeof window.crypto?.randomUUID === "function") {
        return window.crypto.randomUUID();
    }
    const random = Math.random().toString(16).slice(2, 10);
    const time = Date.now().toString(16);
    return `${time}-${random}`;
}

/**
 * Manages a persistent local player identity consisting of an ID and optional display name.
 */
export function useIdentity() {
    const [playerId] = useState<string>(() => {
        const existing = readLocalStorageValue(PLAYER_ID_KEY);
        if (existing) return existing;
        const nextId = generateId();
        writeLocalStorageValue(PLAYER_ID_KEY, nextId);
        return nextId;
    });
    const [displayName, setDisplayNameState] = useState<string | undefined>(() => readLocalStorageValue(DISPLAY_NAME_KEY) ?? undefined);

    useEffect(() => {
        if (displayName === undefined) {
            if (typeof window !== "undefined") {
                ensureStorageMigration();
                window.localStorage.removeItem(DISPLAY_NAME_KEY);
            }
            return;
        }
        const trimmed = displayName.trim();
        if (!trimmed) {
            if (typeof window !== "undefined") {
                ensureStorageMigration();
                window.localStorage.removeItem(DISPLAY_NAME_KEY);
            }
            return;
        }
        writeLocalStorageValue(DISPLAY_NAME_KEY, trimmed);
    }, [displayName]);

    const setDisplayName = useCallback((name: string) => {
        setDisplayNameState(name);
    }, []);

    return {
        playerId,
        displayName,
        setDisplayName,
    } as const;
}
