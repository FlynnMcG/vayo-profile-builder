import { getToolName, isToolUIPart, type UIMessage } from "ai";
import type { ChatMessage, ChatRequest } from "./schema";

// Adapters between the AI SDK's UIMessage (used by useChat) and our own
// types, so the rest of the app doesn't depend on AI SDK types.

export interface ToolActivity {
  id: string;
  label: string;
  status: "running" | "done" | "error";
}

// What the UI renders: a chat message plus any tool calls made for it.
export interface ChatMessageView extends ChatMessage {
  toolActivity: ToolActivity[];
}

type ToolPart = Extract<UIMessage["parts"][number], { toolCallId: string }>;

// Whether an updateProfile result held back any changes as conflicts.
const hasConflicts = (part: ToolPart) =>
  part.state === "output-available" &&
  Array.isArray((part.output as { conflicts?: unknown } | undefined)?.conflicts) &&
  ((part.output as { conflicts: unknown[] }).conflicts.length > 0);

function describeToolCall(part: ToolPart): ToolActivity {
  const toolName = getToolName(part);
  const input = (part.input ?? {}) as { name?: string };

  const label =
    toolName === "getDestinationInfo"
      ? `Looked up ${input.name ?? "destination"}`
      : toolName === "listDestinations"
        ? "Browsed destinations"
        : toolName === "updateProfile"
          ? hasConflicts(part)
            ? "Found a conflict"
            : "Updated profile"
          : toolName === "reportConflict"
            ? "Flagged a conflict"
            : toolName === "resolveConflict"
              ? "Resolved conflict"
              : `Used ${toolName}`;

  const status =
    part.state === "output-available"
      ? "done"
      : part.state === "output-error" || part.state === "output-denied"
        ? "error"
        : "running";

  return { id: part.toolCallId, label, status };
}

// The reply is the text after the last tool call. With reasoning off, models
// often "think out loud" before calling tools; that preamble isn't meant for
// the user. Falls back to all text if nothing follows the tools. Matches what
// the server stores.
export function getMessageText(message: UIMessage): string {
  const texts = (parts: UIMessage["parts"]) =>
    parts.flatMap((part) => (part.type === "text" && part.text.trim() ? [part.text.trim()] : []));

  const lastTool = message.parts.findLastIndex(isToolUIPart);
  const reply = texts(message.parts.slice(lastTool + 1));
  return (reply.length ? reply : texts(message.parts)).join("\n\n");
}

export function toChatMessageView(message: UIMessage): ChatMessageView | null {
  if (message.role === "system") return null;
  return {
    id: message.id,
    role: message.role,
    content: getMessageText(message),
    toolActivity: message.parts.filter(isToolUIPart).map(describeToolCall),
  };
}

export function toChatRequest(chatId: string, message: UIMessage): ChatRequest {
  return {
    chatId,
    message: { id: message.id, role: "user", content: getMessageText(message) },
  };
}
