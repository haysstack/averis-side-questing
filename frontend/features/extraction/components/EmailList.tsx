"use client";

import { useEffect, useState } from "react";
import { getAnalysisState } from "../analysis";
import type { EmailExtraction } from "../extractionTypes";
import type { Email, ListQuery } from "../types";
import { buildHref } from "../utils";
import EmailAnalysis from "./EmailAnalysis";
import EmailRow from "./EmailRow";

interface EmailListProps {
  emails: Email[];
  /** null means the extraction data could not be loaded. */
  extractions: Record<string, EmailExtraction> | null;
  basePath: string;
  query: ListQuery;
  selectedId?: string;
  /** True when a search or filter is active (changes the empty message). */
  filtered?: boolean;
}

export default function EmailList({
  emails,
  extractions,
  basePath,
  query,
  selectedId,
  filtered,
}: EmailListProps) {
  const hrefFor = (emailId?: string) => buildHref(basePath, { ...query, email: emailId });
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  // Load persisted read email IDs from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("averis_read_email_ids");
      if (stored) {
        setReadIds(new Set(JSON.parse(stored)));
      }
    } catch {
      // localStorage unavailable
    }
  }, []);

  // When an email is selected, mark it as read immediately and persist
  useEffect(() => {
    if (!selectedId) return;
    setReadIds((prev) => {
      if (prev.has(selectedId)) return prev;
      const next = new Set(prev).add(selectedId);
      try {
        localStorage.setItem("averis_read_email_ids", JSON.stringify([...next]));
      } catch {
        // storage unavailable
      }
      return next;
    });
  }, [selectedId]);

  if (emails.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-white px-6 py-14 text-center">
        <p className="font-medium text-gray-900">{filtered ? "No emails match your search or filters" : "No emails in this view"}</p>
        <p className="mt-1 text-sm text-gray-500">
          {filtered
            ? "Try a different search or clear the filters."
            : "Emails show up here after they are imported and classified."}
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-gray-200 overflow-hidden rounded-lg border border-gray-200 bg-white">
      {emails.map((email) => {
        const state = getAnalysisState(email, extractions);
        const isRead = readIds.has(email.email_id) || email.email_id === selectedId;
        return (
          <li key={email.email_id}>
            {/* When the strip explains a missing extraction, it shows the reason, so the row does not. */}
            <EmailRow
              email={email}
              href={hrefFor(email.email_id)}
              selected={email.email_id === selectedId}
              isRead={isRead}
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
