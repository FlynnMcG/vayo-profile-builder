# Vayo Profile Builder

A travel profile builder powered by a provider-configurable chat assistant. As you chat, the assistant builds a profile of your travel preferences, shown in a side panel.

> **Status:** Chat streams from the model via the Vercel AI SDK. Chat history and destination data are stored in SQLite. The assistant can look up and browse destinations with tools. The profile panel still shows placeholder data.

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

The SQLite database is created at `data/vayo.db` on first request and seeded with 10 destinations. To start fresh, delete the `data/` folder.

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
    api/chat/route.ts  POST /api/chat: validates the request, streams the reply
    ...                Page, layout, global styles
  components/
    chat/              Chat UI: ChatPanel, MessageList (with tool activity), ChatInput
    profile/           ProfilePanel side panel
  hooks/
    useChatSession.ts  Wraps the AI SDK's useChat; sends only the newest message
  lib/                 Shared by client and server
    chat/              Zod chat schemas and UIMessage adapters
    destinations/      Zod DestinationInfo schema
    profile/           Zod profile schema, display mapping, placeholder data
  server/              Server-only code (guarded by `server-only`)
    ai/                Provider registry, model config, system prompt, tools/
    chat/              Chat service and SQLite chat history store
    db/                SQLite connection and migrations
    destinations/      Destination store and seed data
test/
  stubs/               Test stand-ins (e.g. `server-only`)
docs/
  screenshots/         UI screenshots for review
```

### How a chat turn works

1. The client sends only the newest message: `{ chatId, message: { id, role, content } }`.
2. The route validates the request with Zod and calls the chat service.
3. The service appends the message to the server-held history and streams the model's reply, allowing up to 5 tool-call steps. When the reply finishes, it stores the text from all steps, even if the client disconnects.
4. Retrying a message that already has a reply returns `409` instead of calling the model again.
