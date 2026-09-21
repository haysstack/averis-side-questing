import { apiGet } from "@/lib/api-client";
import type { EmailExtraction, ExtractionRow } from "../extractionTypes";

/**
 * Loads extractions for many emails in one request and groups them by email.
 * Needs GET /extractions?email_ids=a,b,c on the backend.
 */
export async function fetchExtractions(
  emailIds: string[],
): Promise<Record<string, EmailExtraction>> {
  if (emailIds.length === 0) return {};

  const rows = await apiGet<ExtractionRow[]>("/extractions", {
    email_ids: emailIds.join(","),
  });

  const byEmail: Record<string, EmailExtraction> = {};
  for (const row of rows) {
    const entry = (byEmail[row.email_id] ??= { si: null, bl: null });
    if (row.doc_type === "SI") entry.si = row;
    else if (row.doc_type === "BL") entry.bl = row;
  }
  return byEmail;
}
