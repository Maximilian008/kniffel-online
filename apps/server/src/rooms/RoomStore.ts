import type { GameRoom, RoomId } from "./types.js";

export interface RoomStore {
    ensure(roomId: RoomId): GameRoom;
    get(roomId: RoomId): GameRoom | undefined;
    has(roomId: RoomId): boolean;
    set(room: GameRoom): void;
    delete(roomId: RoomId): void;
    values(): IterableIterator<GameRoom>;
    size(): number;
}

export type RoomLoader = (roomId: RoomId) => GameRoom;

export class InMemoryRoomStore implements RoomStore {
    private readonly rooms = new Map<RoomId, GameRoom>();

    constructor(private readonly loader: RoomLoader) {}

    ensure(roomId: RoomId): GameRoom {
        const existing = this.rooms.get(roomId);
        if (existing) return existing;
        const next = this.loader(roomId);
        this.rooms.set(roomId, next);
        return next;
    }

    get(roomId: RoomId): GameRoom | undefined {
        return this.rooms.get(roomId);
    }

    has(roomId: RoomId): boolean {
        return this.rooms.has(roomId);
    }

    set(room: GameRoom): void {
        this.rooms.set(room.id, room);
    }

    delete(roomId: RoomId): void {
        this.rooms.delete(roomId);
    }

    values(): IterableIterator<GameRoom> {
        return this.rooms.values();
    }

    size(): number {
        return this.rooms.size;
    }
}
