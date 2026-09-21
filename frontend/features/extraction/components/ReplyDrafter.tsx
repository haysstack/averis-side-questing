"use client";

import { useEffect, useState } from "react";
import { requestReplyDraft } from "../api/replyClient";
import type { ReplyDraft } from "../types";

const BUTTON =
  "rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-navy transition-colors hover:bg-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy disabled:cursor-not-allowed disabled:opacity-60";
const FIELD =
  "w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus-visible:outline-2 focus-visible:outline-navy";

/** "Draft reply" button plus the dialog with the editable draft. Give it key={emailId}. */
export default function ReplyDrafter({ emailId }: { emailId: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<ReplyDraft | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function load(forceAi: boolean) {
    setBusy(true);
    setError(null);
    const result = await requestReplyDraft(emailId, forceAi);
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setDraft(result);
    setSubject(result.subject);
    setBody(result.body);
  }

  function openDialog() {
    setOpen(true);
    if (!draft) void load(false);
  }

  async function copyBody() {
    try {
      await navigator.clipboard.writeText(body);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable: the text can still be selected by hand
    }
  }

  const mailto = draft?.to
    ? `mailto:${draft.to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    : null;

  return (
    <>
      <button type="button" onClick={openDialog} className={BUTTON}>
        Draft reply
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Draft reply"
          onMouseDown={() => setOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4"
        >
          <div
            onMouseDown={(event) => event.stopPropagation()}
            className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-white shadow-xl"
          >
            <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-5 py-3">
              <div>
                <h3 className="font-semibold text-gray-900">Draft reply</h3>
                {draft && (
                  <p className="text-sm text-gray-500">
                    {draft.source === "ai"
                      ? "Written by AI. Check it before sending."
                      : `From template: ${draft.template}`}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close draft reply"
                className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-2 focus-visible:outline-navy"
              >
                <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5 fill-none stroke-current stroke-2">
                  <path d="M5 5l10 10M15 5L5 15" />
                </svg>
              </button>
            </div>

            <div className="space-y-3 overflow-y-auto px-5 py-4">
              {busy && <p className="text-sm text-gray-600">Drafting…</p>}
              {error && (
                <p role="alert" className="rounded-md border border-tangerine bg-cream/50 px-3 py-2 text-sm text-gray-900">
                  {error}
                </p>
              )}
              {draft && (
                <>
                  <div>
                    <label htmlFor="reply-to" className="mb-1 block text-sm font-medium text-gray-700">To</label>
                    <input id="reply-to" readOnly value={draft.to ?? "(no address found)"} className={`${FIELD} bg-gray-50 text-gray-600`} />
                  </div>
                  <div>
                    <label htmlFor="reply-subject" className="mb-1 block text-sm font-medium text-gray-700">Subject</label>
                    <input id="reply-subject" value={subject} onChange={(e) => setSubject(e.target.value)} className={FIELD} />
                  </div>
                  <div>
                    <label htmlFor="reply-body" className="mb-1 block text-sm font-medium text-gray-700">Message</label>
                    <textarea id="reply-body" rows={12} value={body} onChange={(e) => setBody(e.target.value)} className={`${FIELD} leading-6`} />
                  </div>
                </>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-gray-200 px-5 py-3">
              <button type="button" onClick={() => void load(true)} disabled={busy} className={BUTTON}>
                Rewrite with AI
              </button>
              <span className="ml-auto flex gap-2">
                <button type="button" onClick={copyBody} disabled={!draft} className={BUTTON}>
                  {copied ? "Copied" : "Copy message"}
                </button>
                {mailto && (
                  <a
                    href={mailto}
                    className="rounded-md bg-navy px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-navy/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
                  >
                    Open in mail app
                  </a>
                )}
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
