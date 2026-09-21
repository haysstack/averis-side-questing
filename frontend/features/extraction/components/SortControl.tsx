import Link from "next/link";
import type { ListQuery, SortKey } from "../types";
import { buildHref } from "../utils";

const OPTIONS: { key: SortKey | undefined; label: string }[] = [
  { key: undefined, label: "Default" },
  { key: "priority", label: "Priority" },
  { key: "subject", label: "A to Z" },
];

export default function SortControl({ basePath, query }: { basePath: string; query: ListQuery }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-3 text-sm">
      <nav aria-label="Sort emails" className="flex items-center gap-2 text-sm">
        <span className="text-gray-500">Sort by</span>
        <div className="flex overflow-hidden rounded-md border border-gray-300 bg-white">
          {OPTIONS.map(({ key, label }) => {
            const active = key === query.sort;
            return (
              <Link
                key={label}
                href={buildHref(basePath, { ...query, page: 1, email: undefined, sort: key })}
                scroll={false}
                aria-current={active ? "true" : undefined}
                className={`px-3 py-1.5 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-navy ${
                  active ? "bg-cream font-semibold text-navy" : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </div>
      </nav>

      <Link
        href={buildHref(basePath, {
          ...query,
          page: 1,
          email: undefined,
          attachments: query.attachments ? undefined : true,
        })}
        scroll={false}
        className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 transition-colors ${
          query.attachments
            ? "border-navy bg-cream font-semibold text-navy shadow-sm"
            : "border-gray-300 bg-white text-gray-700 hover:bg-gray-100"
        }`}
      >
        <input
          type="checkbox"
          checked={query.attachments}
          readOnly
          aria-hidden="true"
          className="size-4 cursor-pointer accent-navy pointer-events-none"
        />
        <span>Has attachments</span>
      </Link>
    </div>
  );
}
