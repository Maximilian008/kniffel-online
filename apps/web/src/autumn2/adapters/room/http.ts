import type {
    RoomAdapter,
    CreateArgs,
    CreateResult,
    JoinArgs,
    JoinResult,
    RejoinArgs,
    RejoinResult,
    RefreshInviteArgs,
    RefreshInviteResult,
} from "./types";

const BASE = (import.meta as any)?.env?.VITE_API_BASE ?? "";

function withTimeout<T>(promise: Promise<T>, ms = 8000): Promise<T> {
    return new Promise((resolve, reject) => {
        const id = setTimeout(() => reject(new Error("timeout")), ms);
        promise
            .then((value) => {
                clearTimeout(id);
                resolve(value);
            })
            .catch((error) => {
                clearTimeout(id);
                reject(error);
            });
    });
}

async function postJSON<T>(url: string, body: unknown) {
    try {
        const resp = await withTimeout(
            fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body ?? {}),
            }),
        );
        if (!resp.ok) {
            const text = await resp.text().catch(() => "");
            return { ok: false as const, error: `HTTP ${resp.status}${text ? `: ${text}` : ""}` };
        }
        const data = (await resp.json()) as T;
        return { ok: true as const, data };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Network error";
        return { ok: false as const, error: message };
    }
}

export const httpRoomAdapter: RoomAdapter = {
    name: "http",

    async create(args: CreateArgs): Promise<CreateResult> {
        const res = await postJSON<{
            roomId: string;
            token: string;
            code: string;
            hostId: string;
            inviteExpiresAt?: number;
        }>(
            `${BASE}/api/rooms`,
            args,
        );
        if (!res.ok || !res.data) return { ok: false, error: res.error ?? "Unknown error" };
        const { roomId, token, code, hostId, inviteExpiresAt } = res.data;
        return { ok: true, roomId, token, code, hostId, inviteExpiresAt };
    },

    async join(args: JoinArgs): Promise<JoinResult> {
        const res = await postJSON<{
            roomId: string;
            code: string;
            hostId: string;
            token?: string;
            inviteExpiresAt?: number;
        }>(
            `${BASE}/api/rooms/join`,
            args,
        );
        if (!res.ok || !res.data) return { ok: false, error: res.error ?? "Unknown error" };
        const { roomId, code, hostId, token, inviteExpiresAt } = res.data;
        return { ok: true, roomId, code, hostId, token, inviteExpiresAt };
    },

    async rejoin(args: RejoinArgs): Promise<RejoinResult> {
        const res = await postJSON<{ ok: true }>(`${BASE}/api/rooms/rejoin`, args);
        if (!res.ok || !res.data) return { ok: false, error: res.error ?? "Unknown error" };
        return { ok: true };
    },

    async refreshInvite(args: RefreshInviteArgs): Promise<RefreshInviteResult> {
        const res = await postJSON<{
            roomId: string;
            code: string;
            token: string;
            hostId: string | null;
            inviteExpiresAt?: number;
        }>(`${BASE}/api/rooms/${encodeURIComponent(args.roomId)}/invite`, {
            playerId: args.playerId,
            token: args.currentToken,
        });
        if (!res.ok || !res.data) return { ok: false, error: res.error ?? "Unknown error" };
        const { roomId, code, token, hostId, inviteExpiresAt } = res.data;
        return { ok: true, roomId, code, token, hostId: hostId ?? null, inviteExpiresAt };
    },
};
