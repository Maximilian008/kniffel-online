import { beforeEach, describe, expect, it, vi } from "vitest";

import { updateSearchParam } from "../screens/Start/StartScreen";

function makeHistorySpy() {
    return vi.spyOn(window.history, "replaceState").mockImplementation(() => {});
}

describe("updateSearchParam", () => {
    beforeEach(() => {
        window.history.replaceState(null, "", "/?pc=2");
    });

    it("does not thrash when setting the same value", () => {
        const spy = makeHistorySpy();
        updateSearchParam("pc", "2");
        expect(spy).not.toHaveBeenCalled();
        spy.mockRestore();
    });

    it("removes param when null without extra writes", () => {
        const spy = makeHistorySpy();
        updateSearchParam("t", null);
        expect(spy).not.toHaveBeenCalled();
        spy.mockRestore();
    });
});

describe("ensureStorageMigration", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it("migrates legacy yahtzee:* keys to a2:* and cleans originals", async () => {
        vi.resetModules();
        const { ensureStorageMigration } = await import("../storage");
        localStorage.setItem("yahtzee.lastRoomId", "r1");
        ensureStorageMigration();
        expect(localStorage.getItem("a2:lastRoomId")).toBe("r1");
        expect(localStorage.getItem("yahtzee:lastRoomId")).toBeNull();
    });
});
