#!/usr/bin/env node
import { access } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "../");
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

async function main() {
  await run(pnpmCommand, ["run", "build:web"], { cwd: ROOT });
  const buildOutput = resolve(ROOT, "apps/web/dist/index.html");
  await access(buildOutput);
  console.log("✅ smoke:web – build artefact located at", buildOutput);
}

main().catch((error) => {
  console.error("smoke:web failed", error);
  process.exitCode = 1;
});
