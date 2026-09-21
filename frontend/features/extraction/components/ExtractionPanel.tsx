import { EXTRACTION_FIELDS, LOW_CONFIDENCE_THRESHOLD } from "../config/fields";
import type { EmailExtraction, ExtractionFieldKey, ExtractionRow } from "../extractionTypes";

function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function formatValue(key: ExtractionFieldKey, row: ExtractionRow | null): string | null {
  if (!row) return null;
  const value = row[key];
  if (value === null || value === undefined || value === "") return null;
  if (key === "gross_weight_kg") {
    const n = toNumber(value);
    return n === null ? String(value) : `${n.toLocaleString("en-US")} kg`;
  }
  return String(value);
}

function ConfidenceChip({ label, row }: { label: string; row: ExtractionRow | null }) {
  const base = "rounded-full px-2 py-0.5 text-xs font-medium tabular-nums";

  if (!row) {
    return <span className={`${base} bg-gray-100 text-gray-500`}>{label} missing</span>;
  }
  const confidence = toNumber(row.confidence);
  if (confidence === null) {
    return <span className={`${base} bg-gray-100 text-gray-500`}>{label} no score</span>;
  }

  const low = confidence < LOW_CONFIDENCE_THRESHOLD;
  return (
    <span className={`${base} ${low ? "bg-tangerine/25 text-gray-900" : "bg-gray-100 text-gray-700"}`}>
      {label} {Math.round(confidence * 100)}%{low ? " (low)" : ""}
    </span>
  );
}

export default function ExtractionPanel({ extraction }: { extraction: EmailExtraction }) {
  const { si, bl } = extraction;

  return (
    <details className="group border-t border-gray-100 bg-gray-50">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-6 py-2.5 text-sm font-medium text-navy hover:bg-cream/40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-navy [&::-webkit-details-marker]:hidden">
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className="size-4 shrink-0 fill-current transition-transform group-open:rotate-90"
        >
          <path d="M7 4l6 6-6 6V4z" />
        </svg>
        <span>Extracted fields</span>
        <span className="ml-auto flex gap-2">
          <ConfidenceChip label="SI" row={si} />
          <ConfidenceChip label="BL" row={bl} />
        </span>
      </summary>

      <div className="overflow-x-auto px-6 pb-4">
        <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500">
              <th scope="col" className="w-40 py-2 pr-4 font-medium">Field</th>
              <th scope="col" className="py-2 pr-4 font-medium">Shipping instruction (SI)</th>
              <th scope="col" className="py-2 font-medium">Bill of lading (BL)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {EXTRACTION_FIELDS.map(({ key, label }) => {
              const siValue = formatValue(key, si);
              const blValue = formatValue(key, bl);
              return (
                <tr key={key}>
                  <th scope="row" className="py-2 pr-4 text-left align-top font-medium text-gray-700">
                    {label}
                  </th>
                  <td className="py-2 pr-4 align-top break-words text-gray-900">
                    {siValue ?? <span className="text-gray-400">Not found</span>}
                  </td>
                  <td className="py-2 align-top break-words text-gray-900">
                    {blValue ?? <span className="text-gray-400">Not found</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </details>
  );
}
