export type AdapterName = "mock" | "http";

export type RoomId = string;
export type RoomCode = string;
export type Token = string;

export type CreateArgs = {
    playerCount: number;
    playerId?: string;
    displayName?: string;
};

export type CreateResult =
    | {
          ok: true;
          roomId: RoomId;
          token: Token;
          code: RoomCode;
          hostId: string | null;
          inviteExpiresAt?: number;
      }
    | { ok: false; error: string };

export type JoinArgs = {
    code?: RoomCode;
    token?: Token;
    displayName?: string;
    playerId?: string;
};

export type JoinResult =
    | {
          ok: true;
          roomId: RoomId;
          code: RoomCode;
          hostId: string | null;
          token?: Token;
          inviteExpiresAt?: number;
      }
    | { ok: false; error: string };

export type RejoinArgs = {
    roomId: RoomId;
    playerId: string;
};

export type RejoinResult =
    | { ok: true }
    | { ok: false; error: string };

export type RefreshInviteArgs = {
    roomId: RoomId;
    playerId?: string;
    currentToken?: Token;
};

export type RefreshInviteResult =
    | {
          ok: true;
          roomId: RoomId;
          token: Token;
          code: RoomCode;
          hostId: string | null;
          inviteExpiresAt?: number;
      }
    | { ok: false; error: string };

export interface RoomAdapter {
    name: AdapterName;
    create(args: CreateArgs): Promise<CreateResult>;
    join(args: JoinArgs): Promise<JoinResult>;
    rejoin(args: RejoinArgs): Promise<RejoinResult>;
    refreshInvite?(args: RefreshInviteArgs): Promise<RefreshInviteResult>;
}
