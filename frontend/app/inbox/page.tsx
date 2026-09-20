"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Email = {
  email_id: string; from_addr: string | null; subject: string | null;
  body: string | null; category: string | null; priority: string | null;
  ai_summary: string | null; status: string; attachments?: string[];
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const DOCKER_URL = process.env.NEXT_PUBLIC_DOCKER_INBOX_URL ?? "http://localhost:8080";
const PAGE_SIZE = 20;

function badgeClass(value: string | null) {
  const styles: Record<string, string> = {
    BL_COMPARISON: "border-[#6F8AB7] bg-[#EAF0F8] text-[#485C8B]",
    SI_REQUEST: "border-violet-200 bg-violet-50 text-violet-700",
    INVOICE_QUERY: "border-amber-200 bg-amber-50 text-amber-700",
    GENERAL: "border-slate-200 bg-slate-50 text-slate-700",
    SPAM: "border-rose-200 bg-rose-50 text-rose-700",
    High: "border-red-400 bg-red-100 text-red-800",
    Medium: "border-orange-300 bg-orange-100 text-orange-800",
    Low: "border-emerald-300 bg-emerald-100 text-emerald-800",
  };
  return styles[value ?? ""] ?? "border-[#B9C8DF] bg-[#F4F7FB] text-[#485C8B]";
}

function attachmentUrl(path: string) { return `${DOCKER_URL}/${path}`; }
function canPreview(path: string) { return /\.(pdf|txt)$/i.test(path); }

