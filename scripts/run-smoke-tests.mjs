#!/usr/bin/env node
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createRequire } from "node:module";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const requireFromWeb = createRequire(new URL("../apps/web/package.json", import.meta.url));
const { io } = requireFromWeb("socket.io-client");

const ROOT_PATH = fileURLToPath(new URL("../", import.meta.url));
const SERVER_READY_TOKEN = "Server listening";
const SERVER_START_TIMEOUT_MS = 30_000; // Erhöht von 20s auf 30s
const SOCKET_TIMEOUT_MS = 15_000; // Timeout für Socket-Operationen
const PNPM_COMMAND = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

async function main() {
  log("Starting smoke tests...");

  const server = spawn(
    `${PNPM_COMMAND} --filter server dev`,
    {
      cwd: ROOT_PATH,
      stdio: ["inherit", "pipe", "pipe"],
      env: { ...process.env, NODE_ENV: "development" },
      shell: true,
    }
  );

  server.stdout.on("data", (chunk) => process.stdout.write(chunk));
  server.stderr.on("data", (chunk) => process.stderr.write(chunk));

  try {
    log("Waiting for server to start...");
    await waitForServerReady(server);
    log("Server ready! Running health check...");

    await runHealthCheck();
    log("Health check passed! Running socket tests...");

    await runSocketSmoke();
    log("Socket tests passed! Running ML API tests...");

    await runMLApiTest();
    log("All tests passed successfully!");

  } finally {
    log("Shutting down server...");
    server.kill("SIGINT");
    await once(server, "exit");
    log("Server shut down.");
  }
}

function waitForServerReady(server) {
  return new Promise((resolve, reject) => {
    let buffered = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        cleanup();
        reject(new Error("Server start timed out"));
      }
    }, SERVER_START_TIMEOUT_MS);
    timer.unref();

    const handleData = (chunk) => {
      if (settled) return;
      buffered += chunk.toString();
      if (buffered.includes(SERVER_READY_TOKEN)) {
        settled = true;
        cleanup();
        resolve();
      }
    };

    const handleExit = (code) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(`Server exited early with code ${code ?? "unknown"}`));
    };

    const cleanup = () => {
      clearTimeout(timer);
      server.stdout.off("data", handleData);
      server.off("exit", handleExit);
    };

    server.stdout.on("data", handleData);
    server.on("exit", handleExit);
  });
}

async function runHealthCheck() {
  const response = await fetch("http://localhost:3000/healthz");
  if (!response.ok) {
    throw new Error(`/healthz responded with status ${response.status}`);
  }
  const payload = await response.json();
  console.log("Healthcheck payload:", payload);
}

async function runSocketSmoke() {
  const baseUrl = "http://localhost:3000";
  const options = { transports: ["websocket"], forceNew: true, timeout: SOCKET_TIMEOUT_MS };

  const clientA = io(baseUrl, options);
  await once(clientA, "connect");
  await once(clientA, "room:status");
  clientA.emit("room:claimRole", { role: "p1", name: "Tester A" });
  await once(clientA, "room:roleConfirmed");

  clientA.disconnect();
  await delay(200);

  const clientARejoin = io(baseUrl, options);
  await once(clientARejoin, "connect");
  clientARejoin.emit("room:claimRole", { role: "p1", name: "Tester A" });
  await once(clientARejoin, "room:roleConfirmed");

  const clientB = io(baseUrl, options);
  await once(clientB, "connect");
  clientB.emit("room:claimRole", { role: "p2", name: "Tester B" });
  await once(clientB, "room:roleConfirmed");

  const intruder = io(baseUrl, options);
  await once(intruder, "connect");
  intruder.emit("room:claimRole", { role: "p1", name: "Intruder" });
  await once(intruder, "room:roleDenied");

  clientARejoin.emit("reset");

  clientARejoin.emit("room:releaseRole");
  clientB.emit("room:releaseRole");

  await delay(200);

  clientARejoin.disconnect();
  clientB.disconnect();
  intruder.disconnect();
}

async function runMLApiTest() {
  // Test ML recommendation endpoint
  const testState = {
    dice: [1, 2, 3, 4, 5],
    rollsLeft: 2,
    currentPlayer: 1,
    scoreSheets: [{}, {}],
    usedCategories: [[], []],
    playerNames: ["Test1", "Test2"],
    phase: "playing"
  };

  const response = await fetch("http://localhost:3000/api/recommend", {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      state: testState,
      playerIndex: 0
    }),
  });

  if (!response.ok) {
    throw new Error(`ML API responded with status ${response.status}`);
  }

  const data = await response.json();
  log(`ML API test passed. Got ${data.recommendations?.length || 0} recommendations.`);

  if (data.recommendations && data.recommendations.length > 0) {
    log(`Top recommendation: ${data.recommendations[0].category} (${data.recommendations[0].score} points)`);
  }
}

main().catch((error) => {
  console.error("Smoke test failed:", error);
  process.exitCode = 1;
});
