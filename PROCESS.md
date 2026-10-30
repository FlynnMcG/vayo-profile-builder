# Process Log

Running transcript of prompts and abbreviated responses/actions. Notable decisions are in DECISIONS.md.

---

## 1. Project setup

**Prompt:**
> We're going to complete a demo project. The basic shape is a travel profile builder powered by a configurable chat bot. The chat bot should be configurable by provider. The assistant will be building a profile of the user's travel preferences that can be updated over time, and will be displayed to the user. Eventually we will also be handling conflicts and making sure that everything is properly persistent.
>
> In terms of tools we are going to use Next.js and typescript to keep things easy to review, Vercel AI SDK to make the multiprovider configuration and chat stream a little simpler, Zod for the schema management, and something simple and easy to run locally like sqlite for our database when we get there. You can make simple decisions like using built in or common libraries but consult me if we need to add something significant to our stack.
>
> Before we get too far in, lets make sure that everything is set up correctly. Initialize git in the folder, and make sure we are connecting to remote fine. Then create a claude.md and I'll give you some initial rules to put in it. Also there is a .env.local file already in the folder. That contains my anthropic API key, and I don't want it committed or read into your context.

**Response/actions:**
- Ran `git init` (branch `main`) and added a `.gitignore` covering env files, `node_modules`, `.next`, and SQLite files. Confirmed `.env.local` is ignored without opening it.
- Added `.claude/settings.json` deny rules so Claude Code can't read `.env*` files.
- Confirmed GitHub auth (FlynnMcG). No repo existed yet, so I asked before creating one.
- Created a `CLAUDE.md` skeleton (summary, stack, secrets rule, empty Rules section).

---

## 2. Create remote

**Prompt:**
> Yes, private repo

**Response/actions:**
- Made the initial commit, created the private repo `FlynnMcG/vayo-profile-builder`, and pushed. Verified `main` tracks `origin/main`.

---

## 3. Frontend chat UI

**Prompt:**
> I added some rules into the claude.md. Ok to start with I'd like you to create a very basic front end chat interface view with a side panel with a few placeholder profile values. Once that's done we are going to do the same with a basic server structure for the vercel AI and build the chat api, so keep that in mind as you build.

**Response/actions:**
- Scaffolded Next.js 16.4.3 (TypeScript, Tailwind v4, ESLint) and read its bundled docs per the CLAUDE.md rule. Added Zod.
- Added a Zod profile schema, a display mapping, and placeholder data in `src/lib/profile/`.
- Built the chat UI (`ChatPanel`, `MessageList`, `ChatInput`) on top of a `useChatSession` hook, the planned spot to swap in `useChat`. `ProfilePanel` is a server component that receives display rows.
- Verified with typecheck, lint, build, and a browser test. Proposed a commit message for approval.

---

## 4. Commit message + README

**Prompt:**
> Change message

**Response/actions:**
- Asked what changes they wanted.

**Prompt:**
> Lets use conventional commits, but before that did you update the README? Make sure it has updated instructions for launching the frontend.
>
> Built scaffolded chat interface in nextJS. Not hooked up yet, backend pending. (+ bullet list)

**Response/actions:**
- I had deleted the scaffold README without replacing it. Wrote a new README (prerequisites, launch steps, scripts, structure).
- Committed `feat: scaffold chat interface in Next.js` with the user's body text.

**Prompt:**
> Push it

**Response/actions:**
- Pushed to `origin/main`.

---

## 5. Server structure + AI SDK chat API

**Prompt:**
> Ok lets set up the server structure. FYI I added a couple rules about the commit titles and a process file I'll need later. Ok next I want you to to set up the vercel AI SDK. Important to remember that we need to be multi provider friendly, so don't overindex on the initial model choice. I want you to use Haiku for testing(I think 5.5 is current?). Probably turn off thinking mode for now, I'm not made of tokens. And build a basic prompt, for now it isn't too important. We'll be refining it later, probably with vitest.
>
> In terms of structure I want you to make sure that our service is cleanly separated and uses zod imports instead of hand rolling. For the schema basic is fine, id, message, role. We're going to have the history handled by the server to avoid reload issues later.

**Response/actions:**
- Installed `ai` v7, `@ai-sdk/anthropic`, and `@ai-sdk/react`, and read the docs bundled with them (Next.js guide, message persistence, provider management, reasoning, Anthropic provider).
- **Multi-provider:** `src/server/ai/registry.ts` uses `createProviderRegistry`. The model is a `"<provider>:<model>"` string, set by the optional `CHAT_MODEL` env var and validated with Zod against the registered providers. The default is `anthropic:claude-haiku-5-5`.
- **Thinking off:** set the portable `reasoning: "none"` option, so it doesn't depend on Anthropic-specific options.
- **Prompt:** a basic system prompt in `src/server/ai/prompts.ts`.
- **Schema:** `src/lib/chat/schema.ts` defines `ChatMessage { id, role, content }` and `ChatRequest { chatId, message }` in Zod, with types inferred from the schemas.
- **Server-held history:** the client sends only the newest message. `chat-service.ts` appends it to a `ChatHistoryStore` (an in-memory interface, ready for SQLite), streams the reply, and stores it on finish, even if the client disconnects.
- **Separation:** `src/app/api/chat/route.ts` is a thin route (validate, then call the service). Server modules import `server-only`. The client hook wraps `useChat` and maps `UIMessage` to `ChatMessage`, so components don't depend on AI SDK types.
- Added `.env.example`, and README sections on env vars, providers, and the request flow.
- Verified with typecheck, lint, and build. Used curl to check the 400 on an invalid body, the streamed reply, and that the server remembers earlier turns. Browser chat test passed with a clean console.

