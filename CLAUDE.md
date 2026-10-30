# Vayo Profile Builder

Demo project: a travel profile builder powered by a provider-configurable chat bot. The assistant builds and updates a profile of the user's travel preferences over time and displays it to the user. Later phases add conflict handling and full persistence.

## Stack

- Next.js + TypeScript
- Vercel AI SDK (multi-provider config, chat streaming)
- Zod (schemas)
- SQLite (local persistence, when we get there)

Simple/common libraries are fine; ask before adding anything significant to the stack.

## Secrets

- `.env.local` holds API keys. Never read it, print it, or commit it. Reference variables by name only (e.g. `ANTHROPIC_API_KEY`).

## Rules

- Consult me before committing to ensure we have sensible commit messages
- Once we have testing up always verify with npm test before returning to me. 
- If we are using a particular version of a framework (example: Next 16) make sure you consult the up to date docs rather than rely on memory.
- Maintain clean code seperation and don't mix the logic into front end focused files. 