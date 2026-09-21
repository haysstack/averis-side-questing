import Link from "next/link";
import type { ListQuery } from "../types";
import { buildHref } from "../utils";
import PageJump from "./PageJump";

interface PaginationProps {
  basePath: string;
  page: number;
  totalPages: number | null;
  hasNext: boolean;
  query: ListQuery;
}

const BUTTON =
  "rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-navy transition-colors hover:bg-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy";
const DISABLED =
  "rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm font-medium text-gray-400";

export default function Pagination({ basePath, page, totalPages, hasNext, query }: PaginationProps) {
  if (page === 1 && !hasNext) return null;

  return (
    <nav aria-label="Pagination" className="mt-4 flex flex-wrap items-center justify-between gap-3">
      {page > 1 ? (
        <Link href={buildHref(basePath, { ...query, page: page - 1, email: undefined })} className={BUTTON}>
          Previous
        </Link>
      ) : (
        <span className={DISABLED}>Previous</span>
      )}

      {totalPages ? (
        <PageJump key={page} basePath={basePath} page={page} totalPages={totalPages} query={query} />
      ) : (
        <span className="text-sm text-gray-500">Page {page}</span>
      )}

      {hasNext ? (
        <Link href={buildHref(basePath, { ...query, page: page + 1, email: undefined })} className={BUTTON}>
          Next
        </Link>
      ) : (
        <span className={DISABLED}>Next</span>
      )}
    </nav>
  );
}
