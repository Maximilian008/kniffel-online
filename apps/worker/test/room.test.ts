import { describe, expect, it } from "vitest";
import { CATEGORIES, SEAT_RELEASE_GRACE_MS, type HistoryEntry, type ServerEvents } from "@kniffel/game";
import { createRoomData, filterHistory, Room, type Connection, type HistoryStore, type Transport } from "../src/room";

type Sent = { to: string; type: keyof ServerEvents; data: any };

/** In-memory stand-in for the Durable Object: sockets, storage and clock. */
class FakeServer implements Transport, HistoryStore {
  open = new Map<string, Connection>();
  sent: Sent[] = [];
  entries: HistoryEntry[] = [];
  time = 1_000_000;
  room: Room;
  private nextId = 0;

  constructor() {
    this.room = this.createRoom(createRoomData("kniffel-room", { random: Math.random }));
  }

  createRoom(data: Room["data"]): Room {
    return new Room(data, this, this, { now: () => this.time, random: Math.random, newId: () => `id-${++this.nextId}` });
  }

  connections() {
    return [...this.open.values()];
  }
  update(connection: Connection) {
    this.open.set(connection.id, { ...connection });
  }
  send(to: string, type: keyof ServerEvents, data: unknown) {
    this.sent.push({ to, type, data });
  }
  async add(entry: HistoryEntry) {
    this.entries.push(structuredClone(entry));
  }
  async all() {
    return structuredClone(this.entries);
  }

  connect(): Client {
    const connection: Connection = { id: `c${this.open.size + this.sent.length}-${Math.random()}`, playerId: null, seat: null };
    this.open.set(connection.id, connection);
    this.room.onOpen(connection);
    return new Client(this, connection.id);
  }
}

class Client {
  constructor(private server: FakeServer, readonly id: string) {}
  get connection() {
    return this.server.open.get(this.id)!;
  }
  async send(type: string, data?: unknown) {
    await this.server.room.onMessage({ ...this.connection }, JSON.stringify({ type, data }));
  }
  async raw(text: string) {
    await this.server.room.onMessage({ ...this.connection }, text);
  }
  claim(seat: number, name: string, playerId: string) {
    return this.send("room:claimRole", { role: `p${seat + 1}`, name, playerId });
  }
  disconnect() {
    const connection = this.connection;
    this.server.open.delete(this.id);
    this.server.room.onClose(connection);
  }
  last<K extends keyof ServerEvents>(type: K): ServerEvents[K] | undefined {
    return [...this.server.sent].reverse().find((m) => m.to === this.id && m.type === type)?.data;
  }
}

const ID = { anna: "player-anna-1", ben: "player-ben-22", carl: "player-carl-3", dora: "player-dora-4" };

async function lobby(names: Array<keyof typeof ID>) {
  const server = new FakeServer();
  const clients = [];
  if (names.length > 2) {
    const first = server.connect();
    await first.claim(0, names[0], ID[names[0]]);
    await first.send("room:setCapacity", { capacity: names.length });
    clients.push(first);
  }
  for (let seat = clients.length; seat < names.length; seat += 1) {
    const client = server.connect();
    await client.claim(seat, names[seat], ID[names[seat]]);
    clients.push(client);
  }
  return { server, clients };
}

async function startGame(names: Array<keyof typeof ID>) {
  const setup = await lobby(names);
  for (const client of setup.clients) await client.send("ready");
  expect(setup.server.room.data.game.phase).toBe("playing");
  return setup;
}

