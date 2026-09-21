/** Row shape of the Supabase `extractions` table (one row per SI or BL). */
export type ExtractionFieldKey =
  | "shipper"
  | "consignee"
  | "notify_party"
  | "port_of_loading"
  | "port_of_discharge"
  | "container_count"
  | "gross_weight_kg";

export interface ExtractionRow {
  id: number;
  email_id: string;
  doc_type: string; // "SI" | "BL"
  shipper: string | null;
  consignee: string | null;
  notify_party: string | null;
  port_of_loading: string | null;
  port_of_discharge: string | null;
  container_count: number | null;
  gross_weight_kg: number | string | null;
  confidence: number | string | null;
}

/** Both documents for one email. A side is null if that document has no row. */
export interface EmailExtraction {
  si: ExtractionRow | null;
  bl: ExtractionRow | null;
}
