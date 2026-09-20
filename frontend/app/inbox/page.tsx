"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Category =
  | "BL_COMPARISON"
  | "SI_REQUEST"
  | "INVOICE_QUERY"
  | "GENERAL"
  | "SPAM";
type Priority = "Low" | "Medium" | "High";

type Email = {
  email_id: string;
  from_addr: string | null;
  subject: string | null;
  body: string | null;
  category: Category | null;
  priority: Priority | null;
  ai_summary: string | null;
  status: "PENDING" | "CLASSIFIED" | string;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const PAGE_SIZE = 20;

const badgeClass = (value: string | null) => {
  const styles: Record<string, string> = {
    BL_COMPARISON: "bg-indigo-500/15 text-indigo-300 border-indigo-400/30",
    SI_REQUEST: "bg-cyan-500/15 text-cyan-300 border-cyan-400/30",
    INVOICE_QUERY: "bg-amber-500/15 text-amber-300 border-amber-400/30",
    GENERAL: "bg-slate-500/15 text-slate-300 border-slate-400/30",
    SPAM: "bg-rose-500/15 text-rose-300 border-rose-400/30",
    High: "bg-rose-500/15 text-rose-300 border-rose-400/30",
    Medium: "bg-amber-500/15 text-amber-300 border-amber-400/30",
    Low: "bg-sky-500/15 text-sky-300 border-sky-400/30",
  };
  return styles[value ?? ""] ?? "bg-slate-800 text-slate-400 border-slate-700";
};

export default function InboxPage() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [selected, setSelected] = useState<Email | null>(null);
  const [offset, setOffset] = useState(0);
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [analysingId, setAnalysingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  const fetchEmails = useCallback(
    async (nextOffset: number, append: boolean) => {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(nextOffset),
      });
      if (category) params.set("category", category);
      if (priority) params.set("priority", priority);

      const response = await fetch(`${API_URL}/emails?${params}`);
      if (!response.ok) throw new Error("Could not load inbox emails.");
      const data: Email[] = await response.json();
      setEmails((current) => (append ? [...current, ...data] : data));
      setHasMore(data.length === PAGE_SIZE);
    },
    [category, priority],
  );

  useEffect(() => {
    async function loadFirstPage() {
      setLoading(true);
      setError(null);
      setOffset(0);
      try {
        await fetchEmails(0, false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load inbox emails.");
      } finally {
        setLoading(false);
      }
    }

    void loadFirstPage();
  }, [fetchEmails]);

  async function openEmail(email: Email) {
    setSelected(email);
    setError(null);

    if (email.status === "CLASSIFIED") return;

    setAnalysingId(email.email_id);
    try {
      const response = await fetch(`${API_URL}/classify/${email.email_id}`, {
        method: "POST",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail ?? "Could not analyse this email.");

      const updated: Email = {
        ...email,
        category: result.category,
        priority: result.priority,
        ai_summary: result.summary,
        status: "CLASSIFIED",
      };
      setEmails((current) => current.map((item) => item.email_id === email.email_id ? updated : item));
      setSelected(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not analyse this email.");
    } finally {
      setAnalysingId(null);
    }
  }

  async function loadMore() {
    const nextOffset = offset + PAGE_SIZE;
    setLoadingMore(true);
    setError(null);
    try {
      await fetchEmails(nextOffset, true);
      setOffset(nextOffset);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load more emails.");
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <section className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-sm font-medium text-indigo-300">AI shipping operations</p>
            <h1 className="text-3xl font-bold tracking-tight">Inbox triage</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              Emails are analysed only when opened. This keeps AI usage focused on cases a user needs to review.
            </p>
          </div>
          <Link className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800" href="/">
            Review queue
          </Link>
        </div>

        <div className="mb-5 flex flex-wrap gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <label className="text-sm text-slate-300">
            Category
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="ml-2 rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5">
              <option value="">All</option>
              <option value="BL_COMPARISON">BL comparison</option>
              <option value="SI_REQUEST">SI request</option>
              <option value="INVOICE_QUERY">Invoice query</option>
              <option value="GENERAL">General</option>
              <option value="SPAM">Spam</option>
            </select>
          </label>
          <label className="text-sm text-slate-300">
            Priority
            <select value={priority} onChange={(e) => setPriority(e.target.value)} className="ml-2 rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5">
              <option value="">All</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </label>
        </div>

        {error && <p className="mb-4 rounded-lg border border-rose-700/60 bg-rose-950/40 p-3 text-sm text-rose-200">{error}</p>}

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.9fr)]">
          <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
            {loading ? (
              <p className="p-8 text-sm text-slate-400">Loading inbox…</p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-slate-800 bg-slate-900 text-xs uppercase text-slate-400">
                      <tr><th className="px-4 py-3">Email</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">Priority</th><th className="px-4 py-3">State</th></tr>
                    </thead>
                    <tbody>
                      {emails.map((email) => (
                        <tr key={email.email_id} onClick={() => openEmail(email)} className="cursor-pointer border-b border-slate-800/70 hover:bg-slate-800/60">
                          <td className="max-w-md px-4 py-3"><p className="truncate font-medium text-slate-100">{email.subject || "(No subject)"}</p><p className="truncate text-xs text-slate-400">{email.from_addr}</p></td>
                          <td className="px-4 py-3">{email.category ? <span className={`rounded-full border px-2 py-1 text-xs ${badgeClass(email.category)}`}>{email.category}</span> : <span className="text-xs text-slate-500">Not analysed</span>}</td>
                          <td className="px-4 py-3">{email.priority ? <span className={`rounded-full border px-2 py-1 text-xs ${badgeClass(email.priority)}`}>{email.priority}</span> : "—"}</td>
                          <td className="px-4 py-3 text-xs text-slate-400">{analysingId === email.email_id ? "Analysing…" : email.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {emails.length === 0 && <p className="p-8 text-sm text-slate-400">No emails match these filters.</p>}
                {hasMore && <div className="p-4 text-center"><button disabled={loadingMore} onClick={loadMore} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50">{loadingMore ? "Loading…" : "Load more"}</button></div>}
              </>
            )}
          </div>

          <aside className="min-h-64 rounded-xl border border-slate-800 bg-slate-900/60 p-5">
            {selected ? (
              <div className="space-y-4">
                <div><p className="text-xs uppercase tracking-wide text-slate-500">{selected.email_id}</p><h2 className="mt-1 font-semibold">{selected.subject}</h2><p className="mt-1 text-sm text-slate-400">{selected.from_addr}</p></div>
                {analysingId === selected.email_id ? <p className="text-sm text-indigo-300">Analysing this email with AI…</p> : selected.ai_summary ? <div className="rounded-lg border border-indigo-500/25 bg-indigo-500/10 p-3"><p className="text-xs font-medium uppercase text-indigo-300">AI summary</p><p className="mt-1 text-sm text-indigo-100">{selected.ai_summary}</p></div> : <p className="text-sm text-slate-400">Open this pending email to analyse it.</p>}
                <div><p className="mb-1 text-xs font-medium uppercase text-slate-500">Original email</p><p className="max-h-72 overflow-y-auto whitespace-pre-wrap text-sm leading-6 text-slate-300">{selected.body}</p></div>
              </div>
            ) : <p className="text-sm text-slate-400">Select an email to view it. Pending emails are classified on demand.</p>}
          </aside>
        </div>
      </section>
    </main>
  );
}
