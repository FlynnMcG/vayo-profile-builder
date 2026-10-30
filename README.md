# Vayo Profile Builder

A travel profile builder powered by a provider-configurable chat assistant. As you chat, the assistant builds a profile of your travel preferences, shown in a side panel.

> **Status:** Chat streams from the model via the Vercel AI SDK. The assistant updates a saved travel profile from the conversation and can look up and browse destinations with tools. Overwrites of saved values become pending conflicts that the user confirms in chat. The profile, conflicts, chat history, and destinations are stored in SQLite.

## Stack

- [Next.js 16](https://nextjs.org/) (App Router) + TypeScript
- Tailwind CSS v4
- [Zod](https://zod.dev/) for schemas
- [Vercel AI SDK v7](https://ai-sdk.dev/) for multi-provider chat streaming and tool calling
- SQLite via Node's built-in [`node:sqlite`](https://nodejs.org/api/sqlite.html) (no native dependency)
- [Vitest](https://vitest.dev/) for unit tests

## Prerequisites

- Node.js **22.5 or later** (for `node:sqlite`)
- npm

## Running the app

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env.local` from the example and add your API key (see [Environment variables](#environment-variables)):

   ```bash
   cp .env.example .env.local
   ```

3. Start the dev server:

   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000).

The SQLite database is created at `data/vayo.db` on first request and seeded with 10 destinations. To start fresh, delete the `data/` folder (restart the dev server afterwards). To clear just the profile and its pending conflicts, send `DELETE /api/profile`.

### Environment variables

Set these in `.env.local`, which git ignores:

| Variable            | Required | Description                                                              |
| ------------------- | -------- | ------------------------------------------------------------------------ |
| `ANTHROPIC_API_KEY` | Yes      | API key for the default Anthropic provider                               |
| `CHAT_MODEL`        | No       | Model as `<provider>:<model>`. Defaults to `anthropic:claude-haiku-5-5`. |
| `DATABASE_PATH`     | No       | SQLite file path. Defaults to `data/vayo.db`.                            |

## Testing

```bash
npm test
```

Tests run against in-memory SQLite databases (`openDatabase()` / `openSeededDatabase()` default to `:memory:`), so they're fast, isolated, and don't touch `data/`. The chat service takes its stores and tools as parameters, so evals can run it against an in-memory database too.

## Model providers

Models are resolved through an AI SDK provider registry, so the app isn't tied to a single provider. Thinking/reasoning is turned off through the AI SDK's portable `reasoning: "none"` setting.

To add a provider:

1. Install its package (for example, `npm install @ai-sdk/openai`).
2. Register it in `src/server/ai/registry.ts`.
3. Set its API key env var and point `CHAT_MODEL` at it (for example, `openai:<model-id>`).

## Destination data and tools

`DestinationInfo` (`src/lib/destinations/schema.ts`) follows the assignment's format, except that free-text `visaNotes` is replaced by a `visaRequirement` enum for US passport holders: `none`, `eta`, `e_visa`, `visa_on_arrival`, or `embassy_visa`. It's omitted for domestic trips.

- **Store** (`src/server/destinations/destination-store.ts`): `get`, `list`, `create`, `update`, `delete`. Names match case-insensitively, and every write is validated with Zod.
- **Model tools** (`src/server/ai/tools/destination-tools.ts`): `getDestinationInfo` and `listDestinations`. They're read-only: the model can look up reference data but not change it.

Seed figures are illustrative estimates, not authoritative travel advice.

## Travel profile

There's one profile (multiple profiles are out of scope). The core fields mirror `DestinationInfo` so the two can be matched; the rest round out trip planning.

| Profile field       | Type                                              | From destination        |
| ------------------- | ------------------------------------------------- | ----------------------- |
| `name`              | traveler's name                                   | `name`                  |
| `wishlist`          | destination names                                 | `name`                  |
| `preferredSeasons`  | `spring \| summer \| fall \| winter`               | `bestSeasons`           |
| `interests`         | short phrases                                     | `knownFor`              |
| `budgetTier`        | `budget \| midRange \| luxury` (daily spend)       | `averageDailyBudgetUSD` |
| `citizenship`       | ISO 3166-1 alpha-2 code (`US`)                    | `visaRequirement`       |
| `homeAirport`       | IATA code (`SFO`)                                 |                         |
| `totalBudgetUSD`    | whole-trip budget, positive integer               |                         |
| `idealTripTypes`    | short phrases (`beach`, `road trip`)              |                         |
| `avoid`             | short phrases (`crowds`, `long flights`)          |                         |
| `companions`        | `solo \| partner \| friends \| family \| group`     |                         |
| `preferredClimates` | `hot \| warm \| mild \| cool \| cold`               |                         |
| `travelDocuments`   | `{ documentName, documentNumber, nameOnDocument }[]` |                      |

**Travel document numbers** are stored in full in the local database but masked to the last 4 characters (`••••5678`) everywhere they leave the server: the profile context sent to the model, the `updateProfile` tool result, `/api/profile` responses, and the panel. There's one document per name (one passport, one Global Entry), so documents are identified and removed by name.

- **Store** (`src/server/profile/profile-store.ts`): `get`, `create`, `update` (replaces the given fields, creating the profile if needed), `delete`. Only the conflict service writes through it.
- **API** (`/api/profile`): `GET` returns the profile. It's read-only over HTTP, since users change it only through the chat; `DELETE` is a development reset.
- **Model tool** (`updateProfile`): takes a list of changes, where single-value fields are `set` and list fields (including `travelDocuments`) use `add`/`remove`. It's applied by the pure `applyProfileChanges` (`src/lib/profile/changes.ts`). Each turn, the current profile is prepended to the newest user message; the system prompt stays static.
- **UI:** the panel loads from `GET /api/profile` and `GET /api/conflicts`, refreshes after every chat turn, briefly highlights the fields that changed, and shows pending conflicts on their field.

## Profile conflicts

Every profile write goes through the conflict service (`src/server/conflicts/conflict-service.ts`), so the rules can't be bypassed.

**Automatic detection** (`src/lib/conflicts/detect.ts`, pure):

- Setting a single-value field that already has a *different* value (including clearing it) is held back as a pending conflict instead of being applied.
- Changing a saved travel document's number or name-on-document is a conflict on that document.
- Writing to an empty field, and no-op writes (same value after normalizing case), never conflict.
- List adds and removes never conflict automatically. The assistant raises list conflicts itself with `reportConflict` (e.g. adding Tokyo to the wishlist when Japan is in `avoid`).

**Rules:**

- **Partial apply:** in one `updateProfile` call, clean changes apply and only the conflicting ones are held.
- **One pending conflict per key** (the field, or the document name). An identical conflict is reused (deduped); a different one on the same key supersedes the old one.
- **`userConfirmed`:** a per-change flag the model may set only when the user's current message explicitly replaces the saved value. The overwrite applies immediately and is recorded as `resolved` / `user_confirmed` for audit.
- **Same-turn lock:** a turn is identified by the user's message id. A conflict can't be resolved, and its field can't be changed (even with `userConfirmed`), in the turn that raised it.
- **Resolution:** `keep_existing`, `accept_proposed`, or `custom` (a different change to the same field).
- **Stale check:** if an overwrite conflict's field changed after it was raised, resolving it marks it `superseded` instead.
- Held changes are validated up front, so accepting a conflict can't fail later.

**Tools:** `updateProfile` (returns `applied`, `conflicts`, and `rejected`), `reportConflict` (list fields only), and `resolveConflict`. Pending conflicts are included in the newest user message each turn, next to the profile.

**API:**

| Endpoint                              | Description                                                              |
| ------------------------------------- | ------------------------------------------------------------------------ |
| `GET /api/conflicts`                  | Pending conflicts (document numbers masked)                              |
| `POST /api/conflicts`                 | Report a conflict: `{ change, reason }` → `201`                          |
| `POST /api/conflicts/[id]/resolve`    | `{ resolution }` → `200`; `404` unknown, `409` not pending/stale, `400` invalid |

Conflict rows are kept after they're resolved or superseded (status, resolution, raising/resolving message, timestamps) as an audit trail.

## Scripts

| Command              | Description                      |
| -------------------- | -------------------------------- |
| `npm run dev`        | Start the dev server (Turbopack) |
| `npm run build`      | Create a production build        |
| `npm run start`      | Serve the production build       |
| `npm run lint`       | Run ESLint                       |
| `npm test`           | Run unit tests once              |
| `npm run test:watch` | Run unit tests in watch mode     |

## Project structure

```
src/
  app/
    api/chat/route.ts     POST /api/chat: validates the request, streams the reply
    api/profile/route.ts  GET/DELETE /api/profile (read-only over HTTP)
    api/conflicts/        GET/POST /api/conflicts, POST /api/conflicts/[id]/resolve
    ...                Page, layout, global styles
  components/
    ProfileBuilder.tsx Connects chat to the profile panel (refresh after each turn)
    chat/              Chat UI: ChatPanel, MessageList (with tool activity), ChatInput
    profile/           ProfilePanel side panel
  hooks/
    useChatSession.ts  Wraps the AI SDK's useChat; sends only the newest message
    useProfile.ts      Loads the profile and tracks changed fields
  lib/                 Shared by client and server
    conflicts/         Overwrite detection, conflict schemas, display summaries
    chat/              Zod chat schemas and UIMessage adapters
    destinations/      Zod DestinationInfo schema
    profile/           Zod profile schema, change ops, display mapping
  server/              Server-only code (guarded by `server-only`)
    ai/                Provider registry, model config, system prompt, tools/
    chat/              Chat service and SQLite chat history store
    conflicts/         Conflict service (all profile writes) and conflict store
    db/                SQLite connection and migrations
    destinations/      Destination store and seed data
    profile/           Profile store
    services.ts        Wires stores and services onto a database
test/
  helpers/             In-memory chat service deps (for tests and evals)
  stubs/               Test stand-ins (e.g. `server-only`)
docs/
  screenshots/         UI screenshots for review
```

### How a chat turn works

1. The client sends only the newest message: `{ chatId, message: { id, role, content } }`.
2. The route validates the request with Zod and calls the chat service.
3. The service appends the message to the server-held history, prepends the current profile and pending conflicts to the newest user message, and streams the model's reply, allowing up to 5 tool-call steps. When the reply finishes, it's stored even if the client disconnects.
4. Retrying a message that already has a reply returns `409` instead of calling the model again.
5. Profile tools run through the conflict service with the turn's user message id, so same-turn rules apply.
6. When the turn finishes, the client re-fetches the profile and pending conflicts, and highlights what changed.

Only the text after the turn's last tool call is shown and stored as the reply. With reasoning off, the model tends to "think out loud" before calling tools.
