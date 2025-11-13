import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import * as room from "../hooks/useRoom";
import { type GuardParams, useSessionGuard } from "../hooks/useSessionGuard";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("useSessionGuard idempotency", () => {
    it("fires join at most once and aborts cleanly on unmount", async () => {
        const joinSpy = vi.spyOn(room, "joinRoom").mockImplementation(async () => {
            await delay(50);
            return { ok: true, roomId: "r1", code: "ABC234", hostId: "host" } as const;
        });

        const { unmount } = renderHook(() => useSessionGuard({ token: "tok" }));

        await act(async () => {
            await delay(10);
        });

        unmount();

        expect(joinSpy).toHaveBeenCalledTimes(1);
        joinSpy.mockRestore();
    });

    it("prefers token over code", async () => {
        const joinSpy = vi
            .spyOn(room, "joinRoom")
            .mockResolvedValue({ ok: true, roomId: "r1", code: "ABC234", hostId: "host" } as const);

        const initialProps: GuardParams = { token: "tok", code: "ABC234" };
        const { rerender } = renderHook((props: GuardParams) => useSessionGuard(props), {
            initialProps,
        });

        await act(async () => {
            await delay(0);
        });

        expect(joinSpy).toHaveBeenCalledWith(expect.objectContaining({ token: "tok" }));

        rerender({ code: "ABC234" });

        await act(async () => {
            await delay(0);
        });

        joinSpy.mockRestore();
    });
});