describe("seats", () => {
  it("claims seats and rejects taken seats and duplicate names", async () => {
    const { server, clients } = await lobby(["anna", "ben"]);
    expect(clients[0].last("room:roleConfirmed")).toMatchObject({ role: "p1", name: "anna", playerIndex: 0 });
    expect(server.room.data.game.playerNames).toEqual(["anna", "ben"]);

    const intruder = server.connect();
    await intruder.claim(0, "Mallory", "player-mallory");
    expect(intruder.last("room:roleDenied")?.reason).toContain("verbunden");
    await intruder.claim(0, "anna", "player-mallory");
    expect(intruder.last("room:roleDenied")?.reason).toContain("verbunden");

    await server.room.onMessage(intruder.connection, JSON.stringify({ type: "room:setCapacity", data: { capacity: 3 } }));
    expect(intruder.last("action-denied")?.message).toContain("Sitzplatz");
  });

  it("gives the seat back to the same browser after a connection drop (no zombie seat)", async () => {
    const { server, clients } = await startGame(["anna", "ben"]);
    clients[0].disconnect();
    expect(server.room.status().roles.p1).toMatchObject({ occupied: true, connected: false });

    const again = server.connect();
    await again.claim(0, "anna", ID.anna);
    expect(again.last("room:roleConfirmed")).toMatchObject({ role: "p1" });
    await again.send("roll");
    expect(server.room.data.game.rollsLeft).toBe(2);
  });

  it("lets a player continue on a new device with the same name, others only after the grace period", async () => {
    const { server, clients } = await startGame(["anna", "ben"]);
    await clients[0].send("roll");
    await clients[0].send("choose", { category: "chance" });
    clients[1].disconnect();

    const stranger = server.connect();
    await stranger.claim(1, "Oma", "player-oma-77");
    expect(stranger.last("room:roleDenied")?.reason).toContain("reserviert");

    const phone = server.connect();
    await phone.claim(1, "BEN", "player-ben-phone");
    expect(phone.last("room:roleConfirmed")).toMatchObject({ role: "p2", playerIndex: 1 });
    phone.disconnect();

    server.time += SEAT_RELEASE_GRACE_MS + 1;
    await stranger.claim(1, "Oma", "player-oma-77");
    expect(stranger.last("room:roleConfirmed")).toMatchObject({ role: "p2", name: "Oma" });
    expect(server.room.data.game.playerNames).toEqual(["anna", "Oma"]);
    expect(server.room.data.game.currentPlayer).toBe(1);
  });

  it("keeps the score sheet when a player leaves during a game", async () => {
    const { server, clients } = await startGame(["anna", "ben"]);
    await clients[0].send("roll");
    await clients[0].send("choose", { category: "chance" });
    await clients[0].send("room:releaseRole");
    expect(server.room.status().roles.p1).toMatchObject({ occupied: false });
    expect(server.room.data.game.playerNames[0]).toBe("anna");
    expect(server.room.data.game.usedCategories[0]).toEqual(["chance"]);
  });

  it("revokes the old tab when the same player opens a second one", async () => {
    const { server, clients } = await lobby(["anna", "ben"]);
    const secondTab = server.connect();
    await secondTab.claim(0, "anna", ID.anna);
    expect(secondTab.last("room:roleConfirmed")).toBeDefined();
    expect(clients[0].last("room:roleRevoked")).toBeDefined();
    expect(clients[0].connection.seat).toBeNull();
  });

  it("lets the first visitor choose the player count before taking a seat", async () => {
    const server = new FakeServer();
    const host = server.connect();
    await host.send("room:setCapacity", { capacity: 4 });
    expect(server.room.status().capacity).toBe(4);
    await host.claim(3, "anna", ID.anna);
    expect(host.last("room:roleConfirmed")).toMatchObject({ role: "p4" });

    const late = server.connect();
    await late.send("room:setCapacity", { capacity: 2 });
    expect(late.last("action-denied")?.message).toContain("Sitzplatz");
    expect(server.room.status().capacity).toBe(4);
  });

  it("tells a tab when the same player moved to another seat in a different tab", async () => {
    const { server, clients } = await lobby(["anna", "ben"]);
    await clients[0].send("room:setCapacity", { capacity: 3 });
    const otherTab = server.connect();
    await otherTab.claim(2, "anna", ID.anna);
    expect(clients[0].last("room:roleRevoked")).toBeDefined();
    expect(server.room.status().roles.p1).toMatchObject({ occupied: false });
  });

  it("lets a player take back \"ready\"", async () => {
    const { server, clients } = await lobby(["anna", "ben"]);
    await clients[0].send("ready");
    expect(server.room.data.game.ready).toEqual([true, false]);
    await clients[0].send("ready", { ready: false });
    expect(server.room.data.game.ready).toEqual([false, false]);
    await clients[1].send("ready");
    expect(server.room.data.game.phase).toBe("setup");
  });

  it("frees the seat of a player who left the lobby, but only after the grace period", async () => {
    const { server, clients } = await lobby(["anna", "ben"]);
    clients[1].disconnect();
    await clients[0].send("room:freeSeat", { role: "p2" });
    expect(clients[0].last("action-denied")?.message).toContain("erst kurz weg");
    server.time += SEAT_RELEASE_GRACE_MS + 1;
    await clients[0].send("room:freeSeat", { role: "p2" });
    expect(server.room.status().roles.p2).toMatchObject({ occupied: false, name: null });
    expect(server.room.data.game.playerNames).toEqual(["anna", ""]);
  });

  it("restores seats 3-6 after a restart", async () => {
    const { server } = await lobby(["anna", "ben", "carl"]);
    const restarted = server.createRoom(JSON.parse(JSON.stringify(server.room.data)));
    server.room = restarted;
    expect(Object.keys(restarted.status().roles)).toEqual(["p1", "p2", "p3"]);
    const carl = server.connect();
    await carl.claim(2, "carl", ID.carl);
    expect(carl.last("room:roleConfirmed")).toMatchObject({ role: "p3" });
  });

  it("starts the grace period for seats whose player vanished in a server restart", async () => {
    const { server } = await startGame(["anna", "ben"]);
    server.open.clear(); // the restart drops every socket without a close event
    server.room = server.createRoom(JSON.parse(JSON.stringify(server.room.data)));
    server.room.startGracePeriodForOrphanedSeats();
    expect(server.room.status().roles.p2?.releaseDeadline).toBe(server.time + SEAT_RELEASE_GRACE_MS);

    server.time += SEAT_RELEASE_GRACE_MS + 1;
    const oma = server.connect();
    await oma.claim(1, "Oma", "player-oma-77");
    expect(oma.last("room:roleConfirmed")).toMatchObject({ role: "p2" });
  });

  it("frees seats beyond a reduced player count", async () => {
    const { server, clients } = await lobby(["anna", "ben", "carl"]);
    await clients[0].send("room:setCapacity", { capacity: 2 });
    expect(clients[2].last("room:roleRevoked")).toBeDefined();
    expect(server.room.status().capacity).toBe(2);
    expect(server.room.data.seats[2].playerId).toBeNull();
  });
});

