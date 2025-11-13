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

const INVITE_PREFIX = "mock.";
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ROOM_ID_LENGTH = 8;
const INVITE_TTL_MS = 60 * 60 * 1000;

function generateRoomId() {
    if (typeof window !== "undefined" && window.crypto?.getRandomValues) {
        const buffer = new Uint32Array(ROOM_ID_LENGTH);
        window.crypto.getRandomValues(buffer);
        let result = "";
        for (const value of buffer) {
            result += ALPHABET[value % ALPHABET.length];
        }
        return result;
    }
    let fallback = "";
    for (let index = 0; index < ROOM_ID_LENGTH; index += 1) {
        const randomIndex = Math.floor(Math.random() * ALPHABET.length);
        fallback += ALPHABET[randomIndex];
    }
    return fallback;
}

function formatCode(roomId: string) {
    const base = roomId.replace(/[^A-Z0-9]/gi, "").toUpperCase().padEnd(6, "A").slice(0, 6);
    return `${base.slice(0, 3)}-${base.slice(3, 6)}`;
}

export const mockRoomAdapter: RoomAdapter = {
    name: "mock",

    async create(args: CreateArgs): Promise<CreateResult> {
        const roomId = generateRoomId();
        const code = formatCode(roomId);
        const token = `${INVITE_PREFIX}${roomId}`;
        const hostId = args.playerId ?? roomId;
        const inviteExpiresAt = Date.now() + INVITE_TTL_MS;
        return { ok: true, roomId, token, code, hostId, inviteExpiresAt };
    },

    async join(args: JoinArgs): Promise<JoinResult> {
        if (args.token) {
            const trimmed = args.token.trim();
            if (!trimmed) {
                return { ok: false, error: "INVITE_INVALID" };
            }
            const roomId = trimmed.startsWith(INVITE_PREFIX) ? trimmed.slice(INVITE_PREFIX.length) : trimmed;
            const code = formatCode(roomId);
            const hostId = args.playerId ?? roomId;
            const inviteExpiresAt = Date.now() + INVITE_TTL_MS;
            return { ok: true, roomId, code, hostId, token: `${INVITE_PREFIX}${roomId}`, inviteExpiresAt };
        }

        if (args.code) {
            const normalized = args.code.replace(/[^A-Z0-9]/gi, "").toUpperCase();
            if (normalized.length !== 6) {
                return { ok: false, error: "CODE_INVALID" };
            }
            const roomId = normalized;
            const code = formatCode(roomId);
            const hostId = args.playerId ?? roomId;
            const inviteExpiresAt = Date.now() + INVITE_TTL_MS;
            return { ok: true, roomId, code, hostId, token: `${INVITE_PREFIX}${roomId}`, inviteExpiresAt };
        }

        return { ok: false, error: "Bitte Code oder Einladungstoken angeben." };
    },

    async rejoin(args: RejoinArgs): Promise<RejoinResult> {
        if (!args.roomId) {
            return { ok: false, error: "Raum konnte nicht bestimmt werden." };
        }
        return { ok: true };
    },

    async refreshInvite(args: RefreshInviteArgs): Promise<RefreshInviteResult> {
        const code = formatCode(args.roomId);
        const inviteExpiresAt = Date.now() + INVITE_TTL_MS;
        const hostId = args.playerId ?? args.roomId;
        return {
            ok: true,
            roomId: args.roomId,
            code,
            token: `${INVITE_PREFIX}${args.roomId}`,
            hostId,
            inviteExpiresAt,
        };
    },
};

export function makeMockAdapter(): RoomAdapter {
    return mockRoomAdapter;
}

export default mockRoomAdapter;
