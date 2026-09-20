"use client";

import { useEffect, useState } from "react";

interface ReviewItem {
  email_id: string;
  subject?: string;
  category?: string;
  review_reason: string;
  confidence?: number | null;
  status: string;
  resolved?: boolean;
}

const REASON_COLORS: Record<string, { bg: string; text: string; border: string; icon: string; label: string }> = {
  wrong_doc_type: {
    bg: "bg-purple-950/50",
    text: "text-purple-300",
    border: "border-purple-800/50",
    icon: "📄",
    label: "Wrong Doc Type",
  },
  missing_attachment: {
    bg: "bg-amber-950/50",
    text: "text-amber-300",
    border: "border-amber-800/50",
    icon: "⚠️",
    label: "Missing Attachment",
  },
  unreadable: {
    bg: "bg-rose-950/50",
    text: "text-rose-300",
    border: "border-rose-800/50",
    icon: "🚫",
    label: "Unreadable File",
  },
  missing_value: {
    bg: "bg-cyan-950/50",
    text: "text-cyan-300",
    border: "border-cyan-800/50",
    icon: "❓",
    label: "Missing Field Value",
  },
};

const CATEGORIES = ["ALL", "BL_COMPARISON", "SI_REQUEST", "INVOICE_QUERY", "GENERAL", "SPAM"];
const REASONS = ["ALL", "wrong_doc_type", "missing_attachment", "unreadable", "missing_value"];

