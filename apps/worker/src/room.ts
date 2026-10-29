import {
  chooseCategory,
  clampPlayerCount,
  createGame,
  determineWinner,
  MAX_PLAYERS,
  nameKey,
  normaliseName,
  roleToSeat,
  roll,
  SEAT_RELEASE_GRACE_MS,
  seatToRole,
  setPlayerCount,
  setPlayerName,
  setReady,
  toggleHold,
  totalScore,
  type ActionResult,
  type Envelope,
  type GameState,
  type HistoryEntry,
  type HistoryQuery,
  type RoleStatus,
  type RoomStatus,
  type ServerEvents,
} from "@kniffel/game";

/**
 * The game room: seats, connections and game actions. Independent of Cloudflare so it can be
 * unit tested; the Durable Object (durable-object.ts) only wires sockets and storage to it.
 */

/** A player's claim on a seat. `playerId` is a random id the browser keeps in localStorage. */
export interface Seat {
  playerId: string | null;
  name: string;
  /** Set while the seat's player is disconnected: when they were last seen. */
  lastSeen: number | null;
}

export interface RoomData {
  version: 1;
  roomId: string;
  game: GameState;
  seats: Seat[];
}

/** One open WebSocket. Stored as the socket's attachment so it survives hibernation. */
export interface Connection {
  id: string;
  playerId: string | null;
  seat: number | null;
}

export interface Transport {
  /** Currently open connections. */
  connections(): Connection[];
  /** Persists changed connection metadata. */
  update(connection: Connection): void;
  send<K extends keyof ServerEvents>(connectionId: string, type: K, data: ServerEvents[K]): void;
}

export interface HistoryStore {
  add(entry: HistoryEntry): Promise<void>;
  all(): Promise<HistoryEntry[]>;
}

export interface Environment {
  now(): number;
  random(): number;
  newId(): string;
}

const PLAYER_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;
const MAX_MESSAGE_LENGTH = 4096;

const emptySeat = (): Seat => ({ playerId: null, name: "", lastSeen: null });

export function createRoomData(roomId: string, env: Pick<Environment, "random">): RoomData {
  return {
    version: 1,
    roomId,
    game: createGame(2, [], env.random),
    seats: Array.from({ length: MAX_PLAYERS }, emptySeat),
  };
}

export function filterHistory(entries: HistoryEntry[], query: HistoryQuery = {}): HistoryEntry[] {
  const limit = Number.isFinite(query.limit) ? Math.max(1, Math.min(200, Math.floor(query.limit!))) : 50;
  const players = (Array.isArray(query.players) ? query.players : []).map(nameKey).filter(Boolean);
  const mode = query.mode === "contains" ? "contains" : "exact";
  return [...entries]
    .sort((a, b) => b.finishedAt - a.finishedAt)
    .filter((entry) => {
      if (players.length === 0) return true;
      const participants = new Set(entry.playerNames.map(nameKey));
      return mode === "contains" ? players.some((p) => participants.has(p)) : players.every((p) => participants.has(p));
    })
    .slice(0, limit);
}

export class Room {
  /** True when `data` changed and must be saved. */
  dirty = false;

  constructor(
    public data: RoomData,
    private readonly transport: Transport,
    private readonly history: HistoryStore,
    private readonly env: Environment,
  ) {}

  /**
   * After a restart no sockets survive, so nobody ever "disconnected". Start the grace period for
   * seats without a live connection now, so they can be taken over if their player never returns.
   */
  startGracePeriodForOrphanedSeats(): void {
    this.data.seats.forEach((seat, index) => {
      if (seat.playerId !== null && seat.lastSeen === null && !this.isSeatConnected(index)) {
        seat.lastSeen = this.env.now();
        this.dirty = true;
      }
    });
  }

  get capacity(): number {
    return this.data.game.playerNames.length;
  }

  // ---- connection lifecycle -------------------------------------------------------------

  onOpen(connection: Connection): void {
    this.transport.send(connection.id, "room:status", this.status());
    this.transport.send(connection.id, "state", this.data.game);
  }

  onClose(connection: Connection): void {
    const seat = connection.seat;
    if (seat === null) return;
    const occupant = this.data.seats[seat];
    if (occupant.playerId !== connection.playerId || this.isSeatConnected(seat, connection.id)) return;
    occupant.lastSeen = this.env.now();
    if (this.data.game.phase === "setup") this.data.game.ready[seat] = false;
    this.dirty = true;
    this.broadcastRoom();
  }

