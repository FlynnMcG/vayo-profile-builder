import { CURRENT_PROMPT_VERSION, isPromptVersion, type PromptVersion } from "@/server/ai/prompts";
import { getChatConfig } from "@/server/ai/config";
import { streamChatReply } from "@/server/chat/chat-service";
import type { ProfileConflict } from "@/lib/conflicts/schema";
import type { TravelProfile } from "@/lib/profile/schema";
import { createInMemoryDeps } from "../test/helpers/in-memory-deps";

// Which prompt to evaluate: EVAL_PROMPT_VERSION=v1 npm run eval
export const PROMPT_VERSION: PromptVersion = (() => {
  const requested = process.env.EVAL_PROMPT_VERSION;
  if (!requested) return CURRENT_PROMPT_VERSION;
  if (!isPromptVersion(requested)) throw new Error(`Unknown EVAL_PROMPT_VERSION "${requested}"`);
  return requested;
})();

// Evals need a working provider; report why they're skipped otherwise.
export const missingConfig: string | null = (() => {
  try {
    getChatConfig();
    return null;
  } catch (error) {
    return (error as Error).message;
  }
})();

export interface ToolCall {
  name: string;
  input: unknown;
  output: unknown;
}

export interface TurnResult {
  user: string;
  reply: string;
  toolCalls: ToolCall[];
  error?: string;
}

// A conversation against a fresh in-memory database, using the real chat
// service, tools, and conflict rules.
export function createSession(profile?: TravelProfile) {
  const deps = createInMemoryDeps();
  if (profile) deps.profileStore.create(profile);
  const chatId = `eval-${crypto.randomUUID().slice(0, 8)}`;
  const turns: TurnResult[] = [];
  let turnNumber = 0;

  async function send(text: string): Promise<TurnResult> {
    const messageId = `u${++turnNumber}`;
    const stream = await streamChatReply(
      { chatId, message: { id: messageId, role: "user", content: text } },
      deps,
      { promptVersion: PROMPT_VERSION },
    );

    const calls = new Map<string, ToolCall>();
    let error: string | undefined;
    const reader = stream.getReader();
    for (let next = await reader.read(); !next.done; next = await reader.read()) {
      const chunk = next.value;
      if (chunk.type === "tool-input-available") {
        calls.set(chunk.toolCallId, { name: chunk.toolName, input: chunk.input, output: undefined });
      } else if (chunk.type === "tool-output-available") {
        const call = calls.get(chunk.toolCallId);
        if (call) call.output = chunk.output;
      } else if (chunk.type === "error") {
        error = chunk.errorText;
      }
    }

    // The reply is stored when the stream ends; wait briefly for the write.
    let reply = "";
    for (let i = 0; i < 20 && !reply; i++) {
      const last = (await deps.historyStore.getMessages(chatId)).at(-1);
      if (last?.role === "assistant") reply = last.content;
      else await new Promise((resolve) => setTimeout(resolve, 50));
    }

    const result = { user: text, reply, toolCalls: [...calls.values()], error };
    turns.push(result);
    return result;
  }

  return {
    send,
    turns,
    profile: (): TravelProfile => deps.conflictService.getProfile(),
    pendingConflicts: (): ProfileConflict[] => deps.conflictService.listPending(),
  };
}

export type Session = ReturnType<typeof createSession>;

export const toolNames = (turn: TurnResult) => turn.toolCalls.map((call) => call.name);

// A readable transcript for the judge and for failure messages.
export function transcript(session: Session): string {
  return session.turns
    .map((turn) => {
      const tools = turn.toolCalls.length ? `\n[tools: ${toolNames(turn).join(", ")}]` : "";
      return `USER: ${turn.user}${tools}\nASSISTANT: ${turn.reply}`;
    })
    .join("\n\n");
}
