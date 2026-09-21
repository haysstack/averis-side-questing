import { ApiError, apiPost } from "@/lib/api-client";
import { CATEGORY_META } from "../config/categories";
import type { AnalyseResult, EmailCategory } from "../types";

export type AnalyseStep = "all" | "classify" | "extract";

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
 * Runs the pipeline for one email.
 *  classify: classify only (instant if already classified)
 *  extract:  extract SI/BL fields only (for SI/BL comparison emails)
 *  all:      classify, then extract if it is an SI/BL comparison
 */
export async function analyseEmail(
  emailId: string,
  step: AnalyseStep = "all",
): Promise<AnalyseResult> {
  const id = encodeURIComponent(emailId);
  let category: EmailCategory = "BL_COMPARISON"; // the extract step only applies to comparisons

  if (step !== "extract") {
    try {
      category = (await apiPost<ClassifyResponse>(`/classify/${id}`)).category;
    } catch (error) {
      return { ok: false, message: `Classification failed. ${errorText(error)}` };
    }

    const label = `Classified as ${CATEGORY_META[category].label}.`;
    if (category !== "BL_COMPARISON") {
      return { ok: true, extraction: "not_needed", message: label };
    }
    if (step === "classify") {
      return { ok: true, extraction: "pending", message: label };
    }
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
