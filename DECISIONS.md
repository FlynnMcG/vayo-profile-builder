# Decisions

Notable decisions and changes. Each covers: what I was trying to do, what the tool gave back, and what I kept, changed, or threw away, and why. The full prompt log is in [PROCESS.md](PROCESS.md).

<!-- DRAFT: the entries below were drafted by Claude from the session so far. Edit them into your own voice, or cut them. -->

---

### 1. Server-owned chat history

> "We're going to have the history handled by the server to avoid reload issues later."

- **Trying to:** Keep the server, not the browser, as the source of truth for chat history, so reloads and later persistence don't depend on client state.
- **Got back:** `useChat` by default sends the whole history on every turn. The AI SDK docs' "send only the last message" pattern changes that: the client sends `{ chatId, message }`, and the server appends it to a `ChatHistoryStore` interface (in memory for now) and saves the reply when the stream ends.
- **Kept/changed:** Kept the pattern and the interface boundary so SQLite can drop in later. Added `consumeStream()` so a reply is saved even if the client disconnects. Deferred keeping the chat ID across page reloads until persistence.

---

### 2. Multi-provider config and turning thinking off

> "Don't overindex on the initial model choice… Use Haiku for testing… turn off thinking mode for now."

- **Trying to:** Use Haiku 5.5 cheaply without tying the code to Anthropic.
- **Got back:** A provider registry with the model as a `"<provider>:<model>"` string (`CHAT_MODEL`, checked by Zod against registered providers). Thinking is disabled with AI SDK v7's portable `reasoning: "none"` rather than Anthropic's `thinking: { type: 'disabled' }` provider option.
- **Kept/changed:** Kept the portable setting. The bundled docs show `none` behaves differently per model (e.g. Sonnet 5.5 can't fully disable thinking), which is exactly the kind of detail that reading docs instead of relying on memory catches.

---

### 3. Static system prompt

> "Keep the system prompt static. Put per-turn state in the user message."

- **Trying to:** Stop the system prompt from becoming a place where state piles up as profile features land.
- **Got back:** The existing prompt was already a constant, so no code change was needed.
- **Kept/changed:** Made it a standing rule in CLAUDE.md. Profile context will go in the user message, which keeps the system prompt cacheable and easy to evaluate.

<!-- Candidates still to come: profile extraction approach, conflict handling, SQLite persistence, prompt evals with vitest, what got cut. -->