  async onMessage(connection: Connection, raw: string): Promise<void> {
    const message = parseEnvelope(raw);
    if (!message) return;
    const data = (message.data ?? {}) as Record<string, unknown>;

    switch (message.type) {
      case "room:status":
        this.transport.send(connection.id, "room:status", this.status());
        return;
      case "room:claimRole":
        this.claimSeat(connection, roleToSeat(data.role), data.name, data.playerId);
        return;
      case "room:releaseRole":
        this.releaseOwnSeat(connection);
        return;
      case "request-history":
        this.transport.send(connection.id, "history", await this.listHistory(data as HistoryQuery));
        return;
    }

    const seat = this.ownSeat(connection);
    if (seat === null) {
      this.transport.send(connection.id, "action-denied", { message: "Wähle zuerst einen Sitzplatz." });
      return;
    }

    switch (message.type) {
      case "room:setCapacity":
        this.changeCapacity(connection, data.capacity);
        return;
      case "set-name":
        this.rename(connection, seat, data.name);
        return;
      case "ready":
        this.apply(connection, setReady(this.data.game, seat, true, this.env.now()));
        return;
      case "roll":
        this.apply(connection, roll(this.data.game, seat, this.env.random));
        return;
      case "toggle-hold":
        this.apply(connection, toggleHold(this.data.game, seat, data.index as number));
        return;
      case "choose": {
        const wasPlaying = this.data.game.phase === "playing";
        this.apply(connection, chooseCategory(this.data.game, seat, data.category));
        if (wasPlaying && this.data.game.phase === "finished") await this.recordFinishedGame();
        return;
      }
      case "reset": {
        const names = this.data.seats.slice(0, this.capacity).map((s) => (s.playerId ? s.name : ""));
        this.data.game = createGame(this.capacity, names, this.env.random);
        this.dirty = true;
        this.broadcastRoom();
        return;
      }
    }
  }

  async listHistory(query?: HistoryQuery): Promise<HistoryEntry[]> {
    return filterHistory(await this.history.all(), query);
  }

  // ---- seats ------------------------------------------------------------------------------

  status(): RoomStatus {
    const roles: RoomStatus["roles"] = {};
    for (let seat = 0; seat < this.capacity; seat += 1) {
      roles[seatToRole(seat)] = this.seatStatus(seat);
    }
    return { roomId: this.data.roomId, capacity: this.capacity, roles };
  }

  private seatStatus(seat: number): RoleStatus {
    const { playerId, name, lastSeen } = this.data.seats[seat];
    const occupied = playerId !== null;
    const connected = occupied && this.isSeatConnected(seat);
    return {
      role: seatToRole(seat),
      name: occupied ? name : null,
      occupied,
      connected,
      releaseDeadline: occupied && !connected && lastSeen !== null ? lastSeen + SEAT_RELEASE_GRACE_MS : null,
    };
  }

  private isSeatConnected(seat: number, exceptConnectionId?: string): boolean {
    const playerId = this.data.seats[seat].playerId;
    return this.transport
      .connections()
      .some((c) => c.id !== exceptConnectionId && c.seat === seat && c.playerId === playerId);
  }

  private ownSeat(connection: Connection): number | null {
    const seat = connection.seat;
    if (seat === null || seat >= this.capacity) return null;
    return this.data.seats[seat].playerId === connection.playerId ? seat : null;
  }

  private claimSeat(connection: Connection, seat: number | null, rawName: unknown, playerId: unknown): void {
    const deny = (reason: string) => this.transport.send(connection.id, "room:roleDenied", { reason });
    if (seat === null || seat >= this.capacity) return deny("Diesen Sitzplatz gibt es nicht.");
    if (typeof playerId !== "string" || !PLAYER_ID_PATTERN.test(playerId)) return deny("Ungültige Anfrage.");
    const name = normaliseName(rawName);
    if (!name) return deny("Bitte gib einen Namen ein.");

    const target = this.data.seats[seat];
    if (target.playerId !== null && target.playerId !== playerId) {
      const reason = this.takeoverBlocked(seat, name);
      if (reason) return deny(reason);
    }
    const duplicate = this.data.seats.some(
      (s, i) => i !== seat && i < this.capacity && s.playerId !== null && s.playerId !== playerId && nameKey(s.name) === nameKey(name),
    );
    if (duplicate) return deny(`Der Name „${name}“ ist schon vergeben.`);

    // A player holds at most one seat.
    this.data.seats.forEach((s, i) => {
      if (i !== seat && s.playerId === playerId) this.vacate(i);
    });
    // Whoever was connected to this seat before (old owner or another tab) loses it.
    this.revokeSeat(seat, connection.id, "Dein Platz wurde auf einem anderen Gerät übernommen.");

    this.data.seats[seat] = { playerId, name, lastSeen: null };
    const renamed = setPlayerName(this.data.game, seat, name);
    if (renamed.ok) this.data.game = renamed.state;
    this.dirty = true;

    connection.playerId = playerId;
    connection.seat = seat;
    this.transport.update(connection);
    this.transport.send(connection.id, "room:roleConfirmed", {
      roomId: this.data.roomId,
      role: seatToRole(seat),
      name,
      playerIndex: seat,
    });
    this.broadcastRoom();
  }