export default function ReviewQueuePage() {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [reasonFilter, setReasonFilter] = useState("ALL");
  const [selectedItem, setSelectedItem] = useState<ReviewItem | null>(null);
  const [resolving, setResolving] = useState(false);

  const fetchQueue = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("http://localhost:8000/review-queue");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setItems(data.items || []);
    } catch (err: any) {
      console.warn("Backend unavailable, loading mock queue data:", err);
      setError("Backend unreachable (using local preview dataset)");
      // Mock fallback data for preview & development
      setItems([
        {
          email_id: "email_014",
          subject: "Draft B/L for Booking #BK-9921",
          category: "BL_COMPARISON",
          review_reason: "wrong_doc_type",
          confidence: 0.92,
          status: "NEEDS_REVIEW",
          resolved: false,
        },
        {
          email_id: "email_027",
          subject: "Shipping Instruction - MV OCEAN HORIZON",
          category: "BL_COMPARISON",
          review_reason: "missing_attachment",
          confidence: 1.0,
          status: "NEEDS_REVIEW",
          resolved: false,
        },
        {
          email_id: "email_055",
          subject: "Scanned BL copy for validation",
          category: "BL_COMPARISON",
          review_reason: "unreadable",
          confidence: 0.88,
          status: "NEEDS_REVIEW",
          resolved: false,
        },
        {
          email_id: "email_102",
          subject: "SI Details for Container CNTR-7712",
          category: "BL_COMPARISON",
          review_reason: "missing_value",
          confidence: 0.95,
          status: "NEEDS_REVIEW",
          resolved: false,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, []);

  const handleResolve = async (emailId: string) => {
    setResolving(true);
    try {
      const res = await fetch(`http://localhost:8000/review/${emailId}/resolve`, {
        method: "POST",
      });
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.email_id !== emailId));
        setSelectedItem(null);
      }
    } catch (err) {
      // Optimistic update if backend offline
      setItems((prev) => prev.filter((i) => i.email_id !== emailId));
      setSelectedItem(null);
    } finally {
      setResolving(false);
    }
  };

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      (item.email_id || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.subject || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === "ALL" || item.category === categoryFilter;
    const matchesReason = reasonFilter === "ALL" || item.review_reason === reasonFilter;
    return matchesSearch && matchesCategory && matchesReason;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Navigation Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/30">
              SD
            </div>
            <div>
              <h1 className="font-semibold text-slate-100 text-sm leading-none">Shipping Doc Verification</h1>
              <span className="text-xs text-slate-400">Person D — Reliability & Review Queue</span>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Backend API: :8000
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
              <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
              Data Server: :8080
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto w-full px-6 py-8 flex-1 flex flex-col gap-6">
        {/* Banner Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 p-6 rounded-2xl border border-slate-800/80 shadow-xl">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-medium mb-2">
              Human In The Loop
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Review Queue</h2>
            <p className="text-sm text-slate-400 mt-1 max-w-2xl">
              Inspect edge cases flagged by the automated pipeline before final submission.
            </p>
          </div>
          <button
            onClick={fetchQueue}
            className="self-start md:self-auto px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-sm font-medium transition-all flex items-center gap-2"
          >
            <span>🔄</span> Refresh Queue
          </button>
        </div>

        {/* Status Notification if offline */}
        {error && (
          <div className="px-4 py-3 rounded-xl bg-amber-950/40 border border-amber-800/50 text-amber-300 text-xs flex items-center justify-between">
            <span>⚠️ {error}</span>
            <span className="text-amber-400/70">Using static preview dataset</span>
          </div>
        )}

        {/* Filters & Search Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-900/50 p-4 rounded-xl border border-slate-800">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Search Subject / ID</label>
            <input
              type="text"
              placeholder="Search email_id or subject..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3.5 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Category</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-3.5 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Review Reason</label>
            <select
              value={reasonFilter}
              onChange={(e) => setReasonFilter(e.target.value)}
              className="w-full px-3.5 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors"
            >
              {REASONS.map((r) => (
                <option key={r} value={r}>
                  {r === "ALL" ? "ALL REASONS" : REASON_COLORS[r]?.label || r}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Queue Table */}
        <div className="bg-slate-900/60 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
          {loading ? (
            <div className="p-12 text-center text-slate-400 text-sm flex items-center justify-center gap-3">
              <span className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></span>
              Loading review queue...
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="p-16 text-center">
              <div className="text-3xl mb-2">🎉</div>
              <h3 className="text-slate-200 font-semibold text-base">Review Queue Clear</h3>
              <p className="text-slate-400 text-xs mt-1">No items match your filter criteria.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/90 text-slate-400 text-xs uppercase tracking-wider font-semibold">
                    <th className="px-6 py-3.5">Email ID</th>
                    <th className="px-6 py-3.5">Subject</th>
                    <th className="px-6 py-3.5">Category</th>
                    <th className="px-6 py-3.5">Review Reason</th>
                    <th className="px-6 py-3.5">Confidence</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-sm">
                  {filteredItems.map((item) => {
                    const rMeta = REASON_COLORS[item.review_reason] || {
                      bg: "bg-slate-800",
                      text: "text-slate-300",
                      border: "border-slate-700",
                      icon: "⚠️",
                      label: item.review_reason,
                    };
                    return (
                      <tr
                        key={item.email_id}
                        onClick={() => setSelectedItem(item)}
                        className="hover:bg-indigo-950/20 cursor-pointer transition-colors group"
                      >
                        <td className="px-6 py-4 font-mono text-xs font-semibold text-indigo-400">
                          {item.email_id}
                        </td>
                        <td className="px-6 py-4 text-slate-200 font-medium group-hover:text-white transition-colors max-w-xs truncate">
                          {item.subject || "(No Subject)"}
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 text-slate-300 text-xs font-medium">
                            {item.category || "UNCLASSIFIED"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${rMeta.bg} ${rMeta.text} ${rMeta.border}`}
                          >
                            <span>{rMeta.icon}</span>
                            <span>{rMeta.label}</span>
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs font-mono text-slate-400">
                          {item.confidence !== null && item.confidence !== undefined
                            ? `${(item.confidence * 100).toFixed(0)}%`
                            : "—"}
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                            {item.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedItem(item);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600 border border-indigo-500/30 hover:border-indigo-500 text-indigo-300 hover:text-white text-xs font-medium transition-all"
                          >
                            Review & Resolve
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Review Detail Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl flex flex-col gap-5">
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div>
                <span className="font-mono text-xs font-semibold text-indigo-400">
                  {selectedItem.email_id}
                </span>
                <h3 className="text-lg font-bold text-white mt-1">
                  {selectedItem.subject || "Email Review Detail"}
                </h3>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="text-slate-400 hover:text-white text-xl p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4 bg-slate-950 p-4 rounded-xl border border-slate-800">
                <div>
                  <span className="text-slate-500 block mb-1">Category</span>
                  <span className="font-medium text-slate-200">{selectedItem.category}</span>
                </div>
                <div>
                  <span className="text-slate-500 block mb-1">Confidence Score</span>
                  <span className="font-medium text-slate-200">
                    {selectedItem.confidence ? `${(selectedItem.confidence * 100).toFixed(0)}%` : "N/A"}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-slate-400 font-semibold block mb-1">Flagged Reason:</span>
                <div
                  className={`p-3 rounded-xl border flex items-center gap-3 ${
                    REASON_COLORS[selectedItem.review_reason]?.bg || "bg-slate-800"
                  } ${REASON_COLORS[selectedItem.review_reason]?.border || "border-slate-700"}`}
                >
                  <span className="text-2xl">
                    {REASON_COLORS[selectedItem.review_reason]?.icon || "⚠️"}
                  </span>
                  <div>
                    <span
                      className={`font-semibold text-sm block ${
                        REASON_COLORS[selectedItem.review_reason]?.text || "text-slate-200"
                      }`}
                    >
                      {REASON_COLORS[selectedItem.review_reason]?.label || selectedItem.review_reason}
                    </span>
                    <p className="text-slate-400 text-xs mt-0.5">
                      This email requires manual verification prior to final score submission.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                onClick={() => setSelectedItem(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={resolving}
                onClick={() => handleResolve(selectedItem.email_id)}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all flex items-center gap-2 shadow-lg shadow-indigo-600/30"
              >
                {resolving && (
                  <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                )}
                <span>Mark Resolved</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
