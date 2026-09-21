import { cache } from "react";
import { apiGet } from "@/lib/api-client";
import type { SenderSummary } from "../types";

/** Sender domains by email count. Defaults suit the sidebar (top 8 that sent 2 or more). */
export const fetchSenders = cache((minCount = 2, limit = 8): Promise<SenderSummary[]> => {
  return apiGet<SenderSummary[]>("/senders", { min_count: minCount, limit });
});
