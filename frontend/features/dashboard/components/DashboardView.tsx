import Link from "next/link";
import { fetchEmailStats, fetchEmails } from "@/features/extraction/api/emails";
import { CATEGORY_META } from "@/features/extraction/config/categories";
import type { Email, EmailCategory } from "@/features/extraction/types";
import { routes } from "@/lib/routes";

interface CategoryDirectoryItem {
  category: EmailCategory;
  slug: string;
  description: string;
}

const CATEGORY_ITEMS: CategoryDirectoryItem[] = [
  {
    category: "BL_COMPARISON",
    slug: "si-bl-comparisons",
    description: "Verify draft BLs against Shipping Instructions.",
  },
  {
    category: "SI_REQUEST",
    slug: "si-requests",
    description: "Customer booking instructions and SI drafting.",
  },
  {
    category: "INVOICE_QUERY",
    slug: "invoice-queries",
    description: "Billing, freight charges, and invoice queries.",
  },
  {
    category: "GENERAL",
    slug: "general",
    description: "Carrier updates, vessel schedules, and notices.",
  },
  {
    category: "SPAM",
    slug: "spam",
    description: "Filtered unsolicited and non-operational mail.",
  },
];

function count(map: Record<string, number> | undefined, key: string): number {
  return map?.[key] ?? 0;
}

