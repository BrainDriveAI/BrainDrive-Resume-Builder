#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const ws5Root = process.env.BRAINDRIVE_WS5_ROOT?.trim() || "/mnt/c/Users/DJJones/Projects/braindrive-ws5";
const ws5TypescriptRoot = path.join(ws5Root, "builds/typescript");
const verifierScript = path.join(ws5TypescriptRoot, "scripts/verify-external-package.ts");
const compiledVerifierScript = path.join(ws5TypescriptRoot, "dist/scripts/verify-external-package.js");
const tsxBin = path.join(ws5TypescriptRoot, "node_modules/.bin/tsx");
const releaseRoot = path.resolve("dist/local-dev/release/4.2.21");

if (!existsSync(verifierScript)) {
  console.error(`FAIL ws5 verifier script missing: ${verifierScript}`);
  process.exit(1);
}
const runner = existsSync(tsxBin)
  ? { command: tsxBin, args: [verifierScript] }
  : { command: process.execPath, args: [compiledVerifierScript] };

if (!existsSync(runner.args[0])) {
  console.error(`FAIL ws5 verifier runtime missing: ${runner.args[0]}`);
  process.exit(1);
}

const result = spawnSync(runner.command, [
  ...runner.args,
  "--authority-root",
  releaseRoot,
  "--version",
  "4.2.21",
  "--package-id",
  "ai.braindrive.resume-builder",
  "--publisher-id",
  "ai.braindrive",
  "--archive",
  "braindrive-resume-builder-4.2.21-local.dev.bdapp",
], {
  cwd: ws5TypescriptRoot,
  stdio: "inherit",
  env: process.env,
});

process.exit(result.status ?? 1);
