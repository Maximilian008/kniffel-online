import {
    createInviteToken,
    verifyInvite,
    type InvitePayload,
    type InviteVerificationErrorCode,
} from "@shared/lib";

const DEFAULT_TTL_SECONDS = 60 * 60; // 1 hour

export type InviteStoreFailureCode = InviteVerificationErrorCode | "INVITE_ROOM_MISMATCH" | "INVITE_REVOKED";

export type InviteStoreVerificationResult =
    | { ok: true; record: InviteRecord }
    | { ok: false; code: InviteStoreFailureCode };

export interface InviteRecord {
    token: string;
    roomId: string;
    nonce: string;
    issuedAt: number;
    expiresAt: number;
    lastUsedAt: number | null;
}

export interface InviteStoreOptions {
    secret: string;
    ttlSeconds?: number;
}

export class InviteStore {
    private readonly secret: string;
    private readonly ttlSeconds: number;

    private readonly byToken = new Map<string, InviteRecord>();
    private readonly byRoomId = new Map<string, InviteRecord>();
    private readonly revokedTokens = new Set<string>();

    constructor(options: InviteStoreOptions) {
        this.secret = options.secret;
        this.ttlSeconds = options.ttlSeconds ?? DEFAULT_TTL_SECONDS;
    }

    async issue(roomId: string): Promise<InviteRecord> {
        const { token, payload } = await createInviteToken(roomId, this.secret, {
            ttlSeconds: this.ttlSeconds,
        });
        return this.registerFromPayload(token, payload);
    }

    getByRoom(roomId: string): InviteRecord | undefined {
        return this.byRoomId.get(roomId);
    }

    async verify(token: string, nowMs = Date.now()): Promise<InviteStoreVerificationResult> {
        const existing = this.byToken.get(token);
        if (!existing && this.revokedTokens.has(token)) {
            return { ok: false, code: "INVITE_REVOKED" };
        }

        const verification = await verifyInvite(token, this.secret, nowMs);
        if (!verification.ok) {
            if (verification.code === "INVITE_EXPIRED" && existing) {
                this.removeRecord(existing, "expire");
            }
            return { ok: false, code: verification.code };
        }

        const record = existing ?? this.registerFromPayload(token, verification.payload);

        if (verification.payload.roomId !== record.roomId) {
            this.removeRecord(record, "revoke");
            return { ok: false, code: "INVITE_ROOM_MISMATCH" };
        }

        if (record.expiresAt <= nowMs) {
            this.removeRecord(record, "expire");
            return { ok: false, code: "INVITE_EXPIRED" };
        }

        record.lastUsedAt = nowMs;
        return { ok: true, record };
    }

    revokeRoom(roomId: string): void {
        const record = this.byRoomId.get(roomId);
        if (!record) return;
        this.removeRecord(record, "revoke");
    }

    cleanup(nowMs = Date.now()): number {
        let removed = 0;
        for (const record of this.byToken.values()) {
            if (record.expiresAt <= nowMs) {
                this.removeRecord(record, "expire");
                removed += 1;
            }
        }
        return removed;
    }

    size(): number {
        return this.byToken.size;
    }

    private registerFromPayload(token: string, payload: InvitePayload): InviteRecord {
        const record: InviteRecord = {
            token,
            roomId: payload.roomId,
            nonce: payload.nonce,
            issuedAt: payload.iat * 1000,
            expiresAt: payload.exp * 1000,
            lastUsedAt: null,
        };

        const existingForRoom = this.byRoomId.get(record.roomId);
        if (existingForRoom) {
            this.removeRecord(existingForRoom, "replace");
        }

        this.byToken.set(token, record);
        this.byRoomId.set(record.roomId, record);
        this.revokedTokens.delete(token);
        return record;
    }

    private removeRecord(record: InviteRecord, reason: "revoke" | "replace" | "expire"): void {
        this.byToken.delete(record.token);
        const existing = this.byRoomId.get(record.roomId);
        if (existing && existing.token === record.token) {
            this.byRoomId.delete(record.roomId);
        }
        if (reason === "revoke" || reason === "replace") {
            this.revokedTokens.add(record.token);
        } else if (reason === "expire") {
            this.revokedTokens.delete(record.token);
        }
    }
}

export default InviteStore;
