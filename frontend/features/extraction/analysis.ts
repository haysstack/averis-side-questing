import type { EmailExtraction } from "./extractionTypes";
import type { Email } from "./types";

/**
 * Where an email is in the pipeline:
 *  unanalysed          not classified yet
 *  extraction-missing  SI/BL comparison with no extracted fields
 *  extracted           SI/BL comparison with extracted fields
 *  none                nothing more to do (or extraction data unavailable)
 */
export type AnalysisState = "unanalysed" | "extraction-missing" | "extracted" | "none";

export function isClassified(email: Email): boolean {
  return email.status === "CLASSIFIED" && email.category !== null;
}

export function getAnalysisState(
  email: Email,
  extractions: Record<string, EmailExtraction> | null,
): AnalysisState {
  if (!isClassified(email)) return "unanalysed";
  if (email.category !== "BL_COMPARISON" || extractions === null) return "none";
  return extractions[email.email_id] ? "extracted" : "extraction-missing";
}

/**
 * Emails that "Analyse all" and automatic analysis pick up.
 * An email with a saved problem is skipped, so a known failure is not retried
 * on every page load. It keeps its own Retry button.
 */
export function needsAutoAnalysis(email: Email, state: AnalysisState): boolean {
  if (state === "unanalysed") return true;
  return state === "extraction-missing" && !email.review_reason;
}

/** Drops the "Extraction:" prefix the backend adds to the reasons it saves. */
export function cleanReason(reason: string): string {
  return reason.replace(/^Extraction:\s*/i, "").trim();
}

export function describeMissingExtraction(email: Email): string {
  if (email.review_reason) {
    const reason = cleanReason(email.review_reason).replace(/\.$/, "");
    return `Not extracted: ${reason}.`;
  }
  return "Not extracted: extraction has not been run for this email yet.";
}
