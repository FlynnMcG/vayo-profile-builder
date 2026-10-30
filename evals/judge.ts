import { generateText, Output } from "ai";
import { z } from "zod";
import { redactProfile } from "@/lib/profile/redact";
import type { TravelProfile } from "@/lib/profile/schema";
import { getChatConfig, getChatModel } from "@/server/ai/config";

const VerdictSchema = z.object({
  pass: z.boolean().describe("true only if the assistant clearly meets every criterion"),
  reason: z.string().describe("One or two sentences citing the transcript"),
});

export type Verdict = z.infer<typeof VerdictSchema>;

// LLM-as-judge for behaviors that can't be checked mechanically. Uses the
// configured chat model (EVAL_JUDGE_MODEL overrides) with a strict rubric.
export async function judge(options: {
  criteria: string[];
  transcript: string;
  profile?: TravelProfile;
}): Promise<Verdict> {
  const config = getChatConfig({ ...process.env, CHAT_MODEL: process.env.EVAL_JUDGE_MODEL || process.env.CHAT_MODEL });
  const { output } = await generateText({
    model: getChatModel(config),
    reasoning: "none",
    output: Output.object({ schema: VerdictSchema }),
    system:
      "You grade a travel assistant's replies. Judge only what the transcript shows. Be strict: if a criterion is only partly met, it fails.",
    prompt: [
      "Criteria (all must hold):",
      ...options.criteria.map((criterion, i) => `${i + 1}. ${criterion}`),
      options.profile ? `\nThe user's saved profile before the conversation:\n${JSON.stringify(redactProfile(options.profile))}` : "",
      `\nTranscript:\n${options.transcript}`,
    ].join("\n"),
  });
  return output;
}