export default async function DashboardView() {
  const [stats, highPriorityEmails, mismatchEmails, siRequestEmails] = await Promise.all([
    fetchEmailStats().catch(() => null),
    fetchEmails(
      { priority: "High" },
      { page: 1, field: "all", attachments: false, sort: "priority" },
    ).catch(() => [] as Email[]),
    fetchEmails(
      { category: "BL_COMPARISON", status: "MISMATCH" },
      { page: 1, field: "all", attachments: false },
    ).catch(() => [] as Email[]),
    fetchEmails(
      { category: "SI_REQUEST" },
      { page: 1, field: "all", attachments: false },
    ).catch(() => [] as Email[]),
  ]);

  const needsReviewCount = stats ? stats.needs_review ?? count(stats.by_status, "NEEDS_REVIEW") : 0;
  const mismatchCount = stats ? count(stats.by_status, "MISMATCH") : 0;

  // Direct to the most recent SI request email if available
  const latestSiEmailId = siRequestEmails.length > 0 ? siRequestEmails[0].email_id : undefined;
  const siCreationHref = routes.siCreation(latestSiEmailId);

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 text-gray-900 md:flex-row">
      {/* Left Sidebar Navigation */}
      <aside className="border-b border-gray-200 bg-white md:sticky md:top-0 md:h-screen md:w-64 md:min-w-64 md:max-w-64 md:shrink-0 md:overflow-y-auto no-scrollbar md:border-r md:border-b-0 flex flex-col">
        {/* Clickable Voyara Shipping Operations Header */}
        <div className="px-5 pt-5 pb-4 md:pt-7">
          <Link
            href={routes.dashboard}
            className="group flex items-center gap-3 rounded-lg p-1 -m-1 transition-colors hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-navy"
            title="Go to Operations Dashboard"
          >
            <div className="flex size-9 items-center justify-center rounded-lg bg-navy text-sm font-bold text-white shadow-xs group-hover:bg-navy/90 transition-colors">
              VA
            </div>
            <div>
              <h1 className="text-base font-bold text-navy leading-tight group-hover:text-tangerine transition-colors">
                Voyara
              </h1>
              <p className="text-xs text-gray-500">Shipping Operations</p>
            </div>
          </Link>
        </div>

        {/* Navigation Links */}
        <nav aria-label="Main Navigation" className="px-3 pb-6 space-y-1 flex-1">
          <p className="px-3 pb-1 text-xs font-bold uppercase tracking-wider text-steel">
            Workspaces
          </p>

          <Link
            href={routes.dashboard}
            className="relative flex items-center justify-between gap-3 rounded-md px-3 py-2 text-sm font-semibold text-navy bg-cream focus-visible:outline-2 focus-visible:outline-navy"
          >
            <span
              aria-hidden
              className="absolute inset-y-1.5 left-0 hidden w-1 rounded-full bg-tangerine md:block"
            />
            <span>Dashboard</span>
          </Link>

          <Link
            href={routes.extraction()}
            className="flex items-center justify-between gap-3 rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors focus-visible:outline-2 focus-visible:outline-navy"
          >
            <span>Email Inbox</span>
          </Link>

          <Link
            href={routes.home}
            className="flex items-center justify-between gap-3 rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors focus-visible:outline-2 focus-visible:outline-navy"
          >
            <span>Human Review</span>
            {needsReviewCount > 0 && (
              <span className="rounded-full bg-tangerine px-2 py-0.5 text-xs font-semibold text-white">
                {needsReviewCount}
              </span>
            )}
          </Link>

          <Link
            href={siCreationHref}
            className="flex items-center justify-between gap-3 rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors focus-visible:outline-2 focus-visible:outline-navy"
          >
            <span>SI Editor</span>
          </Link>

          <Link
            href={routes.extraction("bl-amendments")}
            className="flex items-center justify-between gap-3 rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors focus-visible:outline-2 focus-visible:outline-navy"
          >
            <span>BL Amendments</span>
            {mismatchCount > 0 && (
              <span className="rounded-full bg-tangerine px-2 py-0.5 text-xs font-semibold text-white">
                {mismatchCount}
              </span>
            )}
          </Link>

          {/* Email Inbox Categories Section */}
          <div className="pt-5">
            <p className="px-3 pb-1 text-xs font-bold uppercase tracking-wider text-steel">
              Email Inbox
            </p>
            {CATEGORY_ITEMS.map((item) => (
              <Link
                key={item.category}
                href={routes.extraction(item.slug)}
                className="flex items-center justify-between gap-2 rounded-md px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
              >
                <span className="truncate">{CATEGORY_META[item.category].label}</span>
                {stats && (
                  <span className="tabular-nums text-gray-400">
                    {count(stats.by_category, item.category)}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </nav>
      </aside>

      {/* Main Dashboard Content (Centered and wide to fill the screen) */}
      <main className="min-w-0 flex-1 px-4 py-6 md:px-10 md:py-8">
        <div className="mx-auto max-w-7xl space-y-8">
          {/* Header */}
          <header>
            <h2 className="text-2xl font-bold text-navy">Operations Dashboard</h2>
          </header>

          {/* 4 Core Module Action Cards */}
          <section>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <PrimaryLink
                href={routes.extraction()}
                title="Email Inbox"
                icon={
                  <svg className="size-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                }
                description="View, filter, and inspect incoming shipping emails with AI categorization."
                action="Open Inbox"
              />
              <PrimaryLink
                href={routes.home}
                title="Human Review"
                icon={
                  <svg className="size-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                }
                description="Audit and resolve flagged edge cases and unreadable documents."
                action="Open Review Queue"
                highlight={needsReviewCount > 0}
                badge={needsReviewCount > 0 ? `${needsReviewCount} waiting` : null}
                badgeType="warning"
              />
              <PrimaryLink
                href={routes.extraction("bl-amendments")}
                title="BL Amendments"
                icon={
                  <svg className="size-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                  </svg>
                }
                description="Compare draft BLs against SIs and draft carrier correction emails."
                action="View Amendments"
                highlight={mismatchCount > 0}
                badge={mismatchCount > 0 ? `${mismatchCount} actions` : null}
                badgeType="warning"
              />
              <PrimaryLink
                href={siCreationHref}
                title="SI Creation"
                icon={
                  <svg className="size-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                  </svg>
                }
                description="Create and edit Shipping Instructions. Directs to the latest SI request."
                action="Launch Editor"
              />
            </div>
          </section>

          {!stats ? (
            <div
              role="alert"
              className="rounded-lg border border-tangerine bg-cream/50 px-5 py-4"
            >
              <p className="font-medium text-gray-900">Live operational data could not be loaded</p>
              <p className="mt-1 text-sm text-gray-700">
                Check that the backend server is running. Workspaces remain accessible from the links above.
              </p>
            </div>
          ) : (
            <>
              {/* Emails by Category Directory */}
              <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-xs">
                <div className="mb-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-steel">
                    Emails by Category
                  </h3>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {CATEGORY_ITEMS.map((item) => {
                    const emailCount = count(stats.by_category, item.category);
                    return (
                      <Link
                        key={item.category}
                        href={routes.extraction(item.slug)}
                        className="group flex flex-col justify-between rounded-lg border border-gray-200 p-4 transition-all hover:border-navy/40 hover:bg-gray-50/70"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-sm text-gray-900 group-hover:text-navy">
                              {CATEGORY_META[item.category].label}
                            </span>
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-navy shrink-0">
                              {emailCount} emails
                            </span>
                          </div>
                          <p className="mt-2 text-xs leading-relaxed text-gray-600">
                            {item.description}
                          </p>
                        </div>
                        <div className="mt-3">
                          <span className="inline-flex items-center justify-center rounded-md bg-navy/5 px-2.5 py-1 text-xs font-medium text-navy transition-colors group-hover:bg-navy group-hover:text-white">
                            View emails
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>

              {/* Actionable Queues: Brand Orange (Tangerine) BL Discrepancies & Brand Blue (Steel/Navy) High Priority */}
              <div className="grid gap-6 lg:grid-cols-2">
                <DiscrepancyList emails={mismatchEmails.slice(0, 5)} />
                <HighPriorityList emails={highPriorityEmails.slice(0, 5)} />
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function PrimaryLink({
  href,
  title,
  description,
  action,
  icon,
  highlight = false,
  badge = null,
  badgeType = "neutral",
}: {
  href: string;
  title: string;
  description: string;
  action: string;
  icon?: React.ReactNode;
  highlight?: boolean;
  badge?: string | number | null;
  badgeType?: "neutral" | "warning";
}) {
  const badgeClasses = {
    neutral: "bg-gray-100 text-gray-700",
    warning: "bg-tangerine text-white",
  }[badgeType];

  return (
    <Link
      href={href}
      className={`group flex flex-col justify-between rounded-xl border p-5 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-navy ${
        highlight
          ? "border-tangerine bg-cream/40 hover:bg-cream/70"
          : "border-gray-200 bg-white hover:border-navy/40 hover:bg-gray-50/50"
      }`}
    >
      <div>
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <div className="flex items-center gap-2.5 min-w-0">
            {icon && (
              <span
                className={`flex size-7 shrink-0 items-center justify-center rounded-lg transition-colors ${
                  highlight
                    ? "bg-tangerine/15 text-orange-950 group-hover:bg-tangerine group-hover:text-white"
                    : "bg-navy/5 text-navy group-hover:bg-navy group-hover:text-white"
                }`}
              >
                {icon}
              </span>
            )}
            <h3 className="text-base font-semibold text-navy">{title}</h3>
          </div>
          {badge && (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold shrink-0 whitespace-nowrap ${badgeClasses}`}>
              {badge}
            </span>
          )}
        </div>
        <p className="mt-2 text-xs leading-relaxed text-gray-600">{description}</p>
      </div>
      <div className="mt-4">
        <span className="inline-flex items-center justify-center rounded-md bg-navy/5 px-3 py-1.5 text-xs font-semibold text-navy transition-colors group-hover:bg-navy group-hover:text-white">
          {action}
        </span>
      </div>
    </Link>
  );
}

function DiscrepancyList({ emails }: { emails: Email[] }) {
  return (
    <section className="rounded-xl border border-tangerine/45 bg-tangerine/10 p-5 shadow-xs">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-orange-950">
            Detected BL Discrepancies
          </h3>
          <p className="mt-0.5 text-xs text-orange-900/80">Requires correction email to carrier.</p>
        </div>
        <Link
          href={routes.extraction("bl-amendments")}
          className="rounded-md bg-tangerine/20 px-2.5 py-1 text-xs font-semibold text-orange-950 transition-colors hover:bg-tangerine/30 shrink-0"
        >
          View all amendments
        </Link>
      </div>

      {emails.length === 0 ? (
        <p className="text-xs text-orange-900/70">No discrepancies currently flagged.</p>
      ) : (
        <ul className="space-y-2">
          {emails.map((email) => (
            <li key={email.email_id}>
              <Link
                href={`${routes.extraction("bl-amendments")}?email=${encodeURIComponent(email.email_id)}`}
                className="flex items-start justify-between gap-3 py-2.5 px-3 rounded-lg bg-white/85 hover:bg-white transition-colors border border-tangerine/25 shadow-2xs"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-gray-900">
                    {email.subject || "(No subject)"}
                  </p>
                  <p className="truncate text-[11px] text-gray-500">
                    {email.from_addr ?? "Carrier"} · {email.email_id}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-tangerine/15 px-2 py-0.5 text-[10px] font-semibold text-orange-900 border border-tangerine/35">
                  Mismatch
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function HighPriorityList({ emails }: { emails: Email[] }) {
  return (
    <section className="rounded-xl border border-steel/40 bg-steel/10 p-5 shadow-xs">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-navy">
            High Priority Incoming Emails
          </h3>
          <p className="mt-0.5 text-xs text-navy/70">Urgent shipping operations requiring prompt handling.</p>
        </div>
        <Link
          href={`${routes.extraction()}?sort=priority`}
          className="rounded-md bg-steel/20 px-2.5 py-1 text-xs font-semibold text-navy transition-colors hover:bg-steel/30 shrink-0"
        >
          View inbox by priority
        </Link>
      </div>

      {emails.length === 0 ? (
        <p className="text-xs text-navy/70">No high-priority emails recorded yet.</p>
      ) : (
        <ul className="space-y-2">
          {emails.map((email) => (
            <li key={email.email_id}>
              <Link
                href={`${routes.extraction()}?email=${encodeURIComponent(email.email_id)}`}
                className="flex items-start justify-between gap-3 py-2.5 px-3 rounded-lg bg-white/85 hover:bg-white transition-colors border border-steel/25 shadow-2xs"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-gray-900">
                    {email.subject || "(No subject)"}
                  </p>
                  <p className="truncate text-[11px] text-gray-500">
                    {email.from_addr ?? "Unknown sender"} · {email.email_id}
                  </p>
                </div>
                <span className="shrink-0 text-[11px] font-semibold text-navy bg-steel/15 px-2 py-0.5 rounded-full border border-steel/30">
                  {email.category?.replaceAll("_", " ") ?? "Unclassified"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
