# Vayo Profile Builder

A travel profile builder powered by a provider-configurable chat assistant. As you chat, the assistant builds a profile of your travel preferences, shown in a side panel.

> **Status:** The frontend is scaffolded. The chat UI and profile panel run locally with placeholder data. The chat API (Vercel AI SDK) isn't connected yet.

## Stack

- [Next.js 16](https://nextjs.org/) (App Router) + TypeScript
- Tailwind CSS v4
- [Zod](https://zod.dev/) for schemas
- Vercel AI SDK (planned) for multi-provider chat streaming
- SQLite (planned) for persistence

## Prerequisites

- Node.js **20.9 or later**
- npm

## Running the frontend

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the dev server:

   ```bash
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000).

Sending a message currently returns a placeholder reply, because the chat API isn't connected yet.

### Environment variables

The chat API will read provider keys from `.env.local`, which git ignores:

```bash
ANTHROPIC_API_KEY=your-key-here
```

The frontend doesn't need this file yet.

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
  app/                 Next.js routes (page, layout, global styles)
  components/
    chat/              Chat UI: ChatPanel, MessageList, ChatInput
    profile/           ProfilePanel side panel
  hooks/
    useChatSession.ts  Chat state; the AI SDK's useChat will replace this
  lib/
    chat/              Chat message types
    profile/           Zod profile schema, display mapping, placeholder data
```
