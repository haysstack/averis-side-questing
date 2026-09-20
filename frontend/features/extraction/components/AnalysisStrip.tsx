"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { requestAnalysis } from "../api/analyseClient";

interface AnalysisStripProps {
  emailId: string;
  /** Shown until the person runs the analysis. */
  message: string;
  buttonLabel: string;
}

interface Outcome {
  ok: boolean;
  text: string;
}

export default function AnalysisStrip({ emailId, message, buttonLabel }: AnalysisStripProps) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [isRefreshing, startTransition] = useTransition();
  const busy = running || isRefreshing;

  async function handleClick() {
    setRunning(true);
    setOutcome(null);
    const result = await requestAnalysis(emailId);
    const succeeded = result.ok && result.extraction !== "skipped";
    setOutcome({ ok: succeeded, text: result.message });
    setRunning(false);
    startTransition(() => {
      router.refresh();
    });
  }

  const failed = outcome !== null && !outcome.ok;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 bg-gray-50 px-6 py-2.5">
      <p aria-live="polite" className={`text-sm ${failed ? "font-medium text-gray-900" : "text-gray-600"}`}>
        {outcome?.text ?? message}
      </p>
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className="rounded-md border border-navy bg-white px-3 py-1.5 text-sm font-medium text-navy transition-colors hover:bg-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? "Analysing…" : failed ? "Retry" : buttonLabel}
      </button>
    </div>
  );
}
