import { ApiError } from "@/lib/api-client";
import { routes } from "@/lib/routes";
import { getAnalysisState, needsAutoAnalysis } from "../analysis";
import { fetchEmails, fetchEmailStats, PAGE_SIZE } from "../api/emails";
import { fetchExtractions } from "../api/extractions";
import type { ExtractionViewConfig } from "../config/views";
import type { Email } from "../types";
import AnalysePageControls from "./AnalysePageControls";
import EmailDetailPanel from "./EmailDetailPanel";
import EmailList from "./EmailList";
import Pagination from "./Pagination";

async function loadEmails(
  view: ExtractionViewConfig,
  page: number,
): Promise<{ emails: Email[]; error: string | null }> {
  try {
    return { emails: await fetchEmails(view.filters, page), error: null };
  } catch (error) {
    const message =
      error instanceof ApiError ? error.message : "Something went wrong while loading emails.";
    return { emails: [], error: message };
  }
}

export default async function ExtractionView({
  view,
  page,
  selectedId,
}: {
  view: ExtractionViewConfig;
  page: number;
  selectedId?: string;
}) {
  const [{ emails, error }, stats] = await Promise.all([
    loadEmails(view, page),
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

  const total = stats ? view.count(stats) : null;
  const totalPages = total !== null ? Math.max(1, Math.ceil(total / PAGE_SIZE)) : null;
  const hasNext = total !== null ? page * PAGE_SIZE < total : emails.length === PAGE_SIZE;
  const basePath = routes.extraction(view.slug || undefined);

  const pageQuery = page > 1 ? `page=${page}` : "";
  const hrefFor = (emailId?: string) => {
    const query = [pageQuery, emailId ? `email=${encodeURIComponent(emailId)}` : ""]
      .filter(Boolean)
      .join("&");
    return query ? `${basePath}?${query}` : basePath;
  };
  const selected = selectedId ? (emails.find((e) => e.email_id === selectedId) ?? null) : null;

  return (
    <div className={selected ? "flex items-start gap-6" : "mx-auto max-w-4xl"}>
    <section className="min-w-0 flex-1">
      <header className="mb-6">
        <h2 className="text-2xl font-semibold text-navy">{view.title}</h2>
        <p className="mt-1 text-gray-600">
          {view.description}
          {total !== null && ` ${total} ${total === 1 ? "email" : "emails"} in this view.`}
        </p>
      </header>

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
          <EmailList emails={emails} extractions={extractions} hrefFor={hrefFor} selectedId={selected?.email_id} />
          <Pagination basePath={basePath} page={page} totalPages={totalPages} hasNext={hasNext} />
        </>
      )}
    </section>
    {selected && <EmailDetailPanel email={selected} closeHref={hrefFor()} />}
    </div>
  );
}
