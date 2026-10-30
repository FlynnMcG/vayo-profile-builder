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

function describeToolCall(part: ToolPart): ToolActivity {
  const toolName = getToolName(part);
  const input = (part.input ?? {}) as { name?: string };

  const label =
    toolName === "getDestinationInfo"
      ? `Looked up ${input.name ?? "destination"}`
      : toolName === "listDestinations"
        ? "Browsed destinations"
        : `Used ${toolName}`;

  const status =
    part.state === "output-available"
      ? "done"
      : part.state === "output-error" || part.state === "output-denied"
        ? "error"
        : "running";

  return { id: part.toolCallId, label, status };
}

// Text from separate steps (e.g. before and after a tool call) arrives as
// separate parts; join them as paragraphs, matching what the server stores.
export function getMessageText(message: UIMessage): string {
  return message.parts
    .flatMap((part) => (part.type === "text" && part.text.trim() ? [part.text.trim()] : []))
    .join("\n\n");
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
