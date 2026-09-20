import { getAnalysisState } from "../analysis";
import type { EmailExtraction } from "../extractionTypes";
import type { Email } from "../types";
import EmailAnalysis from "./EmailAnalysis";
import EmailRow from "./EmailRow";

interface EmailListProps {
  emails: Email[];
  /** null means the extraction data could not be loaded. */
  extractions: Record<string, EmailExtraction> | null;
  /** Link for opening an email (or closing the panel when called with no id). */
  hrefFor: (emailId?: string) => string;
  selectedId?: string;
}

export default function EmailList({ emails, extractions, hrefFor, selectedId }: EmailListProps) {
  if (emails.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-white px-6 py-14 text-center">
        <p className="font-medium text-gray-900">No emails in this view</p>
        <p className="mt-1 text-sm text-gray-500">
          Emails show up here after they are imported and classified.
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-gray-200 overflow-hidden rounded-lg border border-gray-200 bg-white">
      {emails.map((email) => {
        const state = getAnalysisState(email, extractions);
        return (
          <li key={email.email_id}>
            {/* When the strip explains a missing extraction, it shows the reason, so the row does not. */}
            <EmailRow
              email={email}
              href={hrefFor(email.email_id)}
              selected={email.email_id === selectedId}
              showReviewReason={state !== "extraction-missing"}
            />
            <EmailAnalysis
              email={email}
              state={state}
              extraction={extractions?.[email.email_id] ?? null}
            />
          </li>
        );
      })}
    </ul>
  );
}
