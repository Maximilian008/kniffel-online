import { useCallback, useEffect, useState } from "react";

import type {
    AdapterName,
    RoomAdapter,
    CreateArgs as AdapterCreateArgs,
    CreateResult as AdapterCreateResult,
    JoinArgs as AdapterJoinArgs,
    JoinResult as AdapterJoinResult,
    RejoinArgs as AdapterRejoinArgs,
    RejoinResult as AdapterRejoinResult,
    RefreshInviteArgs as AdapterRefreshInviteArgs,
    RefreshInviteResult as AdapterRefreshInviteResult,
} from "../adapters/room/types";
import { a2Key, ensureStorageMigration } from "../storage";
import { useIdentity } from "./useIdentity";

const LAST_ROOM_KEY = a2Key("lastRoomId");
const ROOM_CODE_PATTERN = /^[A-Z2-9]{3}-[A-Z2-9]{3}$/;

const adapterName = ((import.meta as any).env?.VITE_ROOM_ADAPTER ?? "mock") as AdapterName;
export { adapterName };

let cachedAdapter: RoomAdapter | null = null;
type LatestIdentity = { playerId: string | null; safeName?: string };
let latestIdentity: LatestIdentity = { playerId: null, safeName: undefined };

export function formatJoinError(error?: string | null): string {
    if (!error) return "Beitreten fehlgeschlagen.";
    const normalized = error.toUpperCase();
    if (normalized.includes("INVITE_EXPIRED")) {
        return "Diese Einladung ist abgelaufen. Bitte fordere einen neuen Link an.";
    }
    if (normalized.includes("INVITE_REVOKED")) {
        return "Dieser Einladungslink wurde ersetzt. Bitte verwende den aktuellsten Link.";
    }
    if (normalized.includes("INVITE_ROOM_MISMATCH")) {
        return "Der Einladungslink passt nicht zu diesem Spiel.";
    }
    if (normalized.includes("INVITE_INVALID")) {
        return "Einladungstoken ist ungueltig.";
    }
    if (normalized.includes("CODE_INVALID")) {
        return "Spielcode ist ungueltig.";
    }
    if (normalized.includes("INVITE_REFRESH_FORBIDDEN")) {
        return "Nur der Host kann die Einladung erneuern.";
    }
    if (normalized.includes("INVITE_REFRESH_FAILED")) {
        return "Einladung konnte nicht erneuert werden.";
    }
    if (normalized.includes("ROOM_NOT_FOUND")) {
        return "Das Spiel konnte nicht gefunden werden.";
    }
    return error ?? "Aktion fehlgeschlagen.";
}


function updateLatestIdentity(playerId: string | null, safeName: string | undefined) {
    latestIdentity = { playerId, safeName };
}

async function getAdapter(): Promise<RoomAdapter> {
    if (cachedAdapter) return cachedAdapter;

    if (adapterName === "http") {
        const mod = await import("../adapters/room/http");
        cachedAdapter = mod.httpRoomAdapter;
    } else {
        const mod: any = await import("../adapters/room/mock");
        cachedAdapter =
            mod.mockRoomAdapter ??
            mod.default ??
            (typeof mod.makeMockAdapter === "function" ? mod.makeMockAdapter() : null);
    }

    if (!cachedAdapter) {
        throw new Error(`Room adapter "${adapterName}" could not be resolved.`);
    }

    return cachedAdapter;
}

export async function createRoom(args: AdapterCreateArgs): Promise<AdapterCreateResult> {
    const adapter = await getAdapter();
    const playerId = args.playerId ?? latestIdentity.playerId ?? null;
    const payload: AdapterCreateArgs = { ...args, playerId: playerId ?? undefined };
    if (latestIdentity.safeName !== undefined) {
        payload.displayName = latestIdentity.safeName;
    }
    return adapter.create(payload);
}

export async function joinRoom(args: AdapterJoinArgs): Promise<AdapterJoinResult> {
    const adapter = await getAdapter();
    const payload: AdapterJoinArgs = {
        ...args,
        playerId: args.playerId ?? latestIdentity.playerId ?? undefined,
    };
    if (latestIdentity.safeName !== undefined) {
        payload.displayName = latestIdentity.safeName;
    }
    return adapter.join(payload);
}

export async function rejoinRoom(args: AdapterRejoinArgs): Promise<AdapterRejoinResult> {
    const adapter = await getAdapter();
    const identityPlayerId = latestIdentity.playerId ?? args.playerId ?? null;
    if (!identityPlayerId) {
        return Promise.resolve({ ok: false, error: "Missing player identity" });
    }
    return adapter.rejoin({ roomId: args.roomId, playerId: identityPlayerId });
}

export async function refreshRoomInvite(
    args: AdapterRefreshInviteArgs,
): Promise<AdapterRefreshInviteResult> {
    const adapter = await getAdapter();
    if (typeof adapter.refreshInvite !== "function") {
        return { ok: false, error: "Invite refresh not supported" };
    }
    return adapter.refreshInvite(args);
}

function readLastRoomId() {
    if (typeof window === "undefined") return null;
    ensureStorageMigration();
    try {
        const value = window.localStorage.getItem(LAST_ROOM_KEY);
        return value && value.length > 0 ? value : null;
    } catch {
        return null;
    }
}

