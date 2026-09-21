"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { requestAnalysis } from "../api/analyseClient";

const AUTO_KEY = "extraction:auto-analyse";
/** Whether new pages are analysed automatically until the person switches it off. */
const DEFAULT_AUTO = true;
/** Emails analysed at the same time. Keep low: each one can call Gemini. */
const CONCURRENCY = 2;
/** Rows update on screen at most this often while a batch runs (ms). */
const REFRESH_MS = 1500;

interface Progress {
  done: number;
  total: number;
}

interface Failure {
  emailId: string;
  message: string;
}

interface AnalysePageControlsProps {
  /** Emails on this page that still need analysis. */
  pendingIds: string[];
  /** All emails on this page. */
  pageCount: number;
}

export default function AnalysePageControls({ pendingIds, pageCount }: AnalysePageControlsProps) {
  const router = useRouter();
  const [auto, setAuto] = useState<boolean | null>(null); // null until localStorage is read
  const [progress, setProgress] = useState<Progress | null>(null);
  const [failures, setFailures] = useState<Failure[]>([]);
  const attempted = useRef<Set<string>>(new Set());
  const running = useRef(false);
  const lastRefresh = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const idsKey = pendingIds.join(",");
  const ids = useMemo(() => (idsKey ? idsKey.split(",") : []), [idsKey]);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(AUTO_KEY);
    } catch {
      // storage unavailable: use the default
    }
    setAuto(stored === null ? DEFAULT_AUTO : stored === "true");
  }, []);

  const run = useCallback(
    async (toAnalyse: string[]) => {
      if (running.current || toAnalyse.length === 0) return;
      running.current = true;
      toAnalyse.forEach((id) => attempted.current.add(id));
      setFailures([]);
      setProgress({ done: 0, total: toAnalyse.length });

      // Refresh the list as emails finish, without hammering the server.
      const refreshSoon = () => {
        const wait = REFRESH_MS - (Date.now() - lastRefresh.current);
        if (wait <= 0) {
          lastRefresh.current = Date.now();
          router.refresh();
        } else if (!timer.current) {
          timer.current = setTimeout(() => {
            timer.current = null;
            lastRefresh.current = Date.now();
            router.refresh();
          }, wait);
        }
      };

      const queue = [...toAnalyse];
      const failed: Failure[] = [];
      let done = 0;

      async function worker() {
        while (queue.length > 0) {
          const emailId = queue.shift();
          if (!emailId) return;
          // Classify first so the label shows up right away, then extract if needed.
          let result = await requestAnalysis(emailId, "classify");
          refreshSoon();
          if (result.ok && result.extraction === "pending") {
            result = await requestAnalysis(emailId, "extract");
            refreshSoon();
          }
          if (!result.ok || result.extraction === "skipped") {
            failed.push({ emailId, message: result.message });
          }
          done += 1;
          setProgress({ done, total: toAnalyse.length });
        }
      }

      await Promise.all(
        Array.from({ length: Math.min(CONCURRENCY, toAnalyse.length) }, () => worker()),
      );

      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
      running.current = false;
      setFailures(failed);
      setProgress(null);
      router.refresh();
    },
    [router],
  );

  // Analyse each newly loaded page once. Emails already tried are not retried here,
  // so a failure cannot cause a loop. Use the buttons to retry.
  useEffect(() => {
    if (auto !== true || progress !== null) return;
    const fresh = ids.filter((id) => !attempted.current.has(id));
    if (fresh.length > 0) void run(fresh);
  }, [auto, ids, progress, run]);

  function handleToggle(next: boolean) {
    setAuto(next);
    try {
      window.localStorage.setItem(AUTO_KEY, String(next));
    } catch {
      // storage unavailable: the choice lasts until reload
    }
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-3 rounded-lg border border-gray-200 bg-white px-4 py-3">
      <div aria-live="polite" className="min-w-0 flex-1 text-sm">
        {progress ? (
          <p className="font-medium text-navy">
            Analysing {progress.done} of {progress.total}…
          </p>
        ) : ids.length > 0 ? (
          <p className="text-gray-700">
            {ids.length} of {pageCount} emails on this page still need analysis.
          </p>
        ) : (
          <p className="text-gray-700">All {pageCount} emails on this page are analysed.</p>
        )}
        {!progress && failures.length > 0 && (
          <p className="mt-0.5 text-gray-900">
            {failures.length} could not be completed. {failures[0].message}
          </p>
        )}
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={auto === true}
          disabled={auto === null}
          onChange={(event) => handleToggle(event.target.checked)}
          className="size-4 accent-navy"
        />
        Analyse new pages automatically
      </label>

      <button
        type="button"
        onClick={() => void run(ids)}
        disabled={progress !== null || ids.length === 0}
        className="rounded-md bg-navy px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-navy/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy disabled:cursor-not-allowed disabled:opacity-50"
      >
        Analyse all on this page
      </button>
    </div>
  );
}
