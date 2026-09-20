import { cache } from "react";
import { apiGet } from "@/lib/api-client";
import type { Email, EmailFilters, EmailStats } from "../types";

export const PAGE_SIZE = 20;

export function fetchEmails(filters: EmailFilters, page = 1): Promise<Email[]> {
  return apiGet<Email[]>("/emails", {
    category: filters.category,
    priority: filters.priority,
    status: filters.status,
    needs_review: filters.needsReview ? "true" : undefined,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });
}

/** Wrapped in cache() so the layout and the page share one request per render. */
export const fetchEmailStats = cache((): Promise<EmailStats> => {
  return apiGet<EmailStats>("/classification/stats");
});
