import { apiGet } from "@/lib/api-client";
import type { ComparisonRow } from "../comparisonTypes.ts";

/**
 * Loads comparison results for many emails in one request, keyed by email id.
 * Uses GET /comparisons?email_ids=a,b,c on the backend (already implemented).
 */
export async function fetchComparisons(
  emailIds: string[],
): Promise<Record<string, ComparisonRow>> {
  if (emailIds.length === 0) return {};

  const rows = await apiGet<ComparisonRow[]>("/comparisons", {
    email_ids: emailIds.join(","),
  });

  const byEmail: Record<string, ComparisonRow> = {};
  for (const row of rows) byEmail[row.email_id] = row;
  return byEmail;
}