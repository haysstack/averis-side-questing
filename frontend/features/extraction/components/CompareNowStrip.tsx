"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function CompareNowStrip({ emailId }: { emailId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runCompare() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/compare/${encodeURIComponent(emailId)}`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? `Compare failed (${res.status}).`);
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 bg-gray-50 px-6 py-2.5">
      <p className="text-sm text-gray-600">{error ?? "Not compared yet."}</p>
      <button
        onClick={runCompare}
        disabled={loading}
        className="shrink-0 rounded-md bg-navy px-3 py-1.5 text-xs font-semibold text-white hover:bg-steel disabled:opacity-50"
      >
        {loading ? "Comparing…" : "Compare"}
      </button>
    </div>
  );
}