import { ApiError, apiPost } from "@/lib/api-client";
import { CATEGORY_META } from "../config/categories";
import type { AnalyseResult, EmailCategory } from "../types";

interface ClassifyResponse {
  category: EmailCategory;
}

interface ExtractResponse {
  skipped?: boolean;
  reason?: string;
}

function errorText(error: unknown): string {
  return error instanceof ApiError ? error.message : "Unexpected error.";
}

/**
 * Runs the whole pipeline for one email:
 *  1. classify (returns the saved result instantly if already classified)
 *  2. if it is an SI/BL comparison, extract the fields from both documents
 * Safe to call again: nothing is repeated that has already been done, except extraction.
 */
export async function analyseEmail(emailId: string): Promise<AnalyseResult> {
  const id = encodeURIComponent(emailId);

  let category: EmailCategory;
  try {
    const classified = await apiPost<ClassifyResponse>(`/classify/${id}`);
    category = classified.category;
  } catch (error) {
    return { ok: false, message: `Classification failed. ${errorText(error)}` };
  }

  if (category !== "BL_COMPARISON") {
    return {
      ok: true,
      extraction: "not_needed",
      message: `Classified as ${CATEGORY_META[category].label}.`,
    };
  }

  try {
    const extraction = await apiPost<ExtractResponse>(`/extract/${id}`);
    if (extraction.skipped) {
      return {
        ok: true,
        extraction: "skipped",
        message: `Not extracted: ${extraction.reason ?? "the backend skipped this email."}`,
      };
    }
    return { ok: true, extraction: "extracted", message: "Extracted the SI and BL fields." };
  } catch (error) {
    return { ok: false, message: `Extraction failed. ${errorText(error)}` };
  }
}
