import {
    HISTORY_PATH,
    PING,
    PONG,
    WS_PATH,
    type ClientEvents,
    type RoleConfirmed,
    type RoleStatus,
    type Role,
    type RoomStatus,
    type ServerEvents,
} from "@kniffel/game";

export type RoomRole = Role;
export type { RoleStatus };
export type RoomStatusPayload = RoomStatus;
export type RoleConfirmedPayload = RoleConfirmed;
export type RoleDeniedPayload = ServerEvents["room:roleDenied"];
export type RoleRevokedPayload = ServerEvents["room:roleRevoked"];

export const ROLE_LABELS: Record<RoomRole, string> = {
    p1: "Spieler 1",
    p2: "Spieler 2",
    p3: "Spieler 3",
    p4: "Spieler 4",
    p5: "Spieler 5",
    p6: "Spieler 6",
};

/** Server origin. Website and game server normally share one origin; VITE_SERVER_URL overrides it. */
export function serverBaseUrl(): string {
    const configured = import.meta.env.VITE_SERVER_URL as string | undefined;
    return (configured || window.location.origin).replace(/\/$/, "");
}

export function historyUrl(params: URLSearchParams): string {
    const query = params.toString();
    return `${serverBaseUrl()}${HISTORY_PATH}${query ? `?${query}` : ""}`;
}

type LocalEvents = { connect: undefined; disconnect: undefined };
type Events = ServerEvents & LocalEvents;
type Listener<K extends keyof Events> = (data: Events[K]) => void;
type EmitArgs<K extends keyof ClientEvents> = ClientEvents[K] extends undefined ? [] : [ClientEvents[K]];

const HEARTBEAT_INTERVAL_MS = 20_000;
const HEARTBEAT_TIMEOUT_MS = 8_000;
const RECONNECT_DELAY_MS = 1_000;
const RECONNECT_DELAY_MAX_MS = 5_000;

/**
 * WebSocket connection to the game server with automatic reconnect.
 * Emits the local events "connect" and "disconnect" on every (re)connect and drop.
 */
export class GameSocket {
    connected = false;
    private ws: WebSocket | null = null;
    private listeners = new Map<keyof Events, Set<Listener<never>>>();
    private stopped = false;
    private attempt = 0;
    private reconnectTimer: number | undefined;
    private heartbeatTimer: number | undefined;
    private heartbeatTimeout: number | undefined;
    private readonly url: string;

    constructor(url: string) {
        this.url = url;
        window.addEventListener("online", this.wakeUp);
        document.addEventListener("visibilitychange", this.wakeUp);
        this.open();
    }

    on<K extends keyof Events>(event: K, listener: Listener<K>): this {
        if (!this.listeners.has(event)) this.listeners.set(event, new Set());
        this.listeners.get(event)!.add(listener as Listener<never>);
        return this;
    }

    off<K extends keyof Events>(event: K, listener: Listener<K>): this {
        this.listeners.get(event)?.delete(listener as Listener<never>);
        return this;
    }

    removeAllListeners(): void {
        this.listeners.clear();
    }

    /** Sends a message; silently dropped while disconnected (the UI shows the connection state). */
    emit<K extends keyof ClientEvents>(type: K, ...args: EmitArgs<K>): void {
        if (!this.connected || !this.ws) return;
        this.ws.send(JSON.stringify({ type, data: args[0] }));
    }

    disconnect(): void {
        this.stopped = true;
        window.removeEventListener("online", this.wakeUp);
        document.removeEventListener("visibilitychange", this.wakeUp);
        window.clearTimeout(this.reconnectTimer);
        this.drop();
    }

    private dispatch<K extends keyof Events>(event: K, data: Events[K]): void {
        for (const listener of [...(this.listeners.get(event) ?? [])]) (listener as Listener<K>)(data);
    }

    private open(): void {
        window.clearTimeout(this.reconnectTimer);
        const ws = new WebSocket(this.url);
        this.ws = ws;
        ws.onopen = () => {
            this.connected = true;
            this.attempt = 0;
            this.startHeartbeat();
            this.dispatch("connect", undefined);
        };
        ws.onmessage = (event) => {
            if (typeof event.data !== "string") return;
            if (event.data === PONG) {
                window.clearTimeout(this.heartbeatTimeout);
                return;
            }
            try {
                const message = JSON.parse(event.data) as { type: keyof ServerEvents; data: never };
                this.dispatch(message.type, message.data);
            } catch {
                // ignore malformed frames
            }
        };
        ws.onclose = () => {
            if (this.ws !== ws) return;
            this.drop();
            this.scheduleReconnect();
        };
        ws.onerror = () => ws.close();
    }

    /** Forgets the current socket immediately (a dead connection can take minutes to report "close"). */
    private drop(): void {
        window.clearInterval(this.heartbeatTimer);
        window.clearTimeout(this.heartbeatTimeout);
        const ws = this.ws;
        this.ws = null;
        if (ws) {
            ws.onopen = ws.onmessage = ws.onclose = ws.onerror = null;
            try {
                ws.close();
            } catch {
                // ignore
            }
        }
        if (this.connected) {
            this.connected = false;
            this.dispatch("disconnect", undefined);
        }
    }

    private scheduleReconnect(): void {
        if (this.stopped) return;
        const delay = Math.min(RECONNECT_DELAY_MS * 2 ** this.attempt, RECONNECT_DELAY_MAX_MS);
        this.attempt += 1;
        this.reconnectTimer = window.setTimeout(() => this.open(), delay + Math.random() * 300);
    }

    private startHeartbeat(): void {
        window.clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = window.setInterval(() => this.ping(), HEARTBEAT_INTERVAL_MS);
    }

    private ping(): void {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        window.clearTimeout(this.heartbeatTimeout);
        this.ws.send(PING);
        this.heartbeatTimeout = window.setTimeout(() => {
            this.drop();
            this.scheduleReconnect();
        }, HEARTBEAT_TIMEOUT_MS);
    }

    /** Back online or tab visible again (e.g. phone unlocked): check the connection right away. */
    private wakeUp = (): void => {
        if (this.stopped || document.visibilityState === "hidden") return;
        if (this.connected) {
            this.ping();
        } else if (!this.ws) {
            this.attempt = 0;
            this.open();
        }
    };
}

export type AppSocket = GameSocket;

export function createSocket(): AppSocket {
    const url = new URL(WS_PATH, serverBaseUrl());
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    return new GameSocket(url.toString());
}
