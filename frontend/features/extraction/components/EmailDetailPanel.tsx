import Link from "next/link";
import { cleanReason } from "../analysis";
import type { Email } from "../types";
import CategoryBadge from "./CategoryBadge";
import PriorityBadge from "./PriorityBadge";

/** Right-hand panel with the full email. Closing = following a link without ?email=. */
export default function EmailDetailPanel({ email, closeHref }: { email: Email; closeHref: string }) {
  return (
    <aside
      aria-label="Email details"
      className="fixed inset-y-0 right-0 z-30 flex w-full max-w-md flex-col overflow-hidden bg-white shadow-xl md:sticky md:top-6 md:z-auto md:max-h-[calc(100vh-3rem)] md:w-[28rem] md:shrink-0 md:rounded-lg md:border md:border-gray-200 md:shadow-none"
    >
      <header className="flex items-start justify-between gap-3 border-b border-gray-200 px-5 py-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <CategoryBadge category={email.category} />
            <span className="text-xs text-gray-500">{email.email_id}</span>
          </div>
          <h2 className="mt-2 font-semibold break-words text-gray-900">{email.subject || "(No subject)"}</h2>
          <p className="text-sm break-words text-gray-500">{email.from_addr ?? "Unknown sender"}</p>
        </div>
        <Link
          href={closeHref}
          scroll={false}
          aria-label="Close email"
          className="shrink-0 rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-2 focus-visible:outline-navy"
        >
          <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5 fill-none stroke-current stroke-2">
            <path d="M5 5l10 10M15 5L5 15" />
          </svg>
        </Link>
      </header>

      <div className="space-y-4 overflow-y-auto px-5 py-4">
        <PriorityBadge priority={email.priority} />
        {email.ai_summary && (
          <div className="rounded-lg border border-honey bg-cream/50 p-3">
            <p className="text-sm font-medium text-navy">AI summary</p>
            <p className="mt-1 text-sm text-gray-900">{email.ai_summary}</p>
          </div>
        )}
        {email.review_reason && (
          <p className="text-sm text-gray-900">
            <span className="font-medium">Needs review:</span> {cleanReason(email.review_reason)}
          </p>
        )}
        <div>
          <p className="text-sm font-medium text-gray-700">Original email</p>
          <p className="mt-1 text-sm leading-6 break-words whitespace-pre-wrap text-gray-900">
            {email.body || "(Empty)"}
          </p>
        </div>
      </div>
    </aside>
  );
}