function writeLastRoomId(roomId: string | null) {
    if (typeof window === "undefined") return;
    ensureStorageMigration();
    try {
        if (roomId) {
            window.localStorage.setItem(LAST_ROOM_KEY, roomId);
        } else {
            window.localStorage.removeItem(LAST_ROOM_KEY);
        }
    } catch {
        // ignore storage failures
    }
}

export type RoomState = "idle" | "creating" | "joining" | "lobby";
export type CreateRequest = { name: string; playerCount: number };
export type JoinRequest = { code?: string; token?: string };
export type RejoinRequest = { roomId: string };

export function useRoom() {
    const { playerId, displayName } = useIdentity();
    const safeName = (displayName ?? "").trim() || undefined;

    useEffect(() => {
        updateLatestIdentity(playerId, safeName);
    }, [playerId, safeName]);

    const [state, setState] = useState<RoomState>("idle");
    const [error, setError] = useState<string | null>(null);

    const create = useCallback(
        async ({ name, playerCount }: CreateRequest) => {
            setError(null);
            setState("creating");
            await new Promise((resolve) => setTimeout(resolve, 300));

            const trimmedName = name.trim();
            if (!trimmedName) {
                const message = "Name darf nicht leer sein.";
                setError(message);
                setState("idle");
                throw new Error(message);
            }
            if (playerCount < 2 || playerCount > 6) {
                const message = "Spieleranzahl ausserhalb des erlaubten Bereichs.";
                setError(message);
                setState("idle");
                throw new Error(message);
            }

            const result = await createRoom({ playerCount, displayName: safeName });
            if (!result.ok) {
                const message = result.error ?? "Erstellen fehlgeschlagen.";
                setError(message);
                setState("idle");
                throw new Error(message);
            }

            writeLastRoomId(result.roomId);
            setState("lobby");
            return {
                roomId: result.roomId,
                code: result.code,
                inviteToken: result.token,
                hostId: result.hostId ?? null,
                inviteExpiresAt: result.inviteExpiresAt ?? null,
            } as const;
        },
        [safeName],
    );

    const join = useCallback(
        async ({ code, token }: JoinRequest) => {
            setError(null);
            setState("joining");
            await new Promise((resolve) => setTimeout(resolve, 200));

            const trimmedToken = token?.trim();
            let normalizedCode: string | null = null;

            if (!trimmedToken && code) {
                const trimmed = code.trim().toUpperCase();
                const alphanumeric = trimmed.replace(/[^A-Z0-9]/g, "");
                if (alphanumeric.length !== 6) {
                    const message = "Spielcode ungueltig.";
                    setError(message);
                    setState("idle");
                    throw new Error(message);
                }
                const formatted = `${alphanumeric.slice(0, 3)}-${alphanumeric.slice(3, 6)}`;
                if (!ROOM_CODE_PATTERN.test(formatted)) {
                    const message = "Spielcode ungueltig.";
                    setError(message);
                    setState("idle");
                    throw new Error(message);
                }
                normalizedCode = formatted;
            }

            if (!trimmedToken && !normalizedCode) {
                const message = "Bitte Code oder Einladungstoken angeben.";
                setError(message);
                setState("idle");
                throw new Error(message);
            }

            const adapterArgs: AdapterJoinArgs = {};
            if (trimmedToken) adapterArgs.token = trimmedToken;
            if (normalizedCode) adapterArgs.code = normalizedCode;

            const result = await joinRoom({ ...adapterArgs, displayName: safeName });
            if (!result.ok) {
                const message = formatJoinError(result.error);
                setError(message);
                setState("idle");
                throw new Error(message);
            }

            writeLastRoomId(result.roomId);
            setState("lobby");
            return {
                ok: true as const,
                roomId: result.roomId,
                code: result.code,
                hostId: result.hostId ?? null,
                inviteToken: result.token ?? null,
                inviteExpiresAt: result.inviteExpiresAt ?? null,
            };
        },
        [safeName],
    );

    const refreshInvite = useCallback(
        async (roomId: string, currentToken?: string | null) => {
            setError(null);
            const result = await refreshRoomInvite({
                roomId,
                playerId: playerId ?? undefined,
                currentToken: currentToken ?? undefined,
            });
            if (!result.ok) {
                const message = formatJoinError(result.error);
                setError(message);
                throw new Error(message);
            }
            return result;
        },
        [playerId],
    );

    const rejoin = useCallback(
        async ({ roomId }: RejoinRequest) => {
            setError(null);
            setState("joining");
            await new Promise((resolve) => setTimeout(resolve, 150));

            const stored = readLastRoomId();
            if (!stored || stored !== roomId) {
                const message = "Keine laufende Sitzung gefunden.";
                setError(message);
                setState("idle");
                throw new Error(message);
            }

            if (!playerId) {
                const message = "Spieleridentitaet nicht gefunden.";
                setError(message);
                setState("idle");
                throw new Error(message);
            }

            const result = await rejoinRoom({ roomId, playerId });
            if (!result.ok) {
                const message = result.error ?? "Fortsetzen fehlgeschlagen.";
                setError(message);
                setState("idle");
                throw new Error(message);
            }

            setState("lobby");
        },
        [playerId],
    );

    return {
        state,
        error,
        create,
        join,
        refreshInvite,
        rejoin,
    } as const;
}












