import { loadEnvConfig } from "@next/env";

// Load .env.local the same way `next dev` does, so evals use the app's API
// key. Next skips .env.local when NODE_ENV is "test" (which Vitest sets), so
// load in development mode, then restore. Nothing about the files is printed.
const quiet = { info: () => {}, error: () => {} };
const nodeEnv = process.env.NODE_ENV;
Object.assign(process.env, { NODE_ENV: "development" });
loadEnvConfig(process.cwd(), true, quiet, true);
Object.assign(process.env, { NODE_ENV: nodeEnv });

process.env.LOG_LEVEL ??= "silent";
