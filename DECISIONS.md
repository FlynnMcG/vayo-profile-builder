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

---

### 4. SQLite driver: built-in `node:sqlite` over better-sqlite3

> "I'm thinking better-sqlite3 … I'm not particularly attached (besides preferring to keep to SQL)."

- **Trying to:** Pick a local SQL database with as little setup as possible for reviewers.
- **Got back:** better-sqlite3 is a native module, so it needs prebuilt binaries for the exact Node version or a local compile. Node's built-in `node:sqlite` worked on Node 26.8 with no warnings and has an almost identical synchronous API.
- **Kept/changed:** Went with `node:sqlite`: no dependency and no native build. The cost is a Node 22.5 minimum, which barely matters since better-sqlite3 13 already needs Node 22.

---

### 5. Visa notes as an enum

> "Don't love the unstructured visa notes, make that an enum or similar of something reasonable."

- **Trying to:** Make visa data structured enough to filter and compare, not free text the model has to interpret.
- **Got back:** `visaRequirement`: `none | eta | e_visa | visa_on_arrival | embassy_visa`, scoped to US passport holders and omitted for domestic trips. The same enum feeds the SQL `CHECK` constraint, so the database and the Zod schema can't drift apart.
- **Kept/changed:** Requirements depend on nationality, so the "US passport" assumption is stated in the schema's `.describe()` (which the model sees) and in the prompt. A per-nationality table would be the real fix if this mattered.

---

### 6. Read-only tools, full CRUD in the store

> "At minimum we need a get and a list, along with CRUD just to be reasonable."

- **Trying to:** Have reasonable data operations without letting the model edit reference data.
- **Got back:** The store has full CRUD (Zod-validated, case-insensitive names, 409-style duplicate error). Only `getDestinationInfo` and `listDestinations` are exposed as model tools. Tool handlers are plain functions wrapped by `tool()`, so tests call them directly.
- **Kept/changed:** Kept write operations out of the model's reach: a chat about preferences shouldn't be able to rewrite Tokyo's budget. `listDestinations` returns a summary (no budget or visa) to save tokens, and `get` provides the details.

---

### 7. Bugs caught by live testing

- **Trying to:** Check the tool flow end to end and grab screenshots.
- **Got back:** Three issues that unit tests didn't catch:
  1. Text from separate steps was joined with no separator ("budget.Based").
  2. The model wrote markdown that the UI shows raw.
  3. Retrying an already-answered message left the history ending with an assistant turn, and Haiku 5.5 rejected it with a 400 ("does not support assistant message prefill").
- **Kept/changed:** (1) The client and server both join step text as paragraphs, with a test. (2) Added a plain-text rule to the static prompt instead of adding a markdown renderer. (3) The service now returns a 409 `MessageAlreadyAnsweredError` before calling the model, with a test.
- **Follow-up:** Blank messages from network issues or refreshes are now purged from history on read, so an empty turn never reaches the provider.

---

### 8. Profile fields mirror destinations

> "Start with exactly the fields (reasonable translation like visa requirement to citizen for the profile) in destinations." / name → "Why not both"

- **Trying to:** Start the profile minimal and directly comparable to destination data.
- **Got back:** `name` + `wishlist` (both from `name`), `preferredSeasons` (`bestSeasons`), `interests` (`knownFor`), `budgetTier` (`averageDailyBudgetUSD` keys), `citizenship` (`visaRequirement`, as an ISO alpha-2 code). `BudgetTierSchema` and `SeasonSchema` are shared with destinations, so a profile value can index straight into destination data.
- **Kept/changed:** Single row (`id = 1`, enforced by a `CHECK`), since multiple profiles are out of scope. `update` creates the profile if it doesn't exist, so the first preference learned in chat always saves.

---

### 9. Change-list tool instead of full overwrite

- **Trying to:** Let the model update the profile reliably from chat.
- **Got back:** Instead of a plain overwrite, `updateProfile` takes `changes[]`: `set` for single-value fields, `add`/`remove` for lists. It's applied by a pure `applyProfileChanges` with case-insensitive de-duplication.
- **Kept/changed:** Overwrite means the model must resend whole lists and tends to wipe items. Change ops avoid that (verified live: "swap Tokyo for Reykjavik" removed one and added the other, keeping the rest). Each change is also the natural unit for conflict detection next round.

---

### 10. Per-turn profile in the user message; refresh-on-finish UI

- **Trying to:** Keep the model and UI in sync with the saved profile without breaking the static-prompt rule.
- **Got back:** The current profile is prepended to the newest user message as `<current_profile>` (not stored in history, so old turns don't carry stale snapshots). The UI re-fetches `/api/profile` after each turn and highlights changed fields.
- **Kept/changed:** Re-fetching is simpler than streaming profile data parts and is enough for one user. Caught a Next 16 detail: `node:sqlite` is synchronous, so a GET handler would be prerendered at build time with a stale profile; `await connection()` forces request-time reads (per Next's docs).
- **Seen for next round:** After the user set "fall" and added Reykjavik, the model said Reykjavik "in the fall could pair well with hiking", but the destination data lists summer/winter as Reykjavik's best seasons. That's a profile-vs-destination conflict the next round should catch.

---

### 11. Expanded profile fields and travel document privacy

> "Lets add Home airport, total cost, ideal trip types, avoid, companions, preferred climates, and travel documents (name of document, document number, name on document, array with multiple allowed)."

- **Trying to:** Round out the profile for trip planning before building conflict detection.
- **Got back:**
  - `homeAirport` (IATA) and `totalBudgetUSD` (whole-trip budget; "total cost" interpreted as the user's budget).
  - `idealTripTypes` and `avoid` as free-text lists.
  - `companions` and `preferredClimates` as enums, so they're comparable.
  - `travelDocuments` as an array of `{ documentName, documentNumber, nameOnDocument }`.
  - Migration 3 adds the columns. A test builds a v2 database with a saved profile and upgrades it, and the real `data/vayo.db` upgraded with its profile intact.
- **Kept/changed:** Document numbers are sensitive, so they're masked to the last 4 everywhere they leave the database (model context, tool result, API, UI), while the database keeps the full value. Because the model only sees the last 4, document removal matches by name plus an optional number suffix. Stated limits: the number still reaches the provider in the user's own message, and the database isn't encrypted (local, single user). The profile store also gained a compile-time check that every field maps to a column.
- **Seen for next round:** `avoid: ["crowds"]` vs destinations known for "nightlife"/"markets", `preferredClimates: ["warm"]` vs a wishlist containing Reykjavik, and `budgetTier: luxury` vs `totalBudgetUSD: 4000` for a long trip. All are good conflict-detection cases.
