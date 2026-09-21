import { ApiError, apiPost } from "@/lib/api-client";
import type { ReplyDraft, ReplyResult } from "../types";

export async function draftReply(emailId: string, forceAi: boolean): Promise<ReplyResult> {
  try {
    const draft = await apiPost<ReplyDraft>(`/reply/${encodeURIComponent(emailId)}`, {
      force_ai: forceAi ? "true" : undefined,
    });
    return { ok: true, ...draft };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof ApiError ? error.message : "Could not draft a reply.",
    };
  }
}
