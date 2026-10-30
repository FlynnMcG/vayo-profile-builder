// Minimal message shape for the UI. When the chat API lands, this will be
// replaced by the AI SDK's UIMessage type via useChat.
export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
}
