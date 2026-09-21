import { routes } from "@/lib/routes";
import type { EmailFilters, EmailStats, SenderSummary, SidebarSection } from "../types";

export interface ExtractionViewConfig {
  /** URL segment under /extraction. Empty string means "All". */
  slug: string;
  /** Sidebar label. */
  label: string;
  /** Page heading. */
  title: string;
  description: string;
  /** Sent to GET /emails. */
  filters: EmailFilters;
  /** Number shown next to the sidebar label. */
  count: (stats: EmailStats) => number;
  /** Optional second number: emails in this view that are not analysed yet. */
  pending?: (stats: EmailStats) => number;
}

/**
 * The sidebar is generated from this list, in this order.
 * To add a view: add an object here. No other file needs to change.
 */
export const EXTRACTION_VIEWS: ExtractionViewConfig[] = [
  {
    slug: "",
    label: "All",
    title: "All emails",
    description: "Every email pulled from the inbox.",
    filters: {},
    count: (s) => s.total,
    pending: (s) => s.by_status.PENDING ?? 0,
  },
  {
    slug: "invoice-queries",
    label: "Invoice Queries",
    title: "Invoice queries",
    description: "Billing, charges, payment and freight-cost questions.",
    filters: { category: "INVOICE_QUERY" },
    count: (s) => s.by_category.INVOICE_QUERY ?? 0,
  },
  {
    slug: "si-bl-comparisons",
    label: "SI and BL Comparisons",
    title: "SI and BL comparisons",
    description: "Requests to check a Shipping Instruction against a draft Bill of Lading.",
    filters: { category: "BL_COMPARISON" },
    count: (s) => s.by_category.BL_COMPARISON ?? 0,
  },
  {
    slug: "bl-amendments",
    label: "BL Amendments",
    title: "BL amendment requests",
    description: "SI and BL comparisons with detected discrepancies requiring correction requests to the carrier.",
    filters: { category: "BL_COMPARISON", status: "MISMATCH" },
    count: (s) => s.by_status.MISMATCH ?? 0,
  },
  {
    slug: "si-requests",
    label: "SI Creation Requests",
    title: "SI creation requests",
    description: "Requests to create, amend or prepare a Shipping Instruction.",
    filters: { category: "SI_REQUEST" },
    count: (s) => s.by_category.SI_REQUEST ?? 0,
  },
  {
    // Needs the backend's needs_review filter (open rows in the `reviews` table).
    slug: "unreviewed",
    label: "Unreviewed",
    title: "Unreviewed emails",
    description: "Emails flagged for a person to check.",
    filters: { needsReview: true },
    count: (s) => s.needs_review ?? 0,
  },
  {
    slug: "general",
    label: "General",
    title: "General emails",
    description: "Operational updates, reminders and announcements.",
    filters: { category: "GENERAL" },
    count: (s) => s.by_category.GENERAL ?? 0,
  },
  {
    slug: "spam",
    label: "Spam",
    title: "Spam",
    description: "Phishing, scams and unsolicited messages.",
    filters: { category: "SPAM" },
    count: (s) => s.by_category.SPAM ?? 0,
  },
];

export const ALL_VIEW = EXTRACTION_VIEWS[0];

export function getViewBySlug(slug: string): ExtractionViewConfig | undefined {
  return EXTRACTION_VIEWS.find((view) => view.slug === slug);
}

/**
 * Builds the serializable data the (client) sidebar renders.
 * To link a teammate's page, add another section or item here, e.g.
 *   { title: "Workflows", items: [{ href: routes.review, label: "Review queue" }] }
 */
export function buildSidebarSections(
  stats: EmailStats | null,
  senders: SenderSummary[] = [],
): SidebarSection[] {
  const sections: SidebarSection[] = [
    {
      items: EXTRACTION_VIEWS.map((view) => ({
        href: routes.extraction(view.slug || undefined),
        label: view.label,
        count: stats ? view.count(stats) : null,
        pendingCount: stats && view.pending ? view.pending(stats) : null,
      })),
    },
  ];

  if (senders.length > 0) {
    sections.push({
      title: "Frequent senders",
      items: senders.map((sender) => ({
        href: routes.extraction(`senders/${sender.domain}`),
        label: sender.domain,
        count: sender.count,
      })),
    });
  }

  return sections;
}

/** A view for one sender domain. Not in EXTRACTION_VIEWS because it is built from live data. */
export function senderView(sender: SenderSummary): ExtractionViewConfig {
  return {
    slug: `senders/${sender.domain}`,
    label: sender.domain,
    title: `Emails from ${sender.domain}`,
    description: "Every email sent from this domain.",
    filters: { senderDomain: sender.domain },
    count: () => sender.count,
  };
}
