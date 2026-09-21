"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { ListQuery } from "../types";
import { buildHref } from "../utils";

interface PageJumpProps {
  basePath: string;
  page: number;
  totalPages: number;
  query: ListQuery;
}

/** "Page [12] of 26 [Go]". Remounted (via key) whenever the page changes. */
export default function PageJump({ basePath, page, totalPages, query }: PageJumpProps) {
  const router = useRouter();
  const [value, setValue] = useState(String(page));

  function go(event: FormEvent) {
    event.preventDefault();
    const target = Math.min(Math.max(Number.parseInt(value, 10) || page, 1), totalPages);
    setValue(String(target));
    if (target !== page) router.push(buildHref(basePath, { ...query, page: target, email: undefined }));
  }

  return (
    <form onSubmit={go} className="flex items-center gap-2 text-sm text-gray-500">
      <label htmlFor="page-jump">Page</label>
      <input
        id="page-jump"
        type="number"
        min={1}
        max={totalPages}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="w-16 rounded-md border border-gray-300 bg-white px-2 py-1 text-center text-gray-900 tabular-nums focus-visible:outline-2 focus-visible:outline-navy"
      />
      <span>of {totalPages}</span>
      <button
        type="submit"
        className="rounded-md border border-gray-300 bg-white px-2.5 py-1 font-medium text-navy transition-colors hover:bg-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
      >
        Go
      </button>
    </form>
  );
}
