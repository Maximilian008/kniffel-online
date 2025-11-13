import { describe, expect, it } from "vitest";

import { createInviteToken, verifyInvite } from "../room/invite.js";

const SECRET = "unit-test-secret";

describe("invite signing and verification", () => {
    it("signs and verifies a valid invite", async () => {
        const fixedNow = 1_700_000_000_000;
        const { token, payload } = await createInviteToken("room-123", SECRET, {
            ttlSeconds: 60,
            now: fixedNow,
            nonceGenerator: () => "nonce-abc",
        });

        const result = await verifyInvite(token, SECRET, fixedNow + 5_000);
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.payload.roomId).toBe(payload.roomId);
            expect(result.payload.nonce).toBe("nonce-abc");
        }
    });

    it("rejects tampered tokens", async () => {
        const { token } = await createInviteToken("room-123", SECRET);
        const tampered = token.replace(/\./, "X.");
        const result = await verifyInvite(tampered, SECRET);
        expect(result).toEqual({ ok: false, code: "INVITE_TAMPERED" });
    });

    it("rejects expired invites", async () => {
        const now = Date.now();
        const { token, payload } = await createInviteToken("room-123", SECRET, { ttlSeconds: 1, now });
        const result = await verifyInvite(token, SECRET, (payload.exp + 10) * 1000);
        expect(result).toEqual({ ok: false, code: "INVITE_EXPIRED" });
    });
});
