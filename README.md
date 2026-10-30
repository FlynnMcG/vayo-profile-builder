# Vayo Profile Builder

A chat assistant that builds a travel profile as you talk. Tell it how you like to travel and it saves your preferences to a profile shown beside the chat, looks up destinations it has data on, and asks you to confirm when something you say contradicts what's already saved.

Built with Next.js 16, TypeScript, the Vercel AI SDK v7, Zod, and SQLite (Node's built-in `node:sqlite`). Screenshots are in [`docs/screenshots/`](docs/screenshots/).

## Quick start

Requires **Node.js 22.5 or later** (for `node:sqlite`) and npm.

```bash
npm run setup
```

This checks your Node version, installs dependencies, and creates `.env.local` from `.env.example` if it doesn't exist. It never reads or changes an existing `.env.local`.

Add your API key to `.env.local`:

```bash
ANTHROPIC_API_KEY=your-key-here
```

Then start the app and open [http://localhost:3000](http://localhost:3000):

```bash
npm run dev
```

The SQLite database is created at `data/vayo.db` on first request and seeded with 10 destinations. To start over, stop the server and delete `data/`.

## LLM provider and credentials

**Used for this project:** Anthropic **Claude Haiku 5.5** (`anthropic:claude-haiku-5-5`) through the Vercel AI SDK, with reasoning turned off (`reasoning: "none"`, which each provider maps to its own setting).

### Environment variables

Set these in `.env.local`. Git ignores it; only `.env.example` (no values) is committed.

| Variable              | Required             | Description                                                                  |
| --------------------- | -------------------- | ---------------------------------------------------------------------------- |
| `ANTHROPIC_API_KEY`   | Yes, for Anthropic   | API key for the default provider.                                            |
| `CHAT_MODEL`          | No                   | `<provider>:<model>`. Default: `anthropic:claude-haiku-5-5`.                 |
| `DATABASE_PATH`       | No                   | SQLite file. Default: `data/vayo.db`.                                        |
| `LOG_LEVEL`           | No                   | Set to `silent` to turn off JSON logs.                                       |
| `EVAL_PROMPT_VERSION` | No                   | Prompt version for `npm run eval`. Default: the current version.             |
| `EVAL_JUDGE_MODEL`    | No                   | Model for the eval judge. Default: `CHAT_MODEL`.                             |

### Using a different model or provider

**Another Anthropic model:** just set `CHAT_MODEL`, for example `CHAT_MODEL=anthropic:claude-sonnet-5-5`.

**Another provider** (OpenAI as an example):

1. Install its AI SDK package:

   ```bash
   npm install @ai-sdk/openai
   ```

2. Register it in [`src/server/ai/registry.ts`](src/server/ai/registry.ts), including the env var its key comes from:

   ```ts
   import { openai } from "@ai-sdk/openai";

   export const providers = { anthropic, openai };

   export const PROVIDER_API_KEY_ENV: Record<ProviderId, string> = {
     anthropic: "ANTHROPIC_API_KEY",
     openai: "OPENAI_API_KEY",
   };
   ```

3. In `.env.local`, set the key and point `CHAT_MODEL` at the provider:

   ```bash
   OPENAI_API_KEY=your-key-here
   CHAT_MODEL=openai:<model-id>
   ```

4. Restart the dev server.

The prompts and evals were tuned on Haiku 5.5. Another model will work but may need a prompt revision; run `npm run eval` to check.

### Missing or invalid credentials

Errors name the env var to fix and never include its value. Keys are never logged or returned by the API.

| Situation                                | What you see in the chat                                                                                   | Server                                      |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| No key set                               | "No API key configured for anthropic. Set ANTHROPIC_API_KEY in .env.local and restart the server."       | `503`, logs `chat.config_error`             |
| Key rejected (invalid or revoked)        | "anthropic rejected the API key in ANTHROPIC_API_KEY. Check that it's correct and active, then restart the server." | Logs `llm.error` with `statusCode: 401` |
| `CHAT_MODEL` malformed or unknown provider | "CHAT_MODEL "…" isn't valid. Use "&lt;provider&gt;:&lt;model&gt;" with a registered provider…"           | `503`, logs `chat.config_error`             |
| Model name not recognized by the provider | "anthropic doesn't recognize the model in CHAT_MODEL…"                                                    | Logs `llm.error` with `statusCode: 404`     |
| Rate limited                             | "anthropic is rate limiting requests. Try again in a moment."                                              | Logs `llm.error` with `statusCode: 429`     |

The app starts without a key; the error appears on the first message. See [`docs/screenshots/12-missing-api-key.jpg`](docs/screenshots/12-missing-api-key.jpg).

## What it does

- **Builds a profile from conversation.** The assistant saves what you tell it (budget, seasons, interests, travel documents, and so on), then asks about whatever's still missing. If you'd rather talk about something else, it follows your lead. When the profile is complete, it says so and offers to change anything.
- **Refreshes the profile live.** The side panel updates as soon as a profile tool finishes, mid-reply, and highlights what changed.
- **Knows 10 destinations.** It answers destination questions only from its own data, recommends only those destinations, and says when it doesn't have information on a place instead of using outside knowledge.
- **Handles conflicts.** If something you say would overwrite a saved value ("my home airport is OAK" when SFO is saved), the change is held as a pending conflict, shown on that field, and the assistant asks which is right. It also flags contradictions a simple field update would miss, like adding Tokyo to your wishlist when Japan is on your avoid list.
- **Keeps chat history on the server**, so the client only sends its newest message.
- **Masks travel document numbers** (`••••5678`) everywhere outside the database, including what the model sees.

## Testing and evals

```bash
npm test        # unit tests: in-memory SQLite, no API key needed
npm run eval    # behavior evals: calls the real model with your key
```

**Unit tests** (Vitest) cover the stores, the conflict rules, the API routes, credential errors, redaction, and UI mapping. They run against in-memory databases, so they're fast and don't touch `data/`.

**Evals** ([`evals/behaviors.eval.ts`](evals/behaviors.eval.ts)) run real multi-turn conversations through the chat service against an in-memory database. They check hard outcomes (which tools ran, the saved profile, pending conflicts) and use an LLM judge with a strict rubric for conversational behavior. Scenarios:

| Behavior                       | Scenarios                                                                                                   |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Fills profile gaps proactively | Asks on greeting; saves a preference, then asks about a missing field; lets the user steer elsewhere          |
| Stays on topic, no outside info | Declines a cover letter; unknown destination (Buenos Aires, plus an unseen Berlin variant); no invented restaurants |
| Known destinations only        | A general hiking query lists destinations and recommends only known ones                                     |
| Conflicts                      | Overwrite raises a conflict; next-turn resolution; explicit replacement skips it; cross-turn list contradiction (avoid Japan, then add Tokyo); reversing a saved interest |
| Complete profile               | Says it's complete, offers changes, signs off                                                                |

**Prompt versions.** System prompts are versioned in [`src/server/ai/prompts/`](src/server/ai/prompts/) (`system-v1.ts` … `system-v5.ts`); `CURRENT_PROMPT_VERSION` picks the live one. Compare versions with `EVAL_PROMPT_VERSION=v3 npm run eval`. Each run writes `evals/results/<version>.json` (git-ignored). Results on Haiku 5.5:

| Version | Change                                                                 | Passed       |
| ------- | ---------------------------------------------------------------------- | ------------ |
| v1      | Baseline                                                               | 9/12         |
| v2      | Rules for gaps, staying on topic, completing the profile, reversals    | 9/12         |
| v3      | Always call `updateProfile` for differing values; define "complete"    | 12/13        |
| v4      | Look up any specific place before answering                            | 11–12/13     |
| **v5**  | Worked example for looking up unknown places (current)                 | 13/13, 13/13, 13/14 |

Single runs are noisy: the conflict-resolution scenario passed in 5 of 6 runs. Treat a single failure as a flag to rerun, not a verdict. (The scenario count grew as scenarios were added.)

## Logging

Every LLM call and tool call is logged as one JSON object per line on stdout. All lines in a chat turn share a `requestId` (the assistant message id). `providerRequestId` is the provider's own response id, for matching against provider dashboards.

```json
{"ts":"2026-10-30T22:32:55.078Z","level":"info","event":"llm.call","requestId":"daoaRIdRMQZ2jBOK","chatId":"logtest1","userMessageId":"m1","provider":"anthropic.messages","model":"claude-haiku-5-5","promptVersion":"v5","providerRequestId":"msg_011CgZDWNbwNSjVE7wFTuapA","latencyMs":1323,"timeToFirstOutputMs":1178,"inputTokens":11617,"outputTokens":56,"totalTokens":11673,"finishReason":"tool-calls"}
{"ts":"2026-10-30T22:32:55.079Z","level":"info","event":"tool.call","requestId":"daoaRIdRMQZ2jBOK","chatId":"logtest1","userMessageId":"m1","tool":"getDestinationInfo","toolCallId":"toolu_01TGLufLVMFvi12n13QKSoko","latencyMs":0,"success":true}
{"ts":"2026-10-30T22:32:56.445Z","level":"info","event":"chat.turn","requestId":"daoaRIdRMQZ2jBOK","chatId":"logtest1","userMessageId":"m1","model":"anthropic:claude-haiku-5-5","promptVersion":"v5","steps":2,"tools":["getDestinationInfo"],"inputTokens":23405,"outputTokens":196,"totalTokens":23601,"durationMs":2694}
```

| Event               | Fields                                                                                  |
| ------------------- | --------------------------------------------------------------------------------------- |
| `llm.call`          | provider, model, prompt version, provider request id, latency, time to first output, token counts, finish reason |
| `tool.call`         | tool name, tool call id, latency, success (`false` if the tool threw or returned `ok: false`, e.g. a resolve refused by the same-turn lock) |
| `chat.turn`         | per-turn totals: steps, tools used, token counts, duration                             |
| `llm.error`         | error name, HTTP status, provider message (no request bodies or headers)               |
| `chat.config_error` | missing key or invalid `CHAT_MODEL`                                                    |

## How it works

### A chat turn

1. The client sends only its newest message: `{ chatId, message: { id, role, content } }`.
2. `POST /api/chat` validates it with Zod, checks the model config and key, and calls the chat service.
3. The service appends the message to the server-held history, adds the current profile and pending conflicts to the newest user message (the system prompt itself stays static), and streams the reply with up to 5 tool-call steps.
4. As each profile tool finishes, the client re-fetches the profile, and does so again when the reply ends.
5. The reply is stored even if the client disconnects. Retrying an answered message returns `409`.

Only the text after the turn's last tool call is shown and stored. With reasoning off, the model tends to "think out loud" before calling tools.

### Destinations

`DestinationInfo` ([`src/lib/destinations/schema.ts`](src/lib/destinations/schema.ts)) follows the assignment's format, except that free-text `visaNotes` is replaced by a `visaRequirement` enum for US passport holders (`none`, `eta`, `e_visa`, `visa_on_arrival`, `embassy_visa`; omitted for domestic trips). The store supports full CRUD, but the model gets read-only tools: `getDestinationInfo` and `listDestinations`. Seed figures are illustrative.

### Travel profile

There's one profile. Its core fields mirror `DestinationInfo` so the two can be matched:

| Profile field       | Type                                                 | Matches destination field |
| ------------------- | ---------------------------------------------------- | ------------------------- |
| `name`              | traveler's name                                      | `name`                    |
| `wishlist`          | destination names                                    | `name`                    |
| `preferredSeasons`  | `spring`, `summer`, `fall`, `winter`                 | `bestSeasons`             |
| `interests`         | short phrases                                        | `knownFor`                |
| `budgetTier`        | `budget`, `midRange`, `luxury` (daily spend)         | `averageDailyBudgetUSD`   |
| `citizenship`       | ISO 3166-1 alpha-2 code (`US`)                       | `visaRequirement`         |
| `homeAirport`       | IATA code (`SFO`)                                    |                           |
| `totalBudgetUSD`    | whole-trip budget                                    |                           |
| `idealTripTypes`    | short phrases (`beach`, `road trip`)                 |                           |
| `avoid`             | short phrases (`crowds`, `long flights`)             |                           |
| `companions`        | `solo`, `partner`, `friends`, `family`, `group`      |                           |
| `preferredClimates` | `hot`, `warm`, `mild`, `cool`, `cold`                |                           |
| `travelDocuments`   | `{ documentName, documentNumber, nameOnDocument }[]`, one per name |             |

The profile changes only through chat. The `updateProfile` tool takes a list of changes: single-value fields are set, and lists (including documents) use add/remove, so the model never resends whole lists.

### Conflicts

Every profile write goes through the conflict service ([`src/server/conflicts/conflict-service.ts`](src/server/conflicts/conflict-service.ts)), so the rules can't be bypassed:

- **Automatic detection:** setting a single-value field that already has a different value (including clearing it), or changing a saved document, is held as a pending conflict instead of being applied. Writing to an empty field or repeating the same value never conflicts.
- **Assistant-reported:** list contradictions a field update can't see (Tokyo on the wishlist while Japan is on `avoid`; turning against a saved interest) are raised with `reportConflict`, which accepts list fields only.
- **Partial apply:** in one update, clean changes apply and only the conflicting ones are held.
- **One pending conflict per field** (or per document name). An identical conflict is reused; a different one replaces the old one.
- **Explicit replacements** ("please change my airport to OAK") are applied straight away via a `userConfirmed` flag and logged for audit.
- **Same-turn lock:** a conflict can't be resolved, and its field can't be changed, in the turn that raised it. The user has to reply first.
- **Resolution:** keep the saved value, accept the new one, or use a different value the user gives. Stale conflicts (the field changed in the meantime) are superseded rather than applied.
- Resolved and superseded conflicts are kept as an audit trail.

## API

| Endpoint                           | Description                                                                                  |
| ---------------------------------- | -------------------------------------------------------------------------------------------- |
| `POST /api/chat`                   | Send a message; streams the reply. `400` invalid body, `409` already answered, `503` setup error. |
| `GET /api/profile`                 | The profile (document numbers masked).                                                       |
| `DELETE /api/profile`              | Development reset: clears the profile and pending conflicts.                                 |
| `GET /api/conflicts`               | Pending conflicts.                                                                           |
| `POST /api/conflicts`              | Report a conflict: `{ change, reason }`. `201` on success.                                   |
| `POST /api/conflicts/[id]/resolve` | `{ resolution: { type: "keep_existing" \| "accept_proposed" } }` or `{ type: "custom", change }`. `404` unknown, `409` not pending or stale. |

## Scripts

| Command              | Description                                        |
| -------------------- | -------------------------------------------------- |
| `npm run setup`      | Check Node, install dependencies, create `.env.local` |
| `npm run dev`        | Start the dev server                                |
| `npm run build`      | Production build                                    |
| `npm run start`      | Serve the production build                          |
| `npm run lint`       | ESLint                                              |
| `npm test`           | Unit tests                                          |
| `npm run test:watch` | Unit tests in watch mode                            |
| `npm run eval`       | Behavior evals (uses your API key)                  |

## Project structure

```
src/
  app/                      Page, layout, and API routes (chat, profile, conflicts)
  components/               ProfileBuilder (wires chat to the panel), chat/, profile/
  hooks/                    useChatSession (wraps useChat), useProfile
  lib/                      Shared by client and server
    chat/                   Chat schemas, UIMessage adapters, error messages
    conflicts/              Overwrite detection, conflict schemas, display summaries
    destinations/           DestinationInfo schema
    profile/                Profile schema, change ops, redaction, display mapping
  server/                   Server-only code (guarded by `server-only`)
    ai/                     Provider registry, model config, error mapping, tools/
      prompts/              Versioned system prompts and the per-turn message format
    chat/                   Chat service and chat history store
    conflicts/              Conflict service (all profile writes) and conflict store
    db/                     SQLite connection, migrations, transactions
    destinations/           Destination store and seed data
    logging/                JSON logger
    profile/                Profile store
    services.ts             Wires stores and services onto a database
evals/                      Behavior evals, harness, and LLM judge
test/                       Fixtures, in-memory helpers, stubs
scripts/setup.mjs           npm run setup
docs/screenshots/           UI screenshots
```

Project history: [`PROCESS.md`](PROCESS.md) is the prompt log, and [`DECISIONS.md`](DECISIONS.md) records the notable decisions.

## What I would do with another day

Outside of general polish/UI improvement I think I'd probably take this into a multi profile use case personally. Make a profile for me and my wife or friends and add functionality for finding the best match for a group of users. That would be the most personally useful to me without having to worry about bookability or other stretch features. If I was staying within the assignment I'd probably add dynamic profile fields, searching by fields, and do more eval work to improve the chat experience. And test with other providers/models.
