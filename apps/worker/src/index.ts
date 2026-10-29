import { HISTORY_PATH, WS_PATH } from "@kniffel/game";

export { KniffelRoom } from "./durable-object";

/** Everybody plays at the same table. */
const ROOM_NAME = "kniffel-room";

/**
 * Only /api/* reaches this Worker (see run_worker_first in wrangler.jsonc).
 * Everything else is the static website from apps/web/dist, served by Cloudflare directly.
 */
export default {
  async fetch(request, env): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (pathname === WS_PATH || pathname === HISTORY_PATH) {
      const room = env.ROOM.get(env.ROOM.idFromName(ROOM_NAME));
      return room.fetch(request);
    }

    if (pathname === "/api/health") {
      return Response.json({ status: "ok" });
    }

    if (pathname.startsWith("/api/")) {
      return new Response("Not found", { status: 404 });
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