describe("robustness", () => {
  it("ignores malformed messages without throwing", async () => {
    const { server, clients } = await startGame(["anna", "ben"]);
    const before = JSON.stringify(server.room.data);
    for (const text of ["", "nope", "null", "[]", '{"type":1}', '{"type":"roll","data":5}', "x".repeat(10_000)]) {
      await clients[0].raw(text);
    }
    await clients[0].send("toggle-hold");
    await clients[0].send("choose");
    await clients[0].send("set-name");
    await clients[0].send("choose", { category: "bogus" });
    await clients[0].send("request-history", { players: "anna", limit: "abc" });
    expect(JSON.stringify(server.room.data)).toBe(before);
  });

  it("cannot end the game with made-up categories", async () => {
    const { server, clients } = await startGame(["anna", "ben"]);
    await clients[0].send("roll");
    for (let i = 0; i < 20; i += 1) await clients[0].send("choose", { category: `bogus${i}` });
    expect(server.room.data.game.phase).toBe("playing");
    expect(server.room.data.game.usedCategories[0]).toEqual([]);
  });
});

describe("history", () => {
  async function playToTheEnd(names: Array<keyof typeof ID>) {
    const setup = await startGame(names);
    for (const category of CATEGORIES) {
      for (const client of setup.clients) {
        await client.send("roll");
        await client.send("choose", { category });
      }
    }
    expect(setup.server.room.data.game.phase).toBe("finished");
    return setup;
  }

  it("records a finished game once and never changes it afterwards", async () => {
    const { server, clients } = await playToTheEnd(["anna", "ben", "carl"]);
    expect(server.entries).toHaveLength(1);
    const entry = server.entries[0];
    expect(entry.playerNames).toEqual(["anna", "ben", "carl"]);
    expect(clients[1].last("history")).toHaveLength(1);

    await clients[1].send("room:releaseRole");
    clients[2].disconnect();
    await clients[0].claim(0, "Anna B.", ID.anna); // renaming = claiming the own seat again
    expect(server.entries).toEqual([entry]);

    await clients[0].send("reset");
    expect(server.room.data.game.phase).toBe("setup");
    // Ben left (seat free again), Carl only lost the connection and keeps his seat.
    expect(server.room.data.game.playerNames).toEqual(["Anna B.", "", "carl"]);
    expect(server.entries).toHaveLength(1);
  });

  it("filters by player names and tolerates bad limits", () => {
    const entry = (id: string, names: string[], finishedAt: number): HistoryEntry => ({
      id,
      createdAt: 0,
      finishedAt,
      playerNames: names,
      scores: names.map(() => 0),
      winner: null,
      scoreSheets: [],
    });
    const entries = [entry("a", ["Anna", "Ben"], 1), entry("b", ["Anna", "Carl"], 2), entry("c", ["Dora", "Ben"], 3)];
    expect(filterHistory(entries).map((e) => e.id)).toEqual(["c", "b", "a"]);
    expect(filterHistory(entries, { players: ["anna", "BEN"] }).map((e) => e.id)).toEqual(["a"]);
    expect(filterHistory(entries, { players: ["Anna"], mode: "contains" }).map((e) => e.id)).toEqual(["b", "a"]);
    expect(filterHistory(entries, { limit: Number("abc") })).toHaveLength(3);
    expect(filterHistory(entries, { limit: 1 })).toHaveLength(1);
  });
});
