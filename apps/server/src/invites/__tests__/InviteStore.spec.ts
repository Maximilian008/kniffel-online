import { describe, expect, it } from "vitest";

import InviteStore from "../InviteStore.js";

const SECRET = "unit-test-secret";

describe("InviteStore", () => {
    it("issues and verifies invite tokens", async () => {
        const store = new InviteStore({ secret: SECRET, ttlSeconds: 120 });
        const record = await store.issue("room-123");

        const verification = await store.verify(record.token, record.issuedAt + 1_000);
        expect(verification.ok).toBe(true);
        if (verification.ok) {
            expect(verification.record.roomId).toBe("room-123");
        }
    });

    it("rejects expired tokens", async () => {
        const store = new InviteStore({ secret: SECRET, ttlSeconds: 1 });
        const record = await store.issue("room-expiring");

        const verification = await store.verify(record.token, record.expiresAt + 5_000);
        expect(verification).toEqual({ ok: false, code: "INVITE_EXPIRED" });
    });

    it("does not allow revoked tokens to be re-validated", async () => {
        const store = new InviteStore({ secret: SECRET, ttlSeconds: 300 });
        const record = await store.issue("room-revoke");

        store.revokeRoom("room-revoke");

        const verification = await store.verify(record.token);
        expect(verification).toEqual({ ok: false, code: "INVITE_REVOKED" });
    });
});
