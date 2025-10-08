#!/usr/bin/env node
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "../");
const SERVER_DIR = resolve(ROOT, "apps/server");
const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

async function run(command, args, options = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, { stdio: "inherit", shell: true, ...options });
    child.on("error", rejectPromise);
    child.on("exit", (code) => {
      if (code === 0) {
        resolvePromise();
      } else {
        rejectPromise(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
      }
    });
  });
}

async function waitForHealth(url, attempts = 30, intervalMs = 1000) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (response.ok) {
        return;
      }
      console.warn(`Health check attempt ${attempt} failed with status ${response.status}`);
    } catch (error) {
      console.warn(`Health check attempt ${attempt} failed:`, error.message);
    }
    await delay(intervalMs);
  }
  throw new Error(`Server did not respond with 200 OK after ${attempts} attempts`);
}

async function main() {
  await run(pnpmCommand, ["run", "build:server"], { cwd: ROOT });

  const serverProcess = spawn(
    process.execPath,
    ["dist/index.js"],
    {
      cwd: SERVER_DIR,
      env: {
        ...process.env,
        PORT: "5055",
        NODE_ENV: "production",
      },
      stdio: ["ignore", "inherit", "inherit"],
    }
  );

  let finished = false;
  const exitPromise = new Promise((_, reject) => {
    serverProcess.once("exit", (code) => {
      if (!finished) {
        reject(new Error(`server process exited early with code ${code ?? "unknown"}`));
      }
    });
    serverProcess.once("error", (error) => {
      if (!finished) {
        reject(error);
      }
    });
  });

  try {
    await Promise.race([
      waitForHealth("http://127.0.0.1:5055/healthz"),
      exitPromise,
    ]);
    console.log("✅ smoke:server – /healthz responded with 200");
  } finally {
    finished = true;
    serverProcess.kill("SIGINT");
  }
}

main().catch((error) => {
  console.error("smoke:server failed", error);
  process.exitCode = 1;
});
