import { createUIMessageStreamResponse } from "ai";
import { z } from "zod";
import { ChatRequestSchema } from "@/lib/chat/schema";
import { MessageAlreadyAnsweredError, streamChatReply } from "@/server/chat/chat-service";

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
    throw error;
  }
}
