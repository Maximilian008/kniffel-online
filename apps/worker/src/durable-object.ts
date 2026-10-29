import { DurableObject } from "cloudflare:workers";
import { HISTORY_PATH, PING, PONG, WS_PATH, type HistoryEntry, type HistoryQuery, type ServerEvents } from "@kniffel/game";
import { createRoomData, Room, type Connection, type HistoryStore, type RoomData, type Transport } from "./room";

const ROOM_KEY = "room";
const HISTORY_PREFIX = "history:";

/**
 * One Kniffel table. Durable Objects run as a single instance, so all players of the room
 * talk to the same object; state and history live in its built-in (SQLite) storage.
 * WebSockets use the hibernation API, so an idle table costs nothing.
 */
export class KniffelRoom extends DurableObject<Env> implements Transport, HistoryStore {
  private room!: Room;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // Keep-alive pings are answered without waking the object up.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(PING, PONG));
    ctx.blockConcurrencyWhile(async () => {
      const stored = await ctx.storage.get<RoomData>(ROOM_KEY);
      const data = stored ?? createRoomData("kniffel-room", { random: secureRandom });
      this.room = new Room(data, this, this, {
        now: () => Date.now(),
        random: secureRandom,
        newId: () => crypto.randomUUID(),
      });
      this.room.startGracePeriodForOrphanedSeats();
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === WS_PATH) {
      if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
        return new Response("Expected a WebSocket upgrade", { status: 426 });
      }
      const { 0: client, 1: server } = new WebSocketPair();
      this.ctx.acceptWebSocket(server);
      const connection: Connection = { id: crypto.randomUUID(), playerId: null, seat: null };
      server.serializeAttachment(connection);
      this.room.onOpen(connection);
      return new Response(null, { status: 101, webSocket: client });
    }

    if (url.pathname === HISTORY_PATH && request.method === "GET") {
      const query: HistoryQuery = {
        players: (url.searchParams.get("players") ?? "").split(",").filter(Boolean),
        mode: url.searchParams.get("mode") === "contains" ? "contains" : "exact",
        limit: Number(url.searchParams.get("limit") ?? 50),
      };
      return Response.json({ history: await this.room.listHistory(query) });
    }

    return new Response("Not found", { status: 404 });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== "string") return;
    const connection = ws.deserializeAttachment() as Connection;
    try {
      await this.room.onMessage(connection, message);
    } catch (error) {
      console.error("Failed to handle message", error);
      this.send(connection.id, "action-denied", { message: "Da ist etwas schiefgelaufen. Bitte nochmal versuchen." });
    }
    await this.save();
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    this.room.onClose(ws.deserializeAttachment() as Connection);
    await this.save();
    try {
      ws.close(code, reason);
    } catch {
      // already closed
    }
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    this.room.onClose(ws.deserializeAttachment() as Connection);
    await this.save();
  }

  private async save(): Promise<void> {
    if (!this.room.dirty) return;
    this.room.dirty = false;
    await this.ctx.storage.put(ROOM_KEY, this.room.data);
  }

  // ---- Transport ----------------------------------------------------------------------------

  private openSockets(): WebSocket[] {
    return this.ctx.getWebSockets().filter((ws) => ws.readyState === WebSocket.OPEN);
  }

  connections(): Connection[] {
    return this.openSockets().map((ws) => ws.deserializeAttachment() as Connection);
  }

  update(connection: Connection): void {
    const ws = this.openSockets().find((s) => (s.deserializeAttachment() as Connection).id === connection.id);
    ws?.serializeAttachment(connection);
  }

  send<K extends keyof ServerEvents>(connectionId: string, type: K, data: ServerEvents[K]): void {
    const ws = this.openSockets().find((s) => (s.deserializeAttachment() as Connection).id === connectionId);
    try {
      ws?.send(JSON.stringify({ type, data }));
    } catch (error) {
      console.warn("Failed to send", type, error);
    }
  }

  // ---- HistoryStore -------------------------------------------------------------------------

  async add(entry: HistoryEntry): Promise<void> {
    const key = `${HISTORY_PREFIX}${String(entry.finishedAt).padStart(15, "0")}:${entry.id}`;
    await this.ctx.storage.put(key, entry);
  }

  async all(): Promise<HistoryEntry[]> {
    const entries = await this.ctx.storage.list<HistoryEntry>({ prefix: HISTORY_PREFIX });
    return [...entries.values()];
  }
}

function secureRandom(): number {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return buffer[0] / 2 ** 32;
}
