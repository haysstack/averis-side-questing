"use client";

import { useEffect, useState } from "react";
import { attachmentUrl, fileKind, fileName } from "../attachmentUtils";
import DocxViewer from "./DocxViewer";

const BUTTON =
  "rounded-md border border-gray-300 bg-white px-2.5 py-1 text-sm font-medium text-navy transition-colors hover:bg-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy";

/** File list with a View button that opens the file in a large dialog. */
export default function AttachmentList({ paths }: { paths: string[] }) {
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const kind = open ? fileKind(open) : null;

  return (
    <>
      <ul className="space-y-1.5">
        {paths.map((path) => (
          <li
            key={path}
            className="flex items-center justify-between gap-3 rounded-md border border-gray-200 px-3 py-2"
          >
            <span className="min-w-0 truncate text-sm text-gray-900" title={path}>
              {fileName(path)}
            </span>
            <span className="flex shrink-0 gap-2">
              <button type="button" onClick={() => setOpen(path)} className={BUTTON}>
                View
              </button>
              <a href={attachmentUrl(path, true)} className={BUTTON}>
                Download
              </a>
            </span>
          </li>
        ))}
      </ul>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Attachment ${fileName(open)}`}
          onMouseDown={() => setOpen(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4"
        >
          <div
            onMouseDown={(event) => event.stopPropagation()}
            className="flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg bg-white shadow-xl"
          >
            <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-4 py-3">
              <p className="min-w-0 truncate font-medium text-gray-900">{fileName(open)}</p>
              <div className="flex shrink-0 items-center gap-2">
                <a href={attachmentUrl(open, true)} className={BUTTON}>
                  Download
                </a>
                <button
                  type="button"
                  onClick={() => setOpen(null)}
                  aria-label="Close attachment"
                  className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-2 focus-visible:outline-navy"
                >
                  <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5 fill-none stroke-current stroke-2">
                    <path d="M5 5l10 10M15 5L5 15" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1">
              {(kind === "pdf" || kind === "text") && (
                <iframe title={fileName(open)} src={attachmentUrl(open)} className="h-full w-full bg-white" />
              )}
              {kind === "docx" && <DocxViewer url={attachmentUrl(open)} />}
              {kind === "other" && (
                <p className="p-6 text-sm text-gray-700">
                  There is no preview for this file type. Use Download to open it.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
