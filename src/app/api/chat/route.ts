import { createUIMessageStreamResponse } from "ai";
import { z } from "zod";
import { ChatRequestSchema } from "@/lib/chat/schema";
import { streamChatReply } from "@/server/chat/chat-service";

export async function POST(req: Request) {
  const body: unknown = await req.json().catch(() => null);
  const parsed = ChatRequestSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  }

  const stream = await streamChatReply(parsed.data);
  return createUIMessageStreamResponse({ stream });
}
