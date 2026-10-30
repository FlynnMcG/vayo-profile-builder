# Vayo Profile Builder

A chat assistant that builds your travel profile as you talk, looks up destinations from its own data, and asks you to confirm when something you say conflicts with your saved profile.

Next.js 16 · TypeScript · Vercel AI SDK v7 · Zod · SQLite (`node:sqlite`). Screenshots are in [`docs/screenshots/`](docs/screenshots/).

## Run it

Requires **Node.js 22.5+**.

```bash
npm run setup
```

This installs dependencies and creates `.env.local` if it doesn't exist. Add your key to it:

```bash
ANTHROPIC_API_KEY=your-key-here
```

Then start the app and open [http://localhost:3000](http://localhost:3000):

```bash
npm run dev
```

The database (`data/vayo.db`) is created and seeded on the first request. Delete `data/` to start over.

## Provider and credentials

The app uses **Anthropic Claude Haiku 5.5** (`anthropic:claude-haiku-5-5`) with reasoning turned off.

| Variable            | Required | Description                                                  |
| ------------------- | -------- | ------------------------------------------------------------ |
| `ANTHROPIC_API_KEY` | Yes      | API key for the default provider                             |
| `CHAT_MODEL`        | No       | `<provider>:<model>`. Default: `anthropic:claude-haiku-5-5`  |
| `DATABASE_PATH`     | No       | SQLite file. Default: `data/vayo.db`                         |

**Different model:** set `CHAT_MODEL`, e.g. `anthropic:claude-sonnet-5-5`.

**Different provider:** `npm install @ai-sdk/<provider>`, then add it to `providers` and `PROVIDER_API_KEY_ENV` in [`src/server/ai/registry.ts`](src/server/ai/registry.ts). Set its key in `.env.local`, set `CHAT_MODEL=<provider>:<model>`, and restart.

**Missing or invalid credentials:** the app still starts. The first chat message shows an error naming the env var to fix, for example "Set ANTHROPIC_API_KEY in .env.local and restart the server." A rejected key or unknown model gets a similar message. Key values are never shown, logged, or committed (`.env.local` is git-ignored).

## Tests and evals

```bash
npm test        # unit tests, no API key needed
npm run eval    # behavior evals against the real model (uses your key)
```

The evals cover filling profile gaps, staying on topic, recommending only known destinations, conflict handling, and wrapping up a complete profile. System prompts are versioned in [`src/server/ai/prompts/`](src/server/ai/prompts/); the current one, v5, passes the 14 scenarios, though conflict resolution is occasionally flaky.

LLM and tool calls are logged as JSON lines to stdout (model, latency, tokens, request IDs).

The prompt log is in [`PROCESS.md`](PROCESS.md), and design decisions are in [`DECISIONS.md`](DECISIONS.md).

## What I would do with another day

Outside of general polish/UI improvement I think I'd probably take this into a multi profile use case personally. Make a profile for me and my wife or friends and add functionality for finding the best match for a group of users. That would be the most personally useful to me without having to worry about bookability or other stretch features. If I was staying within the assignment I'd probably add dynamic profile fields, searching by fields, and do more eval work to improve the chat experience. And test with other providers/models.
