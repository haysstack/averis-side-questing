import type { AnalyseResult } from "../types";

/** Browser-side call to our own route handler, which talks to the backend. */
export async function requestAnalysis(emailId: string): Promise<AnalyseResult> {
  try {
    const response = await fetch(`/api/analyse/${encodeURIComponent(emailId)}`, {
      method: "POST",
    });
    return (await response.json()) as AnalyseResult;
  } catch {
    return { ok: false, message: "Could not reach the app server." };
  }
}
