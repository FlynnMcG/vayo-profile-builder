import "server-only";
import {
  generateId,
  isStepCount,
  streamText,
  toUIMessageStream,
  type ModelMessage,
  type StreamTextEndEvent,
  type ToolSet,
} from "ai";
import type { ChatMessage, ChatRequest } from "@/lib/chat/schema";
import type { ProfileConflict } from "@/lib/conflicts/schema";
import type { TravelProfile } from "@/lib/profile/schema";
import { CHAT_REASONING, chatConfig, getChatModel } from "@/server/ai/config";
import { CHAT_SYSTEM_PROMPT, formatUserTurn } from "@/server/ai/prompts";
import { createConflictTools } from "@/server/ai/tools/conflict-tools";
import { createDestinationTools } from "@/server/ai/tools/destination-tools";
import { createProfileTools } from "@/server/ai/tools/profile-tools";
import type { TurnContext } from "@/server/conflicts/conflict-service";
import { getServices, type Services } from "@/server/services";

// Caps tool-call round trips per turn so a confused model can't loop forever.
const MAX_STEPS = 5;

// A retried message that already has a reply. Re-running it would send the
// model a history ending in an assistant turn, which providers reject.
export class MessageAlreadyAnsweredError extends Error {
  constructor(messageId: string) {
    super(`Message "${messageId}" has already been answered`);
    this.name = "MessageAlreadyAnsweredError";
  }
}

// Tests and evals pass their own (e.g. in-memory) services.
export type ChatServiceDeps = Services;

// Tools are built per turn so conflict rules know which turn they're in.
export function createChatTools({ destinationStore, conflictService }: ChatServiceDeps, turn: TurnContext) {
  return {
    ...createProfileTools(conflictService, turn),
    ...createConflictTools(conflictService, turn),
    ...createDestinationTools(destinationStore),
  };
}

// Stored history is plain text; only the newest user message gets the
// current profile and pending conflicts prepended, so earlier turns don't
// carry stale snapshots.
export function buildModelMessages(
  history: ChatMessage[],
  profile: TravelProfile,
  pendingConflicts: ProfileConflict[] = [],
): ModelMessage[] {
  return history.map(({ role, content }, index) =>
    index === history.length - 1 && role === "user"
      ? { role, content: formatUserTurn(profile, pendingConflicts, content) }
      : { role, content },
  );
}

// The reply is the text after the last tool call (the same rule as the
// client's getMessageText): pre-tool text is the model thinking out loud.
// Falls back to all text if nothing follows the tools.
export function getReplyText({ content }: Pick<StreamTextEndEvent<ToolSet>, "content">): string {
  const texts = (parts: typeof content) =>
    parts.flatMap((part) => (part.type === "text" && part.text.trim() ? [part.text.trim()] : []));

  const lastTool = content.findLastIndex((part) => part.type === "tool-call" || part.type === "tool-result");
  const reply = texts(content.slice(lastTool + 1));
  return (reply.length ? reply : texts(content)).join("\n\n");
}

// Records the user's message, streams the assistant's reply from the
// server-held history, and stores the reply once it completes.
export async function streamChatReply(
  { chatId, message }: ChatRequest,
  deps: ChatServiceDeps = getServices(),
) {
  const { historyStore, conflictService } = deps;
  await historyStore.appendMessage(chatId, message);
  const history = await historyStore.getMessages(chatId);
  if (history.at(-1)?.id !== message.id) throw new MessageAlreadyAnsweredError(message.id);

  // Generated here so the streamed message and the stored one share an ID.
  const assistantMessageId = generateId();

  const result = streamText({
    model: getChatModel(),
    system: CHAT_SYSTEM_PROMPT,
    messages: buildModelMessages(history, conflictService.getProfile(), conflictService.listPending()),
    tools: createChatTools(deps, { chatId, userMessageId: message.id }),
    stopWhen: isStepCount(MAX_STEPS),
    reasoning: CHAT_REASONING,
    maxOutputTokens: chatConfig.maxOutputTokens,
    onEnd: async (event) => {
      const content = getReplyText(event);
      if (!content) return;
      await historyStore.appendMessage(chatId, { id: assistantMessageId, role: "assistant", content });
    },
  });

  // Finish generating (and saving) even if the client disconnects.
  void result.consumeStream();

  return toUIMessageStream({
    stream: result.stream,
    generateMessageId: () => assistantMessageId,
    onError: (error) => {
      console.error("Chat stream failed", { chatId, error });
      return "Sorry, something went wrong generating a reply. Please try again.";
    },
  });
}
