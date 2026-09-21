import { EXTRACTION_FIELDS } from "../config/fields";
import type { EmailExtraction, ExtractionFieldKey, ExtractionRow } from "../extractionTypes";
import type { ComparisonRow } from "../comparisonTypes";
import CompareNowStrip from "./CompareNowStrip";

function formatValue(key: ExtractionFieldKey, row: ExtractionRow | null): string | null {
  if (!row) return null;
  const value = row[key];
  if (value === null || value === undefined || value === "") return null;
  if (key === "gross_weight_kg") {
    const n = Number(value);
    return Number.isFinite(n) ? `${n.toLocaleString("en-US")} kg` : String(value);
  }
  return String(value);
}

function StatusChip({ comparison }: { comparison: ComparisonRow }) {
  const base = "rounded-full px-2 py-0.5 text-xs font-medium";
  if (comparison.has_defect) {
    return (
      <span className={`${base} bg-tangerine/25 text-gray-900`}>
        {comparison.defect_fields.length} mismatch{comparison.defect_fields.length === 1 ? "" : "es"}
      </span>
    );
  }
  return <span className={`${base} bg-gray-100 text-gray-700`}>Matches</span>;
}

export default function ComparisonPanel({
  emailId,
  extraction,
  comparison,
}: {
  emailId: string;
  extraction: EmailExtraction;
  comparison: ComparisonRow | null;
}) {
  if (!comparison) {
    return <CompareNowStrip emailId={emailId} />;
  }

  const { si, bl } = extraction;
  const defects = new Set(comparison.defect_fields);

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
        <span>Comparison</span>
        <span className="ml-auto">
          <StatusChip comparison={comparison} />
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
              const isDefect = defects.has(key);
              return (
                <tr key={key} className={isDefect ? "bg-tangerine/10" : undefined}>
                  <th scope="row" className="py-2 pr-4 text-left align-top font-medium text-gray-700">
                    {label}
                    {isDefect && (
                      <span className="ml-2 rounded bg-tangerine/25 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-gray-900">
                        Differs
                      </span>
                    )}
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