// `wrangler dev` refuses to start when the assets directory is missing. During development the
// website comes from Vite, so an empty folder is enough.
import { mkdirSync } from "node:fs";

mkdirSync(new URL("../apps/web/dist", import.meta.url), { recursive: true });
