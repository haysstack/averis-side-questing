import { cache } from "react";
import { apiGet } from "@/lib/api-client";
import type { Email, EmailFilters, EmailStats, ListQuery } from "../types";

export const PAGE_SIZE = 20;

/** `filters` come from the sidebar view; `query` comes from the URL (search, filters, sort, page). */
export function fetchEmails(filters: EmailFilters, query: ListQuery): Promise<Email[]> {
  return apiGet<Email[]>("/emails", {
    category: filters.category,
    priority: query.priority ?? filters.priority,
    status: query.status ?? filters.status,
    needs_review: filters.needsReview ? "true" : undefined,
    sender_domain: filters.senderDomain,
    search: query.q,
    search_field: query.q ? query.field : undefined,
    attachments_only: query.attachments ? "true" : undefined,
    sort: query.sort,
    limit: PAGE_SIZE,
    offset: (query.page - 1) * PAGE_SIZE,
  });
}

/** Wrapped in cache() so the layout and the page share one request per render. */
export const fetchEmailStats = cache((): Promise<EmailStats> => {
  return apiGet<EmailStats>("/classification/stats");
});
