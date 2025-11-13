import type { Socket } from "socket.io";

import type { InMemoryRoomStore } from "../rooms/RoomStore.js";
import type { GameRoom, Role, RoleAssignment } from "../rooms/types.js";
import type { PlayerIndex } from "../types/shared.js";

export type SocketAssignment = RoleAssignment & { playerId: string | null };

export type PlayerContext = {
    roomId: string;
    room: GameRoom;
    index: PlayerIndex;
    role: Role;
    playerNumber: number;
    playerId: string | null;
};

export function withPlayerContext(
    socket: Socket,
    assignments: Map<string, SocketAssignment>,
    roomStore: InMemoryRoomStore,
    handler: (ctx: PlayerContext) => void | Promise<void>,
): void | Promise<void> {
    const assignment = assignments.get(socket.id);
    if (!assignment) return;

    const room = roomStore.get(assignment.roomId);
    if (!room) return;

    const slot = room.players[assignment.role];
    if (!slot) return;

    return handler({
        roomId: room.id,
        room,
        role: assignment.role,
        index: slot.index,
        playerNumber: slot.index,
        playerId: slot.playerId ?? assignment.playerId ?? null,
    });
}
