import type { EmailCategory, EmailPriority } from "../types";

export const CATEGORY_META: Record<EmailCategory, { label: string; className: string }> = {
  BL_COMPARISON: { label: "SI/BL comparison", className: "bg-navy text-white" },
  SI_REQUEST: { label: "SI request", className: "bg-steel/15 text-navy ring-1 ring-inset ring-steel/40" },
  INVOICE_QUERY: { label: "Invoice query", className: "bg-cream text-navy ring-1 ring-inset ring-honey" },
  GENERAL: { label: "General", className: "bg-gray-100 text-gray-700" },
  SPAM: { label: "Spam", className: "bg-gray-100 text-gray-500" },
};

/** `swatch` colours both the dot in the badge and the left edge of each row. */
export const PRIORITY_META: Record<EmailPriority, { label: string; swatch: string }> = {
  High: { label: "High priority", swatch: "bg-tangerine" },
  Medium: { label: "Medium priority", swatch: "bg-honey" },
  Low: { label: "Low priority", swatch: "bg-gray-300" },
};
