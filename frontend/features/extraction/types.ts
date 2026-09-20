export type EmailCategory =
  | "BL_COMPARISON"
  | "SI_REQUEST"
  | "INVOICE_QUERY"
  | "GENERAL"
  | "SPAM";

export type EmailPriority = "Low" | "Medium" | "High";

/** Row shape returned by GET /emails (Supabase `emails` table). */
export interface Email {
  email_id: string;
  from_addr: string | null;
  subject: string | null;
  body: string | null;
  category: EmailCategory | null;
  priority: EmailPriority | null;
  ai_summary: string | null;
  status: string | null; // "PENDING" | "CLASSIFIED" | ... (more may come)
  review_reason: string | null;
}

/** Shape returned by GET /classification/stats. */
export interface EmailStats {
  total: number;
  by_status: Record<string, number>;
  by_category: Record<string, number>;
  by_priority: Record<string, number>;
  needs_review?: number; // emails with an open row in `reviews`
}

/** Filters GET /emails understands. */
export interface EmailFilters {
  category?: EmailCategory;
  priority?: EmailPriority;
  status?: string;
  needsReview?: boolean;
}

export interface SidebarItem {
  href: string;
  label: string;
  count?: number | null;
  /** Emails in this view that are not analysed yet. Shown as a second pill. */
  pendingCount?: number | null;
}

export interface SidebarSection {
  title?: string;
  items: SidebarItem[];
}

/** What the /api/analyse route returns for one email. */
export type AnalyseResult =
  | { ok: true; extraction: "extracted" | "skipped" | "not_needed"; message: string }
  | { ok: false; message: string };