---

## 6. Static system prompt rule

**Prompt:**
> Change message

**Response/actions:**
- Asked what changes they wanted in the commit message.

**Prompt:**
> Added one more rule into the claude.md. TLDR keep the prompt static, I'd rather not use it to manage state.

**Response/actions:**
- Confirmed the current system prompt is already a static constant. Future per-turn state (e.g. the current profile) will go in the user message, not the system prompt.
- Commit still pending until the message is approved.

---

## 7. PROCESS.md vs DECISIONS.md

**Prompt:**
> PROCESS.md is actually a little different. We can make a DECISIONS.md for me to reference later. (+ assignment description: 5–10 annotated prompts covering what you were trying to do, what the tool gave back, and what you kept/changed/threw away and why)

**Response/actions:**
- Misread the request: moved the transcript to DECISIONS.md and made PROCESS.md the highlights. Reversed in the next step.

---

## 8. Swap file roles + commit

**Prompt:**
> Other way around. Keep notable decisions or changes in decisions. Keep the log in process for now, I'll review/edit at the end. (+ commit message: `feat: Initial AI SDK integration. No tools/basic prompt`)

**Response/actions:**
- Swapped the files: PROCESS.md is the running prompt log, and DECISIONS.md holds notable decisions (annotated format, drafts for the user to edit). Updated the CLAUDE.md rule to match.
- Committed with the user's message, correcting the file-name bullet to match the swap.

**Prompt:**
> Push it

**Response/actions:**
- Pushed `6fd4ca7` to `origin/main`.

---

## 9. SQLite choice

**Prompt:**
> Ok lets start with some basic tools. (+ DestinationInfo type from the assignment) This is the example they give for destination info. We'll keep that basic format. I'm thinking better-sqlite3 but that was a google sql that doesn't require much local setup result so I'm not particularly attached(besides preferring to keep to SQL). What do you think of that choice?

**Response/actions:**
- Tested Node's built-in `node:sqlite` on Node 26.8 (works, no warnings) and checked better-sqlite3 (v13, Node 22+, native module).
- Recommended `node:sqlite`: no dependency, no native build, nearly the same sync API. Laid out the tool plan (Zod schema, seeded `destinations` table, store interface, tool with a step limit, chat history moving to SQLite).

---

## 10. Destination schema, store, tests, and tools

**Prompt:**
> Yeah I like that, nice that theirs a solid built in. Lets start with the DestinationInfoSchema, destinations table(lets do 10, make some varied common destinations. Make sure there's variety in the fields.) Don't love the unstructured visa notes, make that an enum or similar of something reasonable. Build some unit testing and make sure we can test it in memory, it will make evals easier later. Once that's done you can go ahead and wire it in as a tool and test it out. Give me some screenshots for reviews. At minimum we need a get and a list, along with CRUD just to be reasonable. Search by field would be nice but lets circle to that if we have time later.

**Response/actions:**
- Added Vitest 5 (bumped `@types/node` to ^22 for its peer range and for `node:sqlite` types; engines set to Node >=22.5). Used Vite 8's native `resolve.tsconfigPaths` and stubbed `server-only` for tests.
- `DestinationInfoSchema` in Zod: `visaNotes` replaced with a `visaRequirement` enum (US passport holders, optional for domestic), budget tiers must ascend, seasons must be unique.
- SQLite: `openDatabase()` (in-memory by default) with versioned migrations (`destinations`, `chat_messages`), app DB at `data/vayo.db` (gitignored). Seeded 10 varied destinations covering all seasons, every budget range, and 5 visa types including omitted.
- `DestinationStore` with get/list/create/update/delete (case-insensitive names, Zod-validated writes). Chat history moved to SQLite.
- Tools: `getDestinationInfo` and `listDestinations` (read-only) wired into `streamText` with `stopWhen: isStepCount(5)`. The chat service takes dependencies as arguments for evals. The UI shows tool activity chips.
- 47 unit tests, all on in-memory DBs. Live testing found and fixed: missing separators between step texts, raw markdown (added a plain-text prompt rule), and a retry bug (an already-answered message caused a provider 400; it now returns 409).
- Screenshots in `docs/screenshots/`. Search by field deferred.

---

## 11. Blank messages, chat deletion, DB clarification

**Prompt:**
> Lets also cover for a blank message, that can happen with network issues/refreshes. Easiest answer is probably to purge them from the history. To be clear on the DB, we aren't using in memory for the site itself right? Only the tests and eventual evals? Also I don't see a delete function for chat history but I might be blind
>
> FYI you went a little beyond what I suggested by moving the chat history but it looks ok we can keep it in this commit. Also, glad you know that NYC sucks in the summer.

**Response/actions:**
- `getMessages` now purges blank/whitespace-only rows for the chat before reading. Writes were already validated, so this guards against interrupted writes and older data.
- Added `deleteChat(chatId)` to `ChatHistoryStore` (there wasn't one).
- Confirmed the site uses the file DB (`data/vayo.db`, holding the browser chats). In-memory is only for `openDatabase()` with no path (tests/evals).
- 52 tests passing.