export default function InboxPage() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [selected, setSelected] = useState<Email | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState("");
  const [search, setSearch] = useState("");
  const [searchField, setSearchField] = useState("all");
  const [attachmentsOnly, setAttachmentsOnly] = useState(false);
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [analysingId, setAnalysingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  const fetchEmails = useCallback(async (nextOffset: number, append: boolean) => {
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(nextOffset) });
    if (category) params.set("category", category);
    if (priority) params.set("priority", priority);
    if (submittedSearch) {
      params.set("search", submittedSearch);
      params.set("search_field", searchField);
    }
    if (attachmentsOnly) params.set("attachments_only", "true");

    const response = await fetch(`${API_URL}/emails?${params}`);
    if (!response.ok) throw new Error("Could not load inbox emails.");
    const data: Email[] = await response.json();
    setEmails((current) => append ? [...current, ...data] : data);
    setHasMore(data.length === PAGE_SIZE);
  }, [attachmentsOnly, category, priority, searchField, submittedSearch]);

  useEffect(() => {
    async function load() {
      setLoading(true); setError(null); setOffset(0);
      try { await fetchEmails(0, false); }
      catch (err) { setError(err instanceof Error ? err.message : "Could not load inbox emails."); }
      finally { setLoading(false); }
    }
    void load();
  }, [fetchEmails]);

  async function openEmail(row: Email) {
    setError(null); setPreview(null);
    try {
      const response = await fetch(`${API_URL}/emails/${row.email_id}`);
      const detail = await response.json();
      if (!response.ok) throw new Error(detail.detail ?? "Could not load this email.");
      setSelected(detail); row = detail;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load this email."); return;
    }
    if (row.status === "CLASSIFIED") return;

    setAnalysingId(row.email_id);
    try {
      const response = await fetch(`${API_URL}/classify/${row.email_id}`, { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail ?? "Could not analyse this email.");
      const updated = { ...row, category: result.category, priority: result.priority, ai_summary: result.summary, status: "CLASSIFIED" };
      setEmails((current) => current.map((item) => item.email_id === row.email_id ? updated : item));
      setSelected(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not analyse this email.");
    } finally { setAnalysingId(null); }
  }

  async function loadMore() {
    const nextOffset = offset + PAGE_SIZE;
    setLoadingMore(true); setError(null);
    try { await fetchEmails(nextOffset, true); setOffset(nextOffset); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not load more emails."); }
    finally { setLoadingMore(false); }
  }

  function closeModal() { setSelected(null); setPreview(null); }
  function clearSearch() { setSearch(""); setSubmittedSearch(""); }

  return <main className="min-h-screen bg-[#FFF9F0] text-[#485C8B]">
    <section className="mx-auto max-w-7xl px-6 py-10">
      <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-sm font-semibold text-[#6F8AB7]">Shipping operations</p>
          <h1 className="text-3xl font-bold tracking-tight">Email Inbox</h1>
          <p className="mt-2 text-sm text-[#6F8AB7]">Open a pending email to classify it with AI.</p>
        </div>
        <Link className="cursor-pointer rounded-lg border border-[#6F8AB7] bg-white px-3 py-2 text-sm font-medium text-[#485C8B] shadow-sm hover:bg-[#EAF0F8]" href="/">Review queue</Link>
      </header>

      <form onSubmit={(event) => { event.preventDefault(); setSubmittedSearch(search.trim()); }} className="mb-4 flex flex-col gap-3 rounded-xl border border-[#FDD58D] bg-white p-4 shadow-sm md:flex-row md:items-center">
        <div className="relative min-w-0 flex-1">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search anything: ID, sender, subject, content…" className="w-full rounded-lg border border-[#B9C8DF] py-2 pl-3 pr-9 text-sm outline-none focus:border-[#6F8AB7] focus:ring-2 focus:ring-[#EAF0F8]" />
          {search && <button type="button" onClick={clearSearch} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded p-1 text-lg leading-none text-slate-400 hover:bg-[#FFF4DF] hover:text-[#485C8B]">×</button>}
        </div>
        <label className="flex items-center gap-2 text-sm text-[#485C8B]">Search in
          <select value={searchField} onChange={(event) => setSearchField(event.target.value)} className="cursor-pointer rounded-lg border border-[#B9C8DF] bg-white px-2 py-2 text-sm text-[#485C8B]">
            <option value="all">All fields</option><option value="id">Email ID</option><option value="sender">Sender</option><option value="subject">Subject</option><option value="content">Email content</option><option value="category">Category</option><option value="priority">Priority</option><option value="summary">AI summary</option>
          </select>
        </label>
        <button className="cursor-pointer rounded-lg bg-[#485C8B] px-4 py-2 text-sm font-medium text-white hover:bg-[#6F8AB7]">Search</button>
      </form>

      <div className="mb-4 flex flex-wrap items-center justify-end gap-3 text-sm">
        <span className="mr-1 font-semibold uppercase tracking-wide text-[#6F8AB7]">Filters</span>
        <label className="text-[#485C8B]">Category <select value={category} onChange={(event) => setCategory(event.target.value)} className="ml-1 cursor-pointer rounded-md border border-[#B9C8DF] bg-white px-2 py-1.5"><option value="">All</option><option value="BL_COMPARISON">BL comparison</option><option value="SI_REQUEST">SI request</option><option value="INVOICE_QUERY">Invoice query</option><option value="GENERAL">General</option><option value="SPAM">Spam</option></select></label>
        <label className="text-[#485C8B]">Priority <select value={priority} onChange={(event) => setPriority(event.target.value)} className="ml-1 cursor-pointer rounded-md border border-[#B9C8DF] bg-white px-2 py-1.5"><option value="">All</option><option value="High">High</option><option value="Medium">Medium</option><option value="Low">Low</option></select></label>
        <label className="flex cursor-pointer items-center gap-2 rounded-md border border-[#B9C8DF] bg-white px-2 py-1.5 text-[#485C8B]"><input checked={attachmentsOnly} onChange={(event) => setAttachmentsOnly(event.target.checked)} type="checkbox" className="cursor-pointer accent-[#485C8B]" />Has attachments</label>
      </div>

      {error && <p className="mb-4 rounded-lg border border-[#F6983E] bg-[#FFF0D6] p-3 text-sm text-[#A95E17]">{error}</p>}
      <div className="overflow-hidden rounded-xl border border-[#FDD58D] bg-white shadow-sm">
        {loading ? <p className="p-8 text-sm text-[#6F8AB7]">Loading inbox…</p> : <>
          <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-[#FDD58D] bg-[#FFF4DF] text-xs uppercase text-[#6F8AB7]"><tr><th className="px-4 py-3">Email</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">Priority</th><th className="px-4 py-3">Analysis</th></tr></thead><tbody>{emails.map((email) => <tr key={email.email_id} onClick={() => openEmail(email)} className="cursor-pointer border-b border-[#FFF4DF] hover:bg-[#EAF0F8]"><td className="max-w-md px-4 py-3"><p className="truncate font-medium">{email.subject || "(No subject)"}</p><p className="truncate text-xs text-[#6F8AB7]">{email.from_addr}</p></td><td className="px-4 py-3">{email.category ? <span className={`rounded-full border px-2 py-1 text-xs ${badgeClass(email.category)}`}>{email.category}</span> : <span className="text-xs text-[#6F8AB7]">Not analysed</span>}</td><td className="px-4 py-3">{email.priority ? <span className={`rounded-full border px-2 py-1 text-xs ${badgeClass(email.priority)}`}>{email.priority}</span> : "—"}</td><td className="px-4 py-3 text-xs text-[#6F8AB7]">{analysingId === email.email_id ? "Analysing…" : email.status === "CLASSIFIED" ? "Analysed" : "Pending analysis"}</td></tr>)}</tbody></table></div>
          {emails.length === 0 && <p className="p-8 text-sm text-[#6F8AB7]">No emails match your filters.</p>}
          {hasMore && <div className="p-4 text-center"><button disabled={loadingMore} onClick={loadMore} className="cursor-pointer rounded-lg bg-[#485C8B] px-4 py-2 text-sm font-medium text-white hover:bg-[#6F8AB7] disabled:cursor-not-allowed disabled:opacity-50">{loadingMore ? "Loading…" : "Load more"}</button></div>}
        </>}
      </div>
    </section>

    {selected && <div onMouseDown={closeModal} className="fixed inset-0 z-50 flex items-center justify-center bg-[#485C8B]/45 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Email details">
      <div onMouseDown={(event) => event.stopPropagation()} className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-[#FDD58D] bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[#FDD58D] pb-4"><div><p className="text-xs uppercase tracking-wide text-[#6F8AB7]">{selected.email_id}</p><h2 className="mt-1 text-xl font-semibold">{selected.subject || "(No subject)"}</h2><p className="mt-1 text-sm text-[#6F8AB7]">{selected.from_addr}</p></div><button onClick={closeModal} className="cursor-pointer rounded-lg border border-[#B9C8DF] px-3 py-1.5 text-lg leading-none text-[#485C8B] hover:bg-[#FFF4DF]" aria-label="Close email details">×</button></div>
        <div className="mt-5 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-2">{selected.category && <span className={`rounded-full border px-2.5 py-1 text-xs ${badgeClass(selected.category)}`}>{selected.category}</span>}{selected.priority && <span className={`rounded-full border px-2.5 py-1 text-xs ${badgeClass(selected.priority)}`}>{selected.priority}</span>}<span className="rounded-full border border-[#B9C8DF] bg-[#F4F7FB] px-2.5 py-1 text-xs text-[#6F8AB7]">{selected.status === "CLASSIFIED" ? "Analysed" : "Pending analysis"}</span></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => window.alert("Reply is a demo action for now.")} className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#6F8AB7] bg-white px-3 py-2 text-sm font-medium text-[#485C8B] hover:bg-[#EAF0F8]"><span aria-hidden="true">↩</span>Reply</button><button type="button" onClick={() => window.alert("Forward is a demo action for now.")} className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#6F8AB7] bg-white px-3 py-2 text-sm font-medium text-[#485C8B] hover:bg-[#EAF0F8]"><span aria-hidden="true">↪</span>Forward</button></div></div>
          {analysingId === selected.email_id ? <p className="rounded-lg border border-[#6F8AB7] bg-[#EAF0F8] p-3 text-sm text-[#485C8B]">Analysing this email with AI…</p> : selected.ai_summary ? <div className="rounded-lg border border-[#6F8AB7] bg-[#EAF0F8] p-4"><p className="text-xs font-medium uppercase text-[#6F8AB7]">AI summary</p><p className="mt-1 text-sm text-[#485C8B]">{selected.ai_summary}</p></div> : <p className="rounded-lg border border-[#B9C8DF] bg-[#F4F7FB] p-3 text-sm text-[#6F8AB7]">This email has not been analysed yet.</p>}
          {preview && <div><div className="mb-2 flex items-center justify-between"><p className="text-xs font-medium uppercase tracking-wide text-[#6F8AB7]">Attachment preview: {preview.split("/").pop()}</p><button onClick={() => setPreview(null)} className="cursor-pointer text-sm text-[#485C8B] hover:underline">Close preview</button></div><iframe title={preview} src={attachmentUrl(preview)} className={`${/\.txt$/i.test(preview) ? "h-64" : "h-[32rem]"} w-full rounded-lg border border-[#B9C8DF] bg-white`} /></div>}
          {selected.category === "BL_COMPARISON" && <button disabled className="cursor-not-allowed rounded-lg bg-[#485C8B] px-4 py-2 text-sm font-medium text-white opacity-60" title="Document comparison will be connected when that pipeline is ready">Compare SI and BL</button>}
          {selected.category === "SI_REQUEST" && (
            <Link
              href={`/si-creation?email_id=${selected.email_id}`}
              className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[#485C8B] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#6F8AB7]"
            >
              Draft & Review Shipping Instruction →
            </Link>
          )}
          <div><p className="mb-2 text-xs font-medium uppercase tracking-wide text-[#6F8AB7]">Original email</p><p className="whitespace-pre-wrap rounded-lg border border-[#FDD58D] bg-[#FFF9F0] p-4 text-sm leading-6 text-[#485C8B]">{selected.body}</p></div>
        </div>
      </div>
    </div>}
  </main>;
}
