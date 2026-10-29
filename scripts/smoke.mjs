// End-to-end check against a running server (default: `pnpm dev:server` on port 8787).
//   pnpm smoke                      -> http://localhost:8787
//   pnpm smoke https://example.dev  -> any other deployment (only if nobody is playing there!)
// Plays a full 3-player game over real WebSockets, including bad input and a dropped connection.
// Needs Node 22+ (global WebSocket).

const base = new URL(process.argv[2] ?? "http://localhost:8787");
const wsUrl = new URL("/api/ws", base);
wsUrl.protocol = base.protocol === "https:" ? "wss:" : "ws:";

const CATEGORIES = ["ones", "twos", "threes", "fours", "fives", "sixes", "threeKind", "fourKind", "fullHouse", "smallStraight", "largeStraight", "yahtzee", "chance"];

if (typeof WebSocket === "undefined") {
  console.error("This script needs Node 22 or newer (global WebSocket).");
  process.exit(1);
}

class Player {
  constructor(name) {
    this.name = name;
    this.playerId = `smoke-${name.toLowerCase()}-${Math.random().toString(36).slice(2, 10)}`;
    this.inbox = [];
    this.waiters = [];
  }

  async connect() {
    this.ws = new WebSocket(wsUrl);
    this.ws.addEventListener("message", (event) => {
      if (event.data === "pong") return;
      const message = JSON.parse(event.data);
      this.latest = { ...this.latest, [message.type]: message.data };
      const waiter = this.waiters.find((w) => w.type === message.type && w.test(message.data));
      if (waiter) {
        this.waiters.splice(this.waiters.indexOf(waiter), 1);
        waiter.resolve(message.data);
      }
    });
    await new Promise((resolve, reject) => {
      this.ws.addEventListener("open", resolve, { once: true });
      this.ws.addEventListener("error", () => reject(new Error(`cannot connect to ${wsUrl}`)), { once: true });
    });
    await this.next("state");
    return this;
  }

  next(type, test = () => true, timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
      const waiter = { type, test, resolve };
      this.waiters.push(waiter);
      setTimeout(() => {
        if (!this.waiters.includes(waiter)) return;
        this.waiters.splice(this.waiters.indexOf(waiter), 1);
        reject(new Error(`${this.name}: no "${type}" within ${timeoutMs} ms`));
      }, timeoutMs);
    });
  }

  /** Resolves with the latest message of `type` that satisfies `test`, waiting if necessary. */
  until(type, test) {
    const latest = this.latest?.[type];
    return latest !== undefined && test(latest) ? Promise.resolve(latest) : this.next(type, test);
  }

  send(type, data) {
    this.ws.send(JSON.stringify({ type, data }));
  }

  async request(type, data, expect = "state", test) {
    const reply = this.next(expect, test);
    this.send(type, data);
    return reply;
  }

  async claim(seat) {
    const result = Promise.race([this.next("room:roleConfirmed"), this.next("room:roleDenied").then((d) => Promise.reject(new Error(d.reason)))]);
    this.send("room:claimRole", { role: `p${seat + 1}`, name: this.name, playerId: this.playerId });
    return result;
  }

  close() {
    this.ws.close();
  }
}

function check(condition, message) {
  if (!condition) throw new Error(`FAILED: ${message}`);
  console.log(`  ✓ ${message}`);
}

async function main() {
  console.log(`Smoke test against ${base.origin}`);
  const health = await fetch(new URL("/api/health", base)).then((r) => r.json());
  check(health.status === "ok", "server is healthy");

  const anna = await new Player("Anna").connect();
  const status = anna.latest["room:status"];
  const busy = Object.values(status.roles).some((role) => role.occupied) || anna.latest.state.phase !== "setup";
  if (busy) {
    console.error("Somebody is using this room right now – aborting so their game is not disturbed.");
    process.exit(1);
  }

  const ben = await new Player("Ben").connect();
  const carl = await new Player("Carl").connect();
  await anna.claim(0);
  await anna.request("room:setCapacity", { capacity: 3 }, "room:status", (s) => s.capacity === 3);
  await ben.claim(1);
  await carl.claim(2);
  const seated = await anna.until("state", (s) => s.playerNames.join() === "Anna,Ben,Carl");
  check(seated.playerNames.length === 3, "three players seated");

  for (const bad of ["garbage", "{}", '{"type":"toggle-hold"}', '{"type":"choose","data":{"category":"bogus"}}']) anna.ws.send(bad);
  await anna.request("room:status", undefined, "room:status");
  check((await fetch(new URL("/api/health", base))).ok, "malformed messages do not crash the server");

  await anna.request("ready");
  await ben.request("ready");
  const started = await carl.request("ready", undefined, "state", (s) => s.phase === "playing");
  check(started.phase === "playing" && started.rollsLeft === 3, "game starts when everybody is ready");

  anna.close();
  const annaAgain = new Player("Anna");
  annaAgain.playerId = anna.playerId;
  await annaAgain.connect();
  await annaAgain.claim(0);
  const rolled = await annaAgain.request("roll", undefined, "state", (s) => s.rollsLeft === 2);
  check(rolled.rollsLeft === 2, "after a dropped connection the same browser gets its seat back and can play");

  const players = [annaAgain, ben, carl];
  let first = true;
  for (const category of CATEGORIES) {
    for (const player of players) {
      if (!first) await player.request("roll", undefined, "state", (s) => s.rollsLeft < 3);
      first = false;
      await player.request("choose", { category });
    }
  }
  const final = await annaAgain.until("state", (s) => s.phase === "finished");
  check(final.phase === "finished", "full game with 39 turns finishes");

  const { history } = await fetch(new URL("/api/history?players=Anna,Ben,Carl", base)).then((r) => r.json());
  check(history.length > 0 && history[0].playerNames.join() === "Anna,Ben,Carl", "finished game is in the history");

  await annaAgain.request("reset", undefined, "state", (s) => s.phase === "setup");
  for (const player of players) {
    await player.request("room:releaseRole", undefined, "room:status");
    player.close();
  }
  console.log("All good.");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
