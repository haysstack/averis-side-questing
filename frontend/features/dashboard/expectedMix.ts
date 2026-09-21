import type { EmailCategory } from "@/features/extraction/types";

/** Main-set mix from the brief, plus 20 BL reliability emails (501–520). */
export const EXPECTED_CATEGORY_COUNTS: Record<EmailCategory, number> = {
  BL_COMPARISON: 220,
  SI_REQUEST: 125,
  INVOICE_QUERY: 75,
  GENERAL: 60,
  SPAM: 40,
};

export const EXPECTED_TOTAL = 520;
