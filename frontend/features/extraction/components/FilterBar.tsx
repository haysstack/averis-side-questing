"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { EmailPriority, ListQuery, SearchField } from "../types";
import { buildHref, SEARCH_FIELDS } from "../utils";

const INPUT =
  "rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-900 focus-visible:outline-2 focus-visible:outline-navy";

/** Search box plus the Priority and "Has attachments" filters. Everything lives in the URL. */
export default function FilterBar({ basePath, query }: { basePath: string; query: ListQuery }) {
  const router = useRouter();
  const [text, setText] = useState(query.q ?? "");
  const [field, setField] = useState<SearchField>(query.field);

  const go = (changes: Partial<ListQuery>) =>
    router.push(buildHref(basePath, { ...query, ...changes, page: 1, email: undefined }));

  function submit(event: FormEvent) {
    event.preventDefault();
    go({ q: text.trim() || undefined, field });
  }

  function clearSearch() {
    setText("");
    go({ q: undefined });
  }

  const active = Boolean(query.q);

  return (
    <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
      <form onSubmit={submit} role="search" className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative min-w-0 flex-1">
          <input
            type="text"
            value={text}
            onChange={(event) => setText(event.target.value)}
            aria-label="Search emails"
            placeholder="Search ID, sender, subject, content…"
            className={`${INPUT} w-full py-2 pr-9`}
          />
          {text && (
            <button
              type="button"
              onClick={clearSearch}
              aria-label="Clear search"
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-lg leading-none text-gray-500 hover:bg-gray-100 hover:text-gray-900"
            >
              ×
            </button>
          )}
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          Search in
          <select
            value={field}
            onChange={(event) => setField(event.target.value as SearchField)}
            className={INPUT}
          >
            {SEARCH_FIELDS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="rounded-md bg-navy px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-navy/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
        >
          Search
        </button>
      </form>

      {active && (
        <div className="mt-2.5 flex items-center text-sm">
          <button
            type="button"
            onClick={clearSearch}
            className="text-navy underline hover:no-underline"
          >
            Clear search
          </button>
        </div>
      )}
    </div>
  );
}
