import type { ReplyResult } from "../types";

/** Browser-side call to our own route handler. */
export async function requestReplyDraft(emailId: string, forceAi = false): Promise<ReplyResult> {
  try {
    const response = await fetch(
      `/api/reply/${encodeURIComponent(emailId)}${forceAi ? "?force_ai=1" : ""}`,
      { method: "POST" },
    );
    return (await response.json()) as ReplyResult;
  } catch {
    return { ok: false, message: "Could not reach the app server." };
  }
}
