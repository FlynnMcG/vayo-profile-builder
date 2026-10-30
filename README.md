# Vayo Profile Builder

A travel profile builder powered by a provider-configurable chat assistant. As you chat, the assistant builds a profile of your travel preferences, shown in a side panel.

> **Status:** Chat streams from the model via the Vercel AI SDK, and the server keeps the chat history in memory. The profile panel still shows placeholder data.

## Stack

- [Next.js 16](https://nextjs.org/) (App Router) + TypeScript
- Tailwind CSS v4
- [Zod](https://zod.dev/) for schemas
- [Vercel AI SDK v7](https://ai-sdk.dev/) for multi-provider chat streaming
- SQLite (planned) for persistence

## Prerequisites

- Node.js **20.9 or later**
- npm

## Running the frontend

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

### Environment variables

Set these in `.env.local`, which git ignores:

| Variable            | Required | Description                                                              |
| ------------------- | -------- | ------------------------------------------------------------------------ |
| `ANTHROPIC_API_KEY` | Yes      | API key for the default Anthropic provider                               |
| `CHAT_MODEL`        | No       | Model as `<provider>:<model>`. Defaults to `anthropic:claude-haiku-5-5`. |

## Model providers

Models are resolved through an AI SDK provider registry, so the app isn't tied to a single provider. Thinking/reasoning is turned off through the AI SDK's portable `reasoning: "none"` setting.

To add a provider:

1. Install its package (for example, `npm install @ai-sdk/openai`).
2. Register it in `src/server/ai/registry.ts`.
3. Set its API key env var and point `CHAT_MODEL` at it (for example, `openai:<model-id>`).

## Scripts

| Command         | Description                         |
| --------------- | ----------------------------------- |
| `npm run dev`   | Start the dev server (Turbopack)    |
| `npm run build` | Create a production build           |
| `npm run start` | Serve the production build          |
| `npm run lint`  | Run ESLint                          |

## Project structure

```
src/
  app/
    api/chat/route.ts  POST /api/chat: validates the request, streams the reply
    ...                Page, layout, global styles
  components/
    chat/              Chat UI: ChatPanel, MessageList, ChatInput
    profile/           ProfilePanel side panel
  hooks/
    useChatSession.ts  Wraps the AI SDK's useChat; sends only the newest message
  lib/                 Shared by client and server
    chat/              Zod chat schemas and UIMessage adapters
    profile/           Zod profile schema, display mapping, placeholder data
  server/              Server-only code (guarded by `server-only`)
    ai/                Provider registry, model config, system prompt
    chat/              Chat service and chat history store (in memory for now)
```

### How a chat turn works

1. The client sends only the newest message: `{ chatId, message: { id, role, content } }`.
2. The route validates the request with Zod and calls the chat service.
3. The service appends the message to the server-held history, streams the model's reply, and stores the reply when it finishes, even if the client disconnects.
