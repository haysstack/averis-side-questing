import type { EmailExtraction } from "./extractionTypes";
import type { Email } from "./types";

export type AnalysisState = "unanalysed" | "extraction-missing" | "extracted" | "none";

export function isClassified(email: Email): boolean {
  return Boolean(email.category) && email.status !== "PENDING" && email.status !== null;
}

export function getAnalysisState(
  email: Email,
  extractions: Record<string, EmailExtraction> | null,
): AnalysisState {
  if (!isClassified(email)) return "unanalysed";
  if (email.category !== "BL_COMPARISON" || extractions === null) return "none";
  if (email.status === "NEEDS_REVIEW") return "none";
  return extractions[email.email_id] ? "extracted" : "extraction-missing";
}

export function needsAutoAnalysis(email: Email, state: AnalysisState): boolean {
  if (state === "unanalysed") return true;
  return state === "extraction-missing" && !email.review_reason && email.status !== "NEEDS_REVIEW";
}

export function cleanReason(reason: string): string {
  return reason.replace(/^Extraction:\s*/i, "").trim();
}

export function describeMissingExtraction(email: Email): string {
  if (email.status === "NEEDS_REVIEW") {
    return `Flagged for human review: ${email.review_reason ? cleanReason(email.review_reason) : "Review required"}.`;
  }
  if (email.review_reason) {
    const reason = cleanReason(email.review_reason).replace(/\.$/, "");
    return `Not extracted: ${reason}.`;
  }
  return "Not extracted: extraction has not been run for this email yet.";
}