  /** Why someone else's seat cannot be taken over right now, or null if it can. */
  private takeoverBlocked(seat: number, name: string): string | null {
    const occupant = this.data.seats[seat];
    if (this.isSeatConnected(seat)) return `Dieser Platz gehört ${occupant.name} (verbunden).`;
    if (nameKey(occupant.name) === nameKey(name)) return null; // same person on a new device
    const freeAt = (occupant.lastSeen ?? 0) + SEAT_RELEASE_GRACE_MS;
    const secondsLeft = Math.ceil((freeAt - this.env.now()) / 1000);
    return secondsLeft > 0 ? `Dieser Platz ist für ${occupant.name} reserviert (frei in ${secondsLeft} s).` : null;
  }

  private releaseOwnSeat(connection: Connection): void {
    const seat = this.ownSeat(connection);
    if (seat === null) return;
    this.vacate(seat);
    this.revokeSeat(seat, connection.id, "Du hast dich abgemeldet.");
    connection.playerId = null;
    connection.seat = null;
    this.transport.update(connection);
    this.dirty = true;
    this.broadcastRoom();
  }

  /** Frees a seat. During a game the name and score sheet stay so someone can take over. */
  private vacate(seat: number): void {
    this.data.seats[seat] = emptySeat();
    if (seat < this.capacity && this.data.game.phase === "setup") {
      this.data.game.playerNames[seat] = "";
      this.data.game.ready[seat] = false;
    }
    this.dirty = true;
  }

  /** Detaches every connection bound to `seat` except `keepConnectionId` and tells them why. */
  private revokeSeat(seat: number, keepConnectionId: string | null, reason: string): void {
    for (const other of this.transport.connections()) {
      if (other.id === keepConnectionId || other.seat !== seat) continue;
      other.playerId = null;
      other.seat = null;
      this.transport.update(other);
      this.transport.send(other.id, "room:roleRevoked", { reason });
    }
  }

  private changeCapacity(connection: Connection, requested: unknown): void {
    const capacity = clampPlayerCount(requested);
    const result = setPlayerCount(this.data.game, capacity);
    if (!result.ok) return this.deny(connection, result.error);
    for (let seat = capacity; seat < MAX_PLAYERS; seat += 1) {
      if (this.data.seats[seat].playerId === null) continue;
      this.data.seats[seat] = emptySeat();
      this.revokeSeat(seat, null, "Die Spielerzahl wurde verringert.");
    }
    this.data.game = result.state;
    this.dirty = true;
    this.broadcastRoom();
  }

  private rename(connection: Connection, seat: number, rawName: unknown): void {
    const name = normaliseName(rawName);
    if (!name) return this.deny(connection, "Name darf nicht leer sein.");
    const duplicate = this.data.seats.some(
      (s, i) => i !== seat && i < this.capacity && s.playerId !== null && nameKey(s.name) === nameKey(name),
    );
    if (duplicate) return this.deny(connection, `Der Name „${name}“ ist schon vergeben.`);
    const result = setPlayerName(this.data.game, seat, name);
    if (!result.ok) return this.deny(connection, result.error);
    this.data.game = result.state;
    this.data.seats[seat].name = name;
    this.dirty = true;
    for (const c of this.transport.connections()) {
      if (c.seat !== seat) continue;
      this.transport.send(c.id, "room:roleConfirmed", {
        roomId: this.data.roomId,
        role: seatToRole(seat),
        name,
        playerIndex: seat,
      });
    }
    this.broadcastRoom();
  }

  // ---- game -------------------------------------------------------------------------------

  private apply(connection: Connection, result: ActionResult): void {
    if (!result.ok) return this.deny(connection, result.error);
    this.data.game = result.state;
    this.dirty = true;
    this.broadcast("state", this.data.game);
  }

  private async recordFinishedGame(): Promise<void> {
    const game = this.data.game;
    const scores = game.scoreSheets.map(totalScore);
    const now = this.env.now();
    await this.history.add({
      id: this.env.newId(),
      createdAt: game.startedAt ?? now,
      finishedAt: now,
      playerNames: [...game.playerNames],
      scores,
      winner: determineWinner(game.playerNames, scores),
      scoreSheets: structuredClone(game.scoreSheets),
    });
    this.broadcast("history", await this.listHistory());
  }

  private deny(connection: Connection, message: string): void {
    this.transport.send(connection.id, "action-denied", { message });
  }

  private broadcastRoom(): void {
    this.broadcast("room:status", this.status());
    this.broadcast("state", this.data.game);
  }

  private broadcast<K extends keyof ServerEvents>(type: K, data: ServerEvents[K]): void {
    for (const connection of this.transport.connections()) this.transport.send(connection.id, type, data);
  }
}

function parseEnvelope(raw: string): Envelope | null {
  if (raw.length > MAX_MESSAGE_LENGTH) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || typeof (value as Envelope).type !== "string") return null;
    const data = (value as Envelope).data;
    if (data !== undefined && (data === null || typeof data !== "object")) return null;
    return value as Envelope;
  } catch {
    return null;
  }
}
