import { describe, expect, it, vi } from "vitest";

import type { RoomAdapter } from "../adapters/room/types";
import { httpRoomAdapter } from "../adapters/room/http";

const fakeOk: RoomAdapter = {
    name: "mock",
    async create(args) {
        return { ok: true as const, roomId: "r1", token: "t1", code: "ABC234", hostId: args.playerId ?? "host" };
    },
    async join() {
        return { ok: true as const, roomId: "r1", code: "ABC234", hostId: "host" };
    },
    async rejoin() {
        return { ok: true as const };
    },
};

describe("RoomAdapter contract", () => {
    it("fakeOk returns discriminated results without throwing", async () => {
        await expect(fakeOk.create({ playerCount: 2 })).resolves.toMatchObject({ ok: true });
        await expect(fakeOk.join({ code: "ABC234" })).resolves.toMatchObject({ ok: true });
        await expect(fakeOk.rejoin({ roomId: "r1", playerId: "p1" })).resolves.toMatchObject({
            ok: true,
        });
    });

    it("http adapter surfaces HTTP failures as { ok:false, error }", async () => {
        const originalFetch = globalThis.fetch;
        const response = new Response("boom", { status: 500 });
        globalThis.fetch = vi.fn(async () => response) as unknown as typeof fetch;

        const result = await httpRoomAdapter.create({ playerCount: 2 });
        expect(result.ok).toBe(false);
        expect((result as { error?: string }).error).toBeTruthy();

        globalThis.fetch = originalFetch!;
    });
});
