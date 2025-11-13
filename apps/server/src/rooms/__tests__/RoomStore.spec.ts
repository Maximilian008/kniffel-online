import { describe, expect, it } from "vitest";

import { buildGameRoom, createInitialState, generateToken } from "../../rooms/GameRoom.js";
import { InMemoryRoomStore } from "../../rooms/RoomStore.js";

const createRoom = (roomId: string) =>
    buildGameRoom({
        id: roomId,
        capacity: 2,
        state: createInitialState(),
        tokens: [generateToken("p"), generateToken("p")],
    });

describe("InMemoryRoomStore", () => {
    it("creates rooms via loader when absent", () => {
        const store = new InMemoryRoomStore(createRoom);
        const room = store.ensure("test-room");
        expect(room.id).toBe("test-room");
        expect(store.get("test-room")).toBe(room);
        expect(store.size()).toBe(1);
    });

    it("returns existing instances without reloading", () => {
        const store = new InMemoryRoomStore(createRoom);
        const first = store.ensure("same-room");
        const second = store.ensure("same-room");
        expect(second).toBe(first);
    });

    it("allows manual set and delete", () => {
        const store = new InMemoryRoomStore(createRoom);
        const external = createRoom("manual-room");
        store.set(external);
        expect(store.get("manual-room")).toBe(external);
        expect(store.has("manual-room")).toBe(true);
        store.delete("manual-room");
        expect(store.has("manual-room")).toBe(false);
    });
});
