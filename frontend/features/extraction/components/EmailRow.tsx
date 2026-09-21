import Link from "next/link";
import { cleanReason } from "../analysis";
import { PRIORITY_META } from "../config/categories";
import type { Email } from "../types";
import CategoryBadge from "./CategoryBadge";
import PriorityBadge from "./PriorityBadge";

function formatStatus(status: string): string {
  const lower = status.toLowerCase().replace(/_/g, " ");
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export default function EmailRow({
  email,
  href,
  selected = false,
  showReviewReason = true,
}: {
  email: Email;
  href: string;
  selected?: boolean;
  showReviewReason?: boolean;
}) {
  const edge = email.priority ? PRIORITY_META[email.priority].swatch : "bg-gray-200";
  const showStatus = email.status && email.status !== "CLASSIFIED";

  return (
    <div className={selected ? "bg-cream/60" : undefined}>
      <Link
        href={href}
        scroll={false}
        className="relative flex gap-4 py-4 pr-5 pl-6 transition-colors hover:bg-cream/40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-navy"
      >
        <span aria-hidden className={`absolute inset-y-0 left-0 w-1 ${edge}`} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <CategoryBadge category={email.category} />
            <span className="text-xs text-gray-500">{email.email_id}</span>
          </div>
          <p className="mt-1.5 truncate font-medium text-gray-900">
            {email.subject || "(No subject)"}
          </p>
          <p className="truncate text-sm text-gray-500">{email.from_addr ?? "Unknown sender"}</p>
          {email.ai_summary && (
            <p className="mt-1 line-clamp-2 text-sm text-gray-700">{email.ai_summary}</p>
          )}
          {showReviewReason && email.review_reason && (
            <p className="mt-1 text-sm text-gray-900">
              <span className="font-medium">Needs review:</span> {cleanReason(email.review_reason)}
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <PriorityBadge priority={email.priority} />
          {showStatus && (
            <span className="text-xs text-gray-500">{formatStatus(email.status!)}</span>
          )}
        </div>
      </Link>
    </div>
  );
}
