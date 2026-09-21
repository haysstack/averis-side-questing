import Link from "next/link";
import { ApiError } from "@/lib/api-client";
import { routes } from "@/lib/routes";
import { getAnalysisState, needsAutoAnalysis } from "../analysis";
import { fetchEmails, fetchEmailStats, PAGE_SIZE } from "../api/emails";
import { fetchAttachments } from "../api/attachments";
import { fetchExtractions } from "../api/extractions";
import type { ExtractionViewConfig } from "../config/views";
import type { Email, ListQuery } from "../types";
import { buildHref } from "../utils";
import AnalysePageControls from "./AnalysePageControls";
import EmailDetailPanel from "./EmailDetailPanel";
import EmailList from "./EmailList";
import FilterBar from "./FilterBar";
import Pagination from "./Pagination";
import SortControl from "./SortControl";

async function loadEmails(
  view: ExtractionViewConfig,
  query: ListQuery,
): Promise<{ emails: Email[]; error: string | null }> {
  try {
    return { emails: await fetchEmails(view.filters, query), error: null };
  } catch (error) {
    const message =
      error instanceof ApiError ? error.message : "Something went wrong while loading emails.";
    return { emails: [], error: message };
  }
}

export default async function ExtractionView({
  view,
  query,
}: {
  view: ExtractionViewConfig;
  query: ListQuery;
}) {
  const { page, email: selectedId } = query;

  const [{ emails, error }, stats] = await Promise.all([
    loadEmails(view, query),
    fetchEmailStats().catch(() => null),
  ]);

  // Only SI/BL comparison emails have extracted fields.
  const comparisonIds = emails
    .filter((email) => email.category === "BL_COMPARISON")
    .map((email) => email.email_id);
  const extractions = await fetchExtractions(comparisonIds).catch(() => null);
  const extractionsFailed = comparisonIds.length > 0 && extractions === null;

  // Emails on this page that "Analyse all" and automatic analysis should pick up.
  const pendingIds = emails
    .filter((email) => needsAutoAnalysis(email, getAnalysisState(email, extractions)))
    .map((email) => email.email_id);

  // The stats only count the whole view, so with a search or filter the total is unknown.
  const filtered = Boolean(query.q || query.priority || query.attachments);
  const total = !filtered && stats ? view.count(stats) : null;
  const totalPages = total !== null ? Math.max(1, Math.ceil(total / PAGE_SIZE)) : null;
  const hasNext = total !== null ? page * PAGE_SIZE < total : emails.length === PAGE_SIZE;
  const basePath = routes.extraction(view.slug || undefined);

  const hrefFor = (emailId?: string) => buildHref(basePath, { ...query, email: emailId });
  const selected = selectedId ? (emails.find((e) => e.email_id === selectedId) ?? null) : null;
  const attachments = selected ? await fetchAttachments(selected.email_id).catch(() => null) : [];

  return (
    <div className={selected ? "flex items-start gap-6 max-w-7xl mx-auto" : "mx-auto max-w-6xl"}>
      <section className="min-w-0 flex-1">
        <FilterBar key={`${query.q ?? ""}|${query.field}`} basePath={basePath} query={query} />

        <header className="mb-6">
          <h2 className="text-2xl font-semibold text-navy">{view.title}</h2>
          <p className="mt-1 text-gray-600">
            {view.description}
            {total !== null && ` ${total} ${total === 1 ? "email" : "emails"} in this view.`}
          </p>
        </header>

        {view.slug === "si-bl-comparisons" && (
          <div className="mb-5 flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 shadow-sm">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 mr-1">
              Outcome:
            </span>
            <Link
              href={buildHref(basePath, { ...query, page: 1, status: undefined })}
              scroll={false}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                !query.status
                  ? "bg-navy text-white shadow-sm"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              All Comparisons
            </Link>
            <Link
              href={buildHref(basePath, { ...query, page: 1, status: "MISMATCH" })}
              scroll={false}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                query.status === "MISMATCH"
                  ? "bg-rose-700 text-white shadow-sm"
                  : "bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100"
              }`}
            >
              Action Required (Mismatch)
            </Link>
            <Link
              href={buildHref(basePath, { ...query, page: 1, status: "OK" })}
              scroll={false}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                query.status === "OK"
                  ? "bg-emerald-700 text-white shadow-sm"
                  : "bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100"
              }`}
            >
              Matched (OK)
            </Link>
          </div>
        )}

        {error ? (
          <div role="alert" className="rounded-lg border border-tangerine bg-cream/50 px-5 py-4">
            <p className="font-medium text-gray-900">Emails could not be loaded</p>
            <p className="mt-1 text-sm text-gray-700">{error}</p>
          </div>
        ) : (
          <>
            {extractionsFailed && (
              <p role="alert" className="mb-3 rounded-md border border-tangerine bg-cream/50 px-4 py-2 text-sm text-gray-900">
                Extracted fields could not be loaded. Check that the backend has GET /extractions.
              </p>
            )}
            {emails.length > 0 && (
              <AnalysePageControls pendingIds={pendingIds} pageCount={emails.length} />
            )}
            <div className="mb-3 flex justify-end">
              <SortControl basePath={basePath} query={query} />
            </div>
            <EmailList
              emails={emails}
              extractions={extractions}
              basePath={basePath}
              query={query}
              selectedId={selected?.email_id}
              filtered={filtered}
            />
            <Pagination
              basePath={basePath}
              page={page}
              totalPages={totalPages}
              hasNext={hasNext}
              query={query}
            />
          </>
        )}
      </section>
      {selected && (
        <EmailDetailPanel email={selected} closeHref={hrefFor()} attachments={attachments} />
      )}
    </div>
  );
}
