import { z } from "zod";

// Shared between client and server: the client builds requests in this shape
// and the API route validates against it.
export const ChatRoleSchema = z.enum(["user", "assistant"]);

export const ChatMessageSchema = z.object({
  id: z.string().min(1),
  role: ChatRoleSchema,
  content: z.string().trim().min(1).max(4000),
});

// Chat IDs are opaque tokens; keep them storage-safe for when they become keys.
export const ChatIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);

// The client only sends its newest message; the server owns the history.
export const ChatRequestSchema = z.object({
  chatId: ChatIdSchema,
  message: ChatMessageSchema.extend({ role: z.literal("user") }),
});

export type ChatRole = z.infer<typeof ChatRoleSchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type ChatRequest = z.infer<typeof ChatRequestSchema>;
