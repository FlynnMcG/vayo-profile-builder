import { createUIMessageStreamResponse } from "ai";
import { z } from "zod";
import { ChatRequestSchema } from "@/lib/chat/schema";
import { ChatConfigError } from "@/server/ai/config";
import { MessageAlreadyAnsweredError, streamChatReply } from "@/server/chat/chat-service";
import { logEvent } from "@/server/logging/logger";

export async function POST(req: Request) {
  const body: unknown = await req.json().catch(() => null);
  const parsed = ChatRequestSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  }

  try {
    const stream = await streamChatReply(parsed.data);
    return createUIMessageStreamResponse({ stream });
  } catch (error) {
    if (error instanceof MessageAlreadyAnsweredError) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    // Setup problems (no API key, bad CHAT_MODEL): a clear message that
    // names the env var, never its value.
    if (error instanceof ChatConfigError) {
      logEvent("chat.config_error", { code: error.code, message: error.message }, "error");
      return Response.json({ code: error.code, error: error.message }, { status: 503 });
    }
    throw error;
  }
}
