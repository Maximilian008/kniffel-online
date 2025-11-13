import { randomInt, randomUUID } from "node:crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;

export type RoomDirectoryEntry = {
    roomId: string;
    code: string;
    normalizedCode: string;
    inviteToken: string;
    createdAt: number;
    updatedAt: number;
};

function generateRawCode(): string {
    let result = "";
    for (let index = 0; index < CODE_LENGTH; index += 1) {
        result += ALPHABET[randomInt(0, ALPHABET.length)];
    }
    return result;
}

export function formatCode(raw: string): string {
    const clean = raw.toUpperCase().replace(/[^A-Z2-9]/g, "");
    if (clean.length !== CODE_LENGTH) return clean;
    return `${clean.slice(0, 3)}-${clean.slice(3, 6)}`;
}

export function normalizeCode(value: string): string | null {
    const filtered = value
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .replace(/[IO01]/g, "");
    if (filtered.length !== CODE_LENGTH) return null;
    return filtered;
}

export class RoomDirectory {
    private readonly byRoomId = new Map<string, RoomDirectoryEntry>();
    private readonly byCode = new Map<string, RoomDirectoryEntry>();
    private readonly byToken = new Map<string, RoomDirectoryEntry>();

    constructor(entries: RoomDirectoryEntry[] = []) {
        for (const entry of entries) {
            this.registerEntry(entry);
        }
    }

    private registerEntry(entry: RoomDirectoryEntry) {
        const previous = this.byRoomId.get(entry.roomId);
        if (previous) {
            this.byCode.delete(previous.normalizedCode);
            this.byToken.delete(previous.inviteToken);
        }
        this.byRoomId.set(entry.roomId, entry);
        this.byCode.set(entry.normalizedCode, entry);
        this.byToken.set(entry.inviteToken, entry);
    }

    create(roomId: string, options?: { inviteToken?: string }): RoomDirectoryEntry {
        const existing = this.byRoomId.get(roomId);
        if (existing) {
            if (options?.inviteToken && existing.inviteToken !== options.inviteToken) {
                this.byToken.delete(existing.inviteToken);
                existing.inviteToken = options.inviteToken;
                this.byToken.set(existing.inviteToken, existing);
            }
            existing.updatedAt = Date.now();
            return existing;
        }

        let rawCode: string;
        let normalized: string;
        do {
            rawCode = generateRawCode();
            normalized = rawCode;
        } while (this.byCode.has(normalized));

        const inviteToken = options?.inviteToken ?? randomUUID();
        const now = Date.now();
        const entry: RoomDirectoryEntry = {
            roomId,
            code: formatCode(rawCode),
            normalizedCode: normalized,
            inviteToken,
            createdAt: now,
            updatedAt: now,
        };

        this.registerEntry(entry);
        return entry;
    }

    getByRoomId(roomId: string): RoomDirectoryEntry | undefined {
        return this.byRoomId.get(roomId);
    }

    getByCode(code: string): RoomDirectoryEntry | undefined {
        const normalized = normalizeCode(code);
        if (!normalized) return undefined;
        return this.byCode.get(normalized);
    }

    getByToken(token: string): RoomDirectoryEntry | undefined {
        if (!token) return undefined;
        return this.byToken.get(token);
    }

    touch(roomId: string): RoomDirectoryEntry | undefined {
        const entry = this.byRoomId.get(roomId);
        if (!entry) return undefined;
        entry.updatedAt = Date.now();
        return entry;
    }

    values(): IterableIterator<RoomDirectoryEntry> {
        return this.byRoomId.values();
    }

    delete(roomId: string): void {
        const entry = this.byRoomId.get(roomId);
        if (!entry) return;
        this.byRoomId.delete(roomId);
        this.byCode.delete(entry.normalizedCode);
        this.byToken.delete(entry.inviteToken);
    }
}
