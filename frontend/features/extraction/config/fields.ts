import type { ExtractionFieldKey } from "../extractionTypes";

/** The seven fields checked in an SI/BL comparison, in display order. */
export const EXTRACTION_FIELDS: { key: ExtractionFieldKey; label: string }[] = [
  { key: "shipper", label: "Shipper" },
  { key: "consignee", label: "Consignee" },
  { key: "notify_party", label: "Notify party" },
  { key: "port_of_loading", label: "Port of loading" },
  { key: "port_of_discharge", label: "Port of discharge" },
  { key: "container_count", label: "Container count" },
  { key: "gross_weight_kg", label: "Gross weight" },
];

/** Confidence below this (0 to 1) is flagged as low. */
export const LOW_CONFIDENCE_THRESHOLD = 0.6;
