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
import { CHAT_REASONING, getChatConfig, getChatModel } from "@/server/ai/config";
import { describeModelError, errorSummary } from "@/server/ai/errors";
import { CURRENT_PROMPT_VERSION, formatUserTurn, SYSTEM_PROMPTS, type PromptVersion } from "@/server/ai/prompts";
import { createConflictTools } from "@/server/ai/tools/conflict-tools";
import { createDestinationTools } from "@/server/ai/tools/destination-tools";
import { createProfileTools } from "@/server/ai/tools/profile-tools";
import type { TurnContext } from "@/server/conflicts/conflict-service";
import { logEvent } from "@/server/logging/logger";
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

export interface ChatReplyOptions {
  // Which system prompt version to use; evals compare versions.
  promptVersion?: PromptVersion;
}

// Records the user's message, streams the assistant's reply from the
// server-held history, and stores the reply once it completes. Throws
// ChatConfigError before touching history if the model isn't set up.
export async function streamChatReply(
  { chatId, message }: ChatRequest,
  deps: ChatServiceDeps = getServices(),
  { promptVersion = CURRENT_PROMPT_VERSION }: ChatReplyOptions = {},
) {
  const config = getChatConfig();
  const { historyStore, conflictService } = deps;
  await historyStore.appendMessage(chatId, message);
  const history = await historyStore.getMessages(chatId);
  if (history.at(-1)?.id !== message.id) throw new MessageAlreadyAnsweredError(message.id);

  // Generated here so the streamed message and the stored one share an ID.
  const assistantMessageId = generateId();
  // Correlates every log line for this turn.
  const log = (event: string, fields: Record<string, unknown> = {}, level?: "info" | "warn" | "error") =>
    logEvent(event, { requestId: assistantMessageId, chatId, userMessageId: message.id, ...fields }, level);
  const startedAt = Date.now();

  const result = streamText({
    model: getChatModel(config),
    system: SYSTEM_PROMPTS[promptVersion],
    messages: buildModelMessages(history, conflictService.getProfile(), conflictService.listPending()),
    tools: createChatTools(deps, { chatId, userMessageId: message.id }),
    stopWhen: isStepCount(MAX_STEPS),
    reasoning: CHAT_REASONING,
    maxOutputTokens: config.maxOutputTokens,
    onLanguageModelCallEnd: ({ provider, modelId, responseId, usage, finishReason, performance }) =>
      log("llm.call", {
        provider,
        model: modelId,
        promptVersion,
        providerRequestId: responseId,
        latencyMs: Math.round(performance.responseTimeMs),
        timeToFirstOutputMs: performance.timeToFirstOutputMs && Math.round(performance.timeToFirstOutputMs),
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        totalTokens: usage.totalTokens,
        finishReason,
      }),
    onToolExecutionEnd: ({ toolCall, toolExecutionMs, toolOutput }) =>
      log("tool.call", {
        tool: toolCall.toolName,
        toolCallId: toolCall.toolCallId,
        latencyMs: Math.round(toolExecutionMs),
        // Tools report rule failures (e.g. same-turn lock) as ok: false.
        success:
          toolOutput.type === "tool-result" &&
          (toolOutput.output as { ok?: boolean } | undefined)?.ok !== false,
      }),
    onError: ({ error }) => log("llm.error", { model: config.modelId, ...errorSummary(error) }, "error"),
    onEnd: async (event) => {
      log("chat.turn", {
        model: config.modelId,
        promptVersion,
        steps: event.steps.length,
        tools: event.steps.flatMap((step) => step.toolCalls.map((call) => call.toolName)),
        inputTokens: event.totalUsage.inputTokens,
        outputTokens: event.totalUsage.outputTokens,
        totalTokens: event.totalUsage.totalTokens,
        durationMs: Date.now() - startedAt,
      });
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
    // Shown to the user: a fixed message per failure type, never error text.
    onError: (error) => describeModelError(error, config).message,
  });
}
