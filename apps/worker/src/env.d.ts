/** Bindings configured in wrangler.jsonc. */
interface Env {
  ROOM: DurableObjectNamespace<import("./durable-object").KniffelRoom>;
  ASSETS: Fetcher;
}
