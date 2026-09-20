import Link from "next/link";

interface PaginationProps {
  basePath: string;
  page: number;
  totalPages: number | null;
  hasNext: boolean;
}

const BUTTON =
  "rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-navy transition-colors hover:bg-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy";
const DISABLED =
  "rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm font-medium text-gray-400";

function pageHref(basePath: string, page: number): string {
  return page <= 1 ? basePath : `${basePath}?page=${page}`;
}

export default function Pagination({ basePath, page, totalPages, hasNext }: PaginationProps) {
  if (page === 1 && !hasNext) return null;

  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between">
      {page > 1 ? (
        <Link href={pageHref(basePath, page - 1)} className={BUTTON}>
          Previous
        </Link>
      ) : (
        <span className={DISABLED}>Previous</span>
      )}

      <span className="text-sm text-gray-500">
        {totalPages ? `Page ${page} of ${totalPages}` : `Page ${page}`}
      </span>

      {hasNext ? (
        <Link href={pageHref(basePath, page + 1)} className={BUTTON}>
          Next
        </Link>
      ) : (
        <span className={DISABLED}>Next</span>
      )}
    </nav>
  );
}
