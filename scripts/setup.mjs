// One-time local setup: `npm run setup`.
// Checks Node, installs dependencies, and creates .env.local from the
// example if it doesn't exist. It never reads or changes an existing
// .env.local, and never prints any key.
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync } from "node:fs";

const MIN_NODE = [22, 5];

function step(message) {
  console.log(`\n> ${message}`);
}

function fail(message) {
  console.error(`\nSetup failed: ${message}`);
  process.exit(1);
}

step("Checking Node.js version");
const [major, minor] = process.versions.node.split(".").map(Number);
if (major < MIN_NODE[0] || (major === MIN_NODE[0] && minor < MIN_NODE[1])) {
  fail(`Node ${MIN_NODE.join(".")}+ is required (for node:sqlite); you have ${process.versions.node}.`);
}
console.log(`  Node ${process.versions.node} OK`);

step("Installing dependencies");
if (existsSync("node_modules/next")) {
  console.log("  Already installed (run `npm install` to update)");
} else {
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = spawnSync(npm, ["install"], { stdio: "inherit" });
  if (result.status !== 0) fail("npm install failed.");
}

step("Setting up .env.local");
let needsKey = false;
if (existsSync(".env.local")) {
  console.log("  .env.local already exists; left unchanged");
} else {
  copyFileSync(".env.example", ".env.local");
  needsKey = true;
  console.log("  Created .env.local from .env.example");
}

console.log(`
Done. Next:
${needsKey ? "  1. Add your API key to .env.local (ANTHROPIC_API_KEY=...), or pick another provider (see README).\n  2." : "  1."} npm run dev   then open http://localhost:3000

Other commands:
  npm test        unit tests (no API key needed)
  npm run eval    behavior evals (calls the model; uses your key)
`);
