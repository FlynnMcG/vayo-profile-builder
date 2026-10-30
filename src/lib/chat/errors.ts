const GENERIC_ERROR = "Something went wrong reaching the assistant. Please try again.";

// Turns a useChat error into a message for the user. Server errors arrive
// either as a JSON body ({ error }) or as the stream's error text; both are
// written by our server, so they're safe to show. Anything else is generic.
export function chatErrorMessage(error: Error | undefined): string | null {
  if (!error) return null;
  const text = error.message?.trim();
  if (!text) return GENERIC_ERROR;
  try {
    const body: unknown = JSON.parse(text);
    if (body && typeof body === "object" && typeof (body as { error?: unknown }).error === "string") {
      return (body as { error: string }).error;
    }
    return GENERIC_ERROR;
  } catch {
    // Not JSON: a network failure or the stream's error text. Only show
    // short single-line messages, which is what the server sends.
    return text.length <= 300 && !text.includes("\n") ? text : GENERIC_ERROR;
  }
}
