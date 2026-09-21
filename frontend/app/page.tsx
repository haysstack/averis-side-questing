"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { routes } from "@/lib/routes";
import { CATEGORY_META } from "@/features/extraction/config/categories";
import type { EmailCategory } from "@/features/extraction/types";

interface CategoryDirectoryItem {
  category: EmailCategory;
  slug: string;
  description: string;
}

const CATEGORY_ITEMS: CategoryDirectoryItem[] = [
  {
    category: "BL_COMPARISON",
    slug: "si-bl-comparisons",
    description: "Verify draft BLs against Shipping Instructions.",
  },
  {
    category: "SI_REQUEST",
    slug: "si-requests",
    description: "Customer booking instructions and SI drafting.",
  },
  {
    category: "INVOICE_QUERY",
    slug: "invoice-queries",
    description: "Billing, freight charges, and invoice queries.",
  },
  {
    category: "GENERAL",
    slug: "general",
    description: "Carrier updates, vessel schedules, and notices.",
  },
  {
    category: "SPAM",
    slug: "spam",
    description: "Filtered unsolicited and non-operational mail.",
  },
];

function count(map: Record<string, number> | undefined, key: string): number {
  return map?.[key] ?? 0;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const FIELD_LABEL_TO_CANONICAL: Record<string, string> = {
  "Shipper": "shipper",
  "Consignee": "consignee",
  "Notify Party": "notify_party",
  "Port of Loading": "port_of_loading",
  "Port of Discharge": "port_of_discharge",
  "Container Count": "container_count",
  "Gross Weight": "gross_weight_kg",
  "Gross Weight (kg)": "gross_weight_kg",
};

interface PipelineStats {
  total: number;
  needs_review: number;
  by_status: Record<string, number>;
  by_category: Record<string, number>;
  by_priority: Record<string, number>;
}

interface ShipmentField {
  field_name: string;
  si_value: string;
  bl_value: string;
  is_mismatch: boolean;
  is_missing: boolean;
  explanation?: string;
}

interface ReviewEvidence {
  doc_si_name: string;
  doc_bl_name: string;
  evidence_summary: string;
  fields: ShipmentField[];
}

interface FieldCorrection {
  field_name: string;
  si_value: string;
  original_bl_value: string;
  corrected_bl_value: string;
}

interface ReviewItem {
  email_id: string;
  subject: string;
  category: string;
  priority: "High" | "Medium" | "Low";
  review_reason: "wrong_doc_type" | "missing_attachment" | "unreadable" | "missing_value";
  confidence: number;
  status: "NEEDS_REVIEW" | "RESOLVED";
  resolved: boolean;
  resolvedAt?: string;
  resolutionOutcome?: string;
  resolutionNotes?: string;
  evidence: ReviewEvidence;
  correctionsHistory?: FieldCorrection[];
}

const REASON_COLORS: Record<string, { bg: string; text: string; border: string; label: string }> = {
  wrong_doc_type: {
    bg: "bg-[#FFE7B7]/40",
    text: "text-[#F6983E]",
    border: "border-[#FDD58D]",
    label: "Wrong Doc Type",
  },
  missing_attachment: {
    bg: "bg-[#FFE7B7]/40",
    text: "text-[#F6983E]",
    border: "border-[#FDD58D]",
    label: "Missing Attachment",
  },
  unreadable: {
    bg: "bg-[#FFE7B7]/40",
    text: "text-[#F6983E]",
    border: "border-[#FDD58D]",
    label: "Unreadable File",
  },
  missing_value: {
    bg: "bg-[#FFE7B7]/30",
    text: "text-[#F6983E]",
    border: "border-[#FDD58D]",
    label: "Missing Field Value",
  },
};

const PRIORITY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  High: { bg: "bg-[#FFE7B7]/50", text: "text-[#F6983E]", border: "border-[#FDD58D]" },
  Medium: { bg: "bg-slate-50", text: "text-[#6F8AB7]", border: "border-slate-200" },
  Low: { bg: "bg-slate-50", text: "text-slate-600", border: "border-slate-200" },
};

const CATEGORIES = ["ALL", "BL_COMPARISON", "SI_REQUEST", "INVOICE_QUERY", "GENERAL", "SPAM"];
const REASONS = ["ALL", "wrong_doc_type", "missing_attachment", "unreadable", "missing_value"];

export default function ReviewQueuePage() {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [stats, setStats] = useState<PipelineStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"active" | "resolved">("active");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [reasonFilter, setReasonFilter] = useState("ALL");
  const [selectedItem, setSelectedItem] = useState<ReviewItem | null>(null);

  // Resolution Action state (adapted per reason)
  const [actionChoice, setActionChoice] = useState<string>("");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Correction Form Inputs for missing_value / unreadable human verified entries
  const [correctionsInput, setCorrectionsInput] = useState<Record<string, string>>({});

  const fetchData = async () => {
    try {
      setLoading(true);
      setFetchError(null);
      const [queueRes, statsRes] = await Promise.all([
        fetch(`${API_URL}/review-queue`),
        fetch(`${API_URL}/classification/stats`),
      ]);
      if (queueRes.ok) {
        const queueData = await queueRes.json();
        setItems(queueData.items || []);
      } else {
        setFetchError(`Failed to load review queue: ${queueRes.statusText}`);
      }
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }
    } catch (err: any) {
      console.error("Error loading live review data:", err);
      setFetchError(err?.message || "Failed to connect to backend API");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenModal = (item: ReviewItem) => {
    setSelectedItem(item);
    setResolutionNotes("");

    // Set default action per reason
    if (item.review_reason === "missing_attachment") {
      setActionChoice("CONFIRM_MISSING");
    } else if (item.review_reason === "wrong_doc_type") {
      setActionChoice("CONFIRM_WRONG_DOC");
    } else if (item.review_reason === "unreadable") {
      setActionChoice("CONFIRM_UNREADABLE");
    } else {
      setActionChoice("CORRECT_BL_VALUE");
    }

    // Pre-fill corrections if missing_value
    const initialCorrections: Record<string, string> = {};
    (item.evidence?.fields || []).forEach((f) => {
      if (f.is_mismatch) {
        initialCorrections[f.field_name] = f.bl_value !== "???" && f.bl_value !== "_______" ? f.bl_value : "";
      }
    });
    setCorrectionsInput(initialCorrections);
  };

  const handleCorrectionChange = (fieldName: string, value: string) => {
    setCorrectionsInput((prev) => ({
      ...prev,
      [fieldName]: value,
    }));
  };

  const handleResolveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    const emailId = selectedItem.email_id;
    const now = new Date().toLocaleTimeString();

    const appliedCorrections: FieldCorrection[] = [];

    let outcomeLabel = actionChoice;
    let defaultNote = "Manual human verification completed.";

    if (selectedItem.review_reason === "missing_attachment") {
      if (actionChoice === "CONFIRM_MISSING") {
        outcomeLabel = "BL_MISSING_REQUESTED";
        defaultNote = "Draft BL missing in email. Requested BL from sender.";
      } else if (actionChoice === "RECEIVED_SEPARATELY") {
        outcomeLabel = "BL_RECEIVED_SEPARATELY";
        defaultNote = "BL received separately via offline channel.";
      } else {
        outcomeLabel = "DISMISSED";
      }
    } else if (selectedItem.review_reason === "wrong_doc_type") {
      if (actionChoice === "CONFIRM_WRONG_DOC") {
        outcomeLabel = "WRONG_DOC_CONFIRMED";
        defaultNote = "Received Commercial Invoice instead of BL. Requested correct BL.";
      } else if (actionChoice === "REPLACEMENT_RECEIVED") {
        outcomeLabel = "REPLACEMENT_DOC_RECEIVED";
        defaultNote = "Replacement BL received.";
      } else {
        outcomeLabel = "DISMISSED";
      }
    } else if (selectedItem.review_reason === "unreadable") {
      if (actionChoice === "CONFIRM_UNREADABLE") {
        outcomeLabel = "UNREADABLE_RESCAN_REQUESTED";
        defaultNote = "Image scan unreadable. Requested rescan from sender.";
      } else if (actionChoice === "HUMAN_VERIFIED") {
        outcomeLabel = "HUMAN_VERIFIED_ENTRY";
        defaultNote = "Human reviewer manually verified values from physical scan.";
        (selectedItem.evidence?.fields || []).forEach((f) => {
          if (correctionsInput[f.field_name]) {
            appliedCorrections.push({
              field_name: f.field_name,
              si_value: f.si_value,
              original_bl_value: f.bl_value,
              corrected_bl_value: correctionsInput[f.field_name],
            });
          }
        });
      } else {
        outcomeLabel = "DISMISSED";
      }
    } else if (selectedItem.review_reason === "missing_value") {
      if (actionChoice === "CORRECT_BL_VALUE") {
        outcomeLabel = "BL_VALUE_CORRECTED";
        defaultNote = "Missing BL field value verified and corrected by reviewer.";
        (selectedItem.evidence?.fields || []).forEach((f) => {
          if (f.is_mismatch || correctionsInput[f.field_name] !== undefined) {
            appliedCorrections.push({
              field_name: f.field_name,
              si_value: f.si_value,
              original_bl_value: f.bl_value,
              corrected_bl_value: correctionsInput[f.field_name] || f.si_value,
            });
          }
        });
      } else {
        outcomeLabel = "DISMISSED";
      }
    }

    const finalNotes = resolutionNotes.trim() || defaultNote;

    // Convert UI field names to canonical database column names
    const canonicalCorrections: Record<string, string> = {};
    for (const c of appliedCorrections) {
      const dbCol = FIELD_LABEL_TO_CANONICAL[c.field_name] || c.field_name.toLowerCase().replace(/ /g, "_");
      canonicalCorrections[dbCol] = c.corrected_bl_value;
    }

    try {
      await fetch(`${API_URL}/review/${emailId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outcome: outcomeLabel,
          notes: finalNotes,
          corrections: Object.keys(canonicalCorrections).length > 0 ? canonicalCorrections : undefined,
          corrected_by: "human_reviewer",
        }),
      });
    } catch (err) {
      console.error("Failed to persist resolution to backend:", err);
    }

    setItems((prevItems) =>
      prevItems.map((item) => {
        if (item.email_id === emailId) {
          return {
            ...item,
            status: "RESOLVED",
            resolved: true,
            resolvedAt: now,
            resolutionOutcome: outcomeLabel,
            resolutionNotes: finalNotes,
            correctionsHistory: appliedCorrections,
          };
        }
        return item;
      })
    );

    setSuccessToast(`Review for ${emailId} successfully RESOLVED (${outcomeLabel})`);
    setSelectedItem(null);
    setResolutionNotes("");

    setTimeout(() => {
      setSuccessToast(null);
    }, 4000);
  };

  const filteredItems = items.filter((item) => {
    const matchesTab = activeTab === "active" ? !item.resolved : item.resolved;
    const matchesSearch =
      (item.email_id || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.subject || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === "ALL" || item.category === categoryFilter;
    const matchesReason = reasonFilter === "ALL" || item.review_reason === reasonFilter;
    return matchesTab && matchesSearch && matchesCategory && matchesReason;
  });

  const unresolvedCount = items.filter((i) => !i.resolved).length;
  const resolvedCount = items.filter((i) => i.resolved).length;

  const countWrongDoc = items.filter((i) => i.review_reason === "wrong_doc_type").length;
  const countMissingAtt = items.filter((i) => i.review_reason === "missing_attachment").length;
  const countUnreadable = items.filter((i) => i.review_reason === "unreadable").length;
  const countMissingVal = items.filter((i) => i.review_reason === "missing_value").length;

  const totalVolume = stats?.total ?? 520;
  const verifiedClean = stats?.by_status?.OK ?? 0;
  const inProcessing = (stats?.by_status?.CLASSIFIED ?? 0) + (stats?.by_status?.PENDING ?? 0);
  const needsReviewCount = unresolvedCount || (stats?.needs_review ?? 0);
  const mismatchCount = stats ? count(stats.by_status, "MISMATCH") : 0;
  const siCreationHref = routes.siCreation();

  const verifiedPercent = totalVolume ? ((verifiedClean / totalVolume) * 100).toFixed(1) : "0.0";
  const inProcessingPercent = totalVolume ? ((inProcessing / totalVolume) * 100).toFixed(1) : "0.0";
  const reviewPercent = totalVolume ? ((needsReviewCount / totalVolume) * 100).toFixed(1) : "0.0";
  const operationalPercent = (100 - parseFloat(reviewPercent)).toFixed(1);

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 text-gray-900 md:flex-row">
      {/* Left Sidebar Navigation */}
      <aside className="border-b border-gray-200 bg-white md:sticky md:top-0 md:h-screen md:w-64 md:min-w-64 md:max-w-64 md:shrink-0 md:overflow-y-auto no-scrollbar md:border-r md:border-b-0 flex flex-col">
        {/* Clickable Voyara Shipping Operations Header */}
        <div className="px-5 pt-5 pb-4 md:pt-7">
          <Link
            href={routes.dashboard}
            className="group flex items-center gap-3 rounded-lg p-1 -m-1 transition-colors hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-navy"
            title="Go to Operations Dashboard"
          >
            <div className="flex size-9 items-center justify-center rounded-lg bg-navy text-sm font-bold text-white shadow-xs group-hover:bg-navy/90 transition-colors">
              VA
            </div>
            <div>
              <h1 className="text-base font-bold text-navy leading-tight group-hover:text-tangerine transition-colors">
                Voyara
              </h1>
              <p className="text-xs text-gray-500">Shipping Operations</p>
            </div>
          </Link>
        </div>

        {/* Navigation Links */}
        <nav aria-label="Main Navigation" className="px-3 pb-6 space-y-1 flex-1">
          <p className="px-3 pb-1 text-xs font-bold uppercase tracking-wider text-steel">
            Workspaces
          </p>

          <Link
            href={routes.dashboard}
            className="flex items-center justify-between gap-3 rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors focus-visible:outline-2 focus-visible:outline-navy"
          >
            <span>Dashboard</span>
          </Link>

          <Link
            href={routes.extraction()}
            className="flex items-center justify-between gap-3 rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors focus-visible:outline-2 focus-visible:outline-navy"
          >
            <span>Email Inbox</span>
          </Link>

          <Link
            href={routes.home}
            className="relative flex items-center justify-between gap-3 rounded-md px-3 py-2 text-sm font-semibold text-navy bg-cream focus-visible:outline-2 focus-visible:outline-navy"
          >
            <span
              aria-hidden
              className="absolute inset-y-1.5 left-0 hidden w-1 rounded-full bg-tangerine md:block"
            />
            <span>Human Review</span>
            {needsReviewCount > 0 && (
              <span className="rounded-full bg-tangerine px-2 py-0.5 text-xs font-semibold text-white">
                {needsReviewCount}
              </span>
            )}
          </Link>

          <Link
            href={siCreationHref}
            className="flex items-center justify-between gap-3 rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors focus-visible:outline-2 focus-visible:outline-navy"
          >
            <span>SI Editor</span>
          </Link>

          <Link
            href={routes.extraction("bl-amendments")}
            className="flex items-center justify-between gap-3 rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors focus-visible:outline-2 focus-visible:outline-navy"
          >
            <span>BL Amendments</span>
            {mismatchCount > 0 && (
              <span className="rounded-full bg-tangerine px-2 py-0.5 text-xs font-semibold text-white">
                {mismatchCount}
              </span>
            )}
          </Link>

          {/* Email Inbox Categories Section */}
          <div className="pt-5">
            <p className="px-3 pb-1 text-xs font-bold uppercase tracking-wider text-steel">
              Email Inbox
            </p>
            {CATEGORY_ITEMS.map((item) => (
              <Link
                key={item.category}
                href={routes.extraction(item.slug)}
                className="flex items-center justify-between gap-2 rounded-md px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
              >
                <span className="truncate">{CATEGORY_META[item.category].label}</span>
                {stats && (
                  <span className="tabular-nums text-gray-400">
                    {count(stats.by_category, item.category)}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className="min-w-0 flex-1 flex flex-col">
        {/* Toast Notification */}
        {successToast && (
          <div className="fixed top-6 right-6 z-50 bg-white border border-[#6F8AB7] text-[#485C8B] px-4 py-2.5 rounded shadow-sm flex items-center gap-2 text-xs font-medium">
            <span className="text-[#6F8AB7]">✓</span>
            <span>{successToast}</span>
          </div>
        )}

        {/* Main Content */}
        <main className="max-w-7xl w-full px-4 py-6 md:px-8 md:py-8 flex-1 flex flex-col gap-5">
          {/* Operations Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-xl font-bold text-[#485C8B] tracking-tight">Shipping Operations Control Centre</h2>
              <p className="text-xs text-[#6F8AB7] mt-0.5 max-w-2xl">
                End-to-end verification pipeline metrics, edge-case breakdown, and reason-specific human resolution.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium border border-emerald-200 bg-emerald-50 text-emerald-700">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Live Pipeline Connected
              </span>
              <span className="text-xs text-slate-500 font-medium">Queue Status:</span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold bg-[#FFE7B7]/40 border border-[#FDD58D] text-[#F6983E]">
                {unresolvedCount} Actions Pending
              </span>
            </div>
          </div>

        {/* Operations Overview Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded border border-slate-200 flex flex-col justify-between">
            <span className="text-xs font-medium text-[#6F8AB7]">Total Processed Emails</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-[#485C8B]">{totalVolume}</span>
              <span className="text-xs text-slate-400 font-mono">100% Volume</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded border border-slate-200 border-l-4 border-l-[#F6983E] flex flex-col justify-between">
            <span className="text-xs font-medium text-[#F6983E]">Needs Human Review</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-[#F6983E]">{needsReviewCount}</span>
              <span className="text-xs text-[#F6983E] font-medium">{reviewPercent}% Escalated</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded border border-slate-200 flex flex-col justify-between">
            <span className="text-xs font-medium text-[#6F8AB7]">Verified Clean (Pass)</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-[#485C8B]">{verifiedClean}</span>
              <span className="text-xs text-slate-500 font-mono">{verifiedPercent}% Auto-Pass</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded border border-slate-200 flex flex-col justify-between">
            <span className="text-xs font-medium text-[#6F8AB7]">In Processing / Staged</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-[#485C8B]">{inProcessing}</span>
              <span className="text-xs text-slate-500 font-mono">{inProcessingPercent}% Pipeline</span>
            </div>
          </div>
        </div>

        {/* Review Reasons Breakdown & Pipeline Health */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-white p-4 rounded border border-slate-200 flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h3 className="text-xs font-bold text-[#485C8B] uppercase tracking-wider">
                Review Reasons Breakdown
              </h3>
              <span className="text-xs text-[#6F8AB7]">Total Escalated: {unresolvedCount} Items</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded border border-slate-200 bg-white flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-600">Wrong Doc Type</span>
                <span className="text-xl font-bold text-[#485C8B]">{countWrongDoc}</span>
                <span className="text-[11px] text-slate-400">Invoice / Non-BL</span>
              </div>

              <div className="p-3 rounded border border-[#FDD58D] bg-[#FFE7B7]/20 flex flex-col gap-1">
                <span className="text-xs font-medium text-[#F6983E]">Missing Attachment</span>
                <span className="text-xl font-bold text-[#F6983E]">{countMissingAtt}</span>
                <span className="text-[11px] text-slate-500">Single File Received</span>
              </div>

              <div className="p-3 rounded border border-[#FDD58D] bg-[#FFE7B7]/20 flex flex-col gap-1">
                <span className="text-xs font-medium text-[#F6983E]">Unreadable File</span>
                <span className="text-xl font-bold text-[#F6983E]">{countUnreadable}</span>
                <span className="text-[11px] text-slate-500">Low OCR / Scanned</span>
              </div>

              <div className="p-3 rounded border border-slate-200 bg-white flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-600">Missing Value</span>
                <span className="text-xl font-bold text-[#485C8B]">{countMissingVal}</span>
                <span className="text-[11px] text-slate-400">Blank Token ??? / ____</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded border border-slate-200 flex flex-col justify-between gap-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h3 className="text-xs font-bold text-[#485C8B] uppercase tracking-wider">
                Review Pipeline Health
              </h3>
              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-[#485C8B]">
                {operationalPercent}% Operational
              </span>
            </div>

            <div className="space-y-3">
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden flex border border-slate-200">
                <div className="h-full bg-[#485C8B]" style={{ width: `${verifiedPercent}%` }} title={`Verified Clean: ${verifiedPercent}%`}></div>
                <div className="h-full bg-[#6F8AB7]" style={{ width: `${inProcessingPercent}%` }} title={`Processing: ${inProcessingPercent}%`}></div>
                <div className="h-full bg-[#F6983E]" style={{ width: `${reviewPercent}%` }} title={`Needs Review: ${reviewPercent}%`}></div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-[11px]">
                <div className="flex items-center gap-1.5 text-slate-600">
                  <span className="w-2 h-2 rounded-full bg-[#485C8B] inline-block"></span>
                  <span>Verified: {verifiedPercent}%</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-600">
                  <span className="w-2 h-2 rounded-full bg-[#6F8AB7] inline-block"></span>
                  <span>Process: {inProcessingPercent}%</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-600">
                  <span className="w-2 h-2 rounded-full bg-[#F6983E] inline-block"></span>
                  <span>Review: {reviewPercent}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Queue Header & Tab Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
          <div>
            <h3 className="text-base font-bold text-[#485C8B]">Review & Resolution Worklist</h3>
            <p className="text-xs text-slate-500">Select any record to inspect evidence and execute a resolution action.</p>
          </div>

          <div className="flex items-center bg-slate-100 p-1 rounded border border-slate-200">
            <button
              type="button"
              onClick={() => setActiveTab("active")}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors flex items-center gap-2 ${
                activeTab === "active"
                  ? "bg-[#485C8B] text-white"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span>Pending Queue</span>
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  activeTab === "active" ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
                }`}
              >
                {unresolvedCount}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("resolved")}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors flex items-center gap-2 ${
                activeTab === "resolved"
                  ? "bg-[#6F8AB7] text-white"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span>Resolved History</span>
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  activeTab === "resolved" ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
                }`}
              >
                {resolvedCount}
              </span>
            </button>
          </div>
        </div>

        {/* Filters & Search Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-3.5 rounded border border-slate-200">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Search Record</label>
            <input
              type="text"
              placeholder="Filter by email_id or subject..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-1.5 rounded bg-white border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#485C8B]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Category</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-3 py-1.5 rounded bg-white border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-[#485C8B]"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Review Reason</label>
            <select
              value={reasonFilter}
              onChange={(e) => setReasonFilter(e.target.value)}
              className="w-full px-3 py-1.5 rounded bg-white border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-[#485C8B]"
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
        <div className="bg-white rounded border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-slate-500 text-xs">
              <div className="inline-block w-5 h-5 border-2 border-[#485C8B] border-t-transparent rounded-full animate-spin mb-2"></div>
              <p>Loading live review queue from Supabase pipeline...</p>
            </div>
          ) : fetchError ? (
            <div className="p-12 text-center text-red-600 text-xs">
              <p className="font-semibold">Unable to load review queue</p>
              <p className="mt-1 text-slate-500">{fetchError}</p>
              <button
                type="button"
                onClick={fetchData}
                className="mt-3 px-3 py-1.5 bg-[#485C8B] text-white rounded text-xs font-semibold hover:bg-[#3b4c73] transition-colors"
              >
                Retry
              </button>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="p-12 text-center">
              <h3 className="text-slate-700 font-semibold text-sm">
                {activeTab === "active" ? "No Pending Reviews" : "No Resolved Items"}
              </h3>
              <p className="text-slate-500 text-xs mt-1">
                {activeTab === "active"
                  ? "All review items have been resolved or filtered out."
                  : "Items you resolve will appear in this history tab."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 text-xs uppercase tracking-wider font-semibold">
                    <th className="px-5 py-3">Email ID</th>
                    <th className="px-5 py-3">Subject</th>
                    <th className="px-5 py-3">Category</th>
                    <th className="px-5 py-3">Priority</th>
                    <th className="px-5 py-3">Review Reason</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredItems.map((item) => {
                    const rMeta = REASON_COLORS[item.review_reason] || {
                      bg: "bg-slate-50",
                      text: "text-slate-700",
                      border: "border-slate-200",
                      label: item.review_reason,
                    };
                    const pMeta = PRIORITY_COLORS[item.priority] || {
                      bg: "bg-slate-50",
                      text: "text-slate-700",
                      border: "border-slate-200",
                    };
                    return (
                      <tr
                        key={item.email_id}
                        onClick={() => handleOpenModal(item)}
                        className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                      >
                        <td className="px-5 py-3.5 font-mono font-semibold text-[#485C8B]">
                          {item.email_id}
                        </td>
                        <td className="px-5 py-3.5 text-slate-800 font-medium max-w-xs truncate">
                          {item.subject}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="px-2 py-0.5 rounded bg-slate-50 border border-slate-200 text-slate-600 text-[11px] font-medium">
                            {item.category}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${pMeta.bg} ${pMeta.text} ${pMeta.border}`}
                          >
                            {item.priority}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${rMeta.bg} ${rMeta.text} ${rMeta.border}`}
                          >
                            {rMeta.label}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          {item.resolved ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-50 border border-[#6F8AB7]/40 text-[#6F8AB7] text-[11px] font-medium">
                              RESOLVED ({item.resolutionOutcome})
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded bg-[#FFE7B7]/40 border border-[#FDD58D] text-[#F6983E] text-[11px] font-medium">
                              {item.status}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenModal(item);
                            }}
                            className={`px-3 py-1 rounded border text-xs font-medium transition-colors ${
                              item.resolved
                                ? "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                                : "bg-[#485C8B] hover:bg-[#3b4c73] border-[#485C8B] text-white"
                            }`}
                          >
                            {item.resolved ? "View Details" : "Review"}
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
    </div>

      {/* Reason-Specific Review / Resolve Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg max-w-3xl w-full p-6 shadow-xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto text-slate-800">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-200 pb-3">
              <div>
                <span className="font-mono text-xs font-semibold text-[#6F8AB7]">
                  {selectedItem.email_id}
                </span>
                <h3 className="text-lg font-bold text-[#485C8B] mt-0.5">{selectedItem.subject}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="text-slate-400 hover:text-slate-700 text-lg p-1"
              >
                ✕
              </button>
            </div>

            {/* Summary Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded border border-slate-200 text-xs">
              <div>
                <span className="text-slate-500 block mb-0.5">Email ID</span>
                <span className="font-mono font-semibold text-[#485C8B]">{selectedItem.email_id}</span>
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5">Subject</span>
                <span className="font-medium text-slate-800 truncate block">{selectedItem.subject}</span>
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5">Category</span>
                <span className="font-medium text-slate-800">{selectedItem.category}</span>
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5">Priority</span>
                <span
                  className={`font-semibold ${
                    PRIORITY_COLORS[selectedItem.priority]?.text || "text-slate-800"
                  }`}
                >
                  {selectedItem.priority}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5">Review Reason</span>
                <span className="font-medium text-slate-800">{selectedItem.review_reason}</span>
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5">Confidence</span>
                <span
                  className={`font-semibold ${
                    selectedItem.confidence !== undefined && selectedItem.confidence !== null && selectedItem.confidence < 0.7
                      ? "text-[#F6983E]"
                      : "text-emerald-700"
                  }`}
                >
                  {selectedItem.confidence !== undefined && selectedItem.confidence !== null
                    ? `${(selectedItem.confidence * 100).toFixed(0)}%`
                    : "N/A"}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5">Current Status</span>
                <span
                  className={`font-semibold ${
                    selectedItem.resolved ? "text-[#6F8AB7]" : "text-[#F6983E]"
                  }`}
                >
                  {selectedItem.status}
                </span>
              </div>
            </div>

            {/* Low Confidence Warning Notice */}
            {selectedItem.confidence !== undefined && selectedItem.confidence !== null && selectedItem.confidence < 0.7 && (
              <div className="p-2.5 rounded border border-[#FDD58D] bg-[#FFE7B7]/40 text-xs text-[#F6983E] font-medium flex items-center gap-2">
                <span>⚠️</span>
                <span>Low confidence: manual verification required.</span>
              </div>
            )}

            {/* Reason Attention Banner */}
            <div className="p-3 rounded border border-[#FDD58D] bg-[#FFE7B7]/30 text-xs flex flex-col gap-1">
              <span className="font-semibold text-[#F6983E]">
                {REASON_COLORS[selectedItem.review_reason]?.label || selectedItem.review_reason}
              </span>
              <p className="text-slate-700">{selectedItem.evidence?.evidence_summary || "Document review required."}</p>
            </div>

            {/* Shipment Details & Evidence Section */}
            <div className="border border-slate-200 rounded overflow-hidden">
              <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between text-xs font-semibold">
                <span className="text-[#485C8B]">Shipment Comparison Evidence (SI vs BL)</span>
                <div className="flex items-center gap-2 text-slate-500 text-[11px] font-mono">
                  <span>SI: {selectedItem.evidence?.doc_si_name || `${selectedItem.email_id}_SI`}</span>
                  <span>|</span>
                  <span className="text-[#485C8B]">BL: {selectedItem.evidence?.doc_bl_name || `${selectedItem.email_id}_BL`}</span>
                </div>
              </div>

              <div className="p-3">
                {selectedItem.evidence?.fields && selectedItem.evidence.fields.length > 0 ? (
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 font-medium">
                        <th className="py-2 px-3">Field</th>
                        <th className="py-2 px-3">SI Reference (Read-Only)</th>
                        <th className="py-2 px-3">Original BL Value</th>
                        <th className="py-2 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedItem.evidence.fields.map((f, idx) => (
                        <tr
                          key={idx}
                          className={f.is_mismatch ? "bg-[#FFE7B7]/20" : "hover:bg-slate-50"}
                        >
                          <td className="py-2 px-3 font-semibold text-slate-700">{f.field_name}</td>
                          <td className="py-2 px-3 font-mono text-slate-600">{f.si_value}</td>
                          <td className="py-2 px-3 font-mono">
                            <span
                              className={
                                f.is_missing
                                  ? "text-[#F6983E] font-semibold px-1.5 py-0.5 rounded bg-[#FFE7B7]/50 border border-[#FDD58D]"
                                  : f.is_mismatch
                                  ? "text-[#F6983E] font-semibold"
                                  : "text-slate-700"
                              }
                            >
                              {f.bl_value}
                            </span>
                          </td>
                          <td className="py-2 px-3">
                            {f.is_mismatch ? (
                              <span className="text-[#F6983E] text-[11px] font-semibold">
                                Discrepancy
                              </span>
                            ) : (
                              <span className="text-[#6F8AB7] text-[11px] font-medium">Match</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="p-6 text-center text-slate-500 text-xs">
                    <p className="font-semibold text-slate-700">Document Particulars Unavailable</p>
                    <p className="mt-1 text-slate-500">
                      {selectedItem.evidence?.evidence_summary || "Document extraction could not run for this email."}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Resolution Details or Form */}
            {selectedItem.resolved ? (
              <div className="bg-slate-50 border border-slate-200 p-4 rounded text-xs space-y-2">
                <div className="flex items-center justify-between text-[#485C8B] font-semibold border-b border-slate-200 pb-2">
                  <span>Resolved Status: {selectedItem.resolutionOutcome}</span>
                  <span className="text-slate-500 font-mono text-[11px]">
                    Resolved at: {selectedItem.resolvedAt}
                  </span>
                </div>

                <p className="text-slate-700">
                  <strong className="text-slate-600">Reviewer Note:</strong> {selectedItem.resolutionNotes}
                </p>

                {selectedItem.correctionsHistory && selectedItem.correctionsHistory.length > 0 && (
                  <div className="mt-2 bg-white p-3 rounded border border-slate-200 space-y-2">
                    <span className="font-semibold text-[#485C8B] block text-[11px] uppercase tracking-wider">
                      Human Verified Corrections Applied:
                    </span>
                    <div className="space-y-1.5 divide-y divide-slate-100">
                      {selectedItem.correctionsHistory.map((c, i) => (
                        <div key={i} className="pt-1.5 first:pt-0 grid grid-cols-4 gap-2 text-[11px]">
                          <span className="font-medium text-slate-700">{c.field_name}</span>
                          <span className="text-slate-500">SI: {c.si_value}</span>
                          <span className="text-slate-400 line-through">BL: {c.original_bl_value}</span>
                          <span className="text-[#485C8B] font-semibold font-mono">
                            Verified: {c.corrected_bl_value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <form onSubmit={handleResolveSubmit} className="flex flex-col gap-3.5 text-xs">
                {/* 1. MISSING ATTACHMENT FLOW */}
                {selectedItem.review_reason === "missing_attachment" && (
                  <div className="bg-slate-50 p-3.5 rounded border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <span className="font-semibold text-[#F6983E]">
                        Document Checklist (Missing Attachment)
                      </span>
                      <span className="text-slate-500 text-[11px]">Do NOT create placeholder BL values</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 rounded bg-white border border-slate-200 text-slate-700 font-medium">
                        ✓ Shipping Instruction (SI): Present ({selectedItem.evidence?.doc_si_name || `${selectedItem.email_id}_SI`})
                      </div>
                      <div className="p-2.5 rounded bg-[#FFE7B7]/40 border border-[#FDD58D] text-[#F6983E] font-medium">
                        ✗ Draft Bill of Lading (BL): MISSING
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold text-[#485C8B] mb-1.5">Select Resolution Action:</label>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => setActionChoice("CONFIRM_MISSING")}
                          className={`p-2 rounded border font-medium text-xs transition-colors ${
                            actionChoice === "CONFIRM_MISSING"
                              ? "bg-[#485C8B] text-white border-[#485C8B]"
                              : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
                          }`}
                        >
                          Confirm Missing & Request Sender
                        </button>
                        <button
                          type="button"
                          onClick={() => setActionChoice("RECEIVED_SEPARATELY")}
                          className={`p-2 rounded border font-medium text-xs transition-colors ${
                            actionChoice === "RECEIVED_SEPARATELY"
                              ? "bg-[#485C8B] text-white border-[#485C8B]"
                              : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
                          }`}
                        >
                          BL Received Separately (Offline)
                        </button>
                        <button
                          type="button"
                          onClick={() => setActionChoice("DISMISS")}
                          className={`p-2 rounded border font-medium text-xs transition-colors ${
                            actionChoice === "DISMISS"
                              ? "bg-[#485C8B] text-white border-[#485C8B]"
                              : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
                          }`}
                        >
                          Dismiss Issue
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. WRONG DOC TYPE FLOW */}
                {selectedItem.review_reason === "wrong_doc_type" && (
                  <div className="bg-slate-50 p-3.5 rounded border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <span className="font-semibold text-[#F6983E]">
                        Document Mismatch Escalation
                      </span>
                      <span className="text-slate-500 text-[11px]">Commercial Invoice attached instead of BL</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 rounded bg-white border border-slate-200 text-slate-700">
                        <strong>Expected:</strong> Draft Bill of Lading (BL)
                      </div>
                      <div className="p-2.5 rounded bg-[#FFE7B7]/40 border border-[#FDD58D] text-[#F6983E]">
                        <strong>Received:</strong> Commercial Invoice ({selectedItem.evidence?.doc_bl_name || `${selectedItem.email_id}_Attachment`})
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold text-[#485C8B] mb-1.5">Select Resolution Action:</label>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => setActionChoice("CONFIRM_WRONG_DOC")}
                          className={`p-2 rounded border font-medium text-xs transition-colors ${
                            actionChoice === "CONFIRM_WRONG_DOC"
                              ? "bg-[#485C8B] text-white border-[#485C8B]"
                              : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
                          }`}
                        >
                          Confirm Wrong Doc & Request BL
                        </button>
                        <button
                          type="button"
                          onClick={() => setActionChoice("REPLACEMENT_RECEIVED")}
                          className={`p-2 rounded border font-medium text-xs transition-colors ${
                            actionChoice === "REPLACEMENT_RECEIVED"
                              ? "bg-[#485C8B] text-white border-[#485C8B]"
                              : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
                          }`}
                        >
                          Correct Document Received
                        </button>
                        <button
                          type="button"
                          onClick={() => setActionChoice("DISMISS")}
                          className={`p-2 rounded border font-medium text-xs transition-colors ${
                            actionChoice === "DISMISS"
                              ? "bg-[#485C8B] text-white border-[#485C8B]"
                              : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
                          }`}
                        >
                          Dismiss Issue
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. UNREADABLE FLOW */}
                {selectedItem.review_reason === "unreadable" && (
                  <div className="bg-slate-50 p-3.5 rounded border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <span className="font-semibold text-[#F6983E]">
                        Unreadable Scan Resolution
                      </span>
                      <span className="text-slate-500 text-[11px]">Rasterized image PDF / 0 OCR text</span>
                    </div>

                    <div>
                      <label className="block font-semibold text-[#485C8B] mb-1.5">Select Resolution Action:</label>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => setActionChoice("CONFIRM_UNREADABLE")}
                          className={`p-2 rounded border font-medium text-xs transition-colors ${
                            actionChoice === "CONFIRM_UNREADABLE"
                              ? "bg-[#485C8B] text-white border-[#485C8B]"
                              : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
                          }`}
                        >
                          Confirm Unreadable & Request Rescan
                        </button>
                        <button
                          type="button"
                          onClick={() => setActionChoice("HUMAN_VERIFIED")}
                          className={`p-2 rounded border font-medium text-xs transition-colors ${
                            actionChoice === "HUMAN_VERIFIED"
                              ? "bg-[#485C8B] text-white border-[#485C8B]"
                              : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
                          }`}
                        >
                          Human Verified Manual Entry
                        </button>
                        <button
                          type="button"
                          onClick={() => setActionChoice("DISMISS")}
                          className={`p-2 rounded border font-medium text-xs transition-colors ${
                            actionChoice === "DISMISS"
                              ? "bg-[#485C8B] text-white border-[#485C8B]"
                              : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
                          }`}
                        >
                          Dismiss Issue
                        </button>
                      </div>
                    </div>

                    {actionChoice === "HUMAN_VERIFIED" && (
                      <div className="mt-2 p-3 rounded bg-white border border-slate-200 space-y-2">
                        <span className="font-semibold text-[#485C8B] text-xs block">
                          Enter Human Verified Values:
                        </span>
                        <div className="space-y-2">
                          {(selectedItem.evidence?.fields || []).length > 0 ? (
                            selectedItem.evidence!.fields.map((f, i) => (
                              <div key={i} className="grid grid-cols-3 gap-2 items-center text-xs">
                                <span className="text-slate-700 font-medium">{f.field_name}</span>
                                <span className="text-slate-500 font-mono text-[11px]">SI: {f.si_value}</span>
                                <input
                                  type="text"
                                  value={correctionsInput[f.field_name] || ""}
                                  onChange={(e) => handleCorrectionChange(f.field_name, e.target.value)}
                                  placeholder={`Verified ${f.field_name}...`}
                                  className="px-2.5 py-1 rounded bg-white border border-slate-200 text-slate-800 font-mono text-xs focus:outline-none focus:border-[#485C8B]"
                                />
                              </div>
                            ))
                          ) : (
                            <p className="text-slate-500 text-xs italic">No document fields extracted to display.</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 4. MISSING VALUE FLOW */}
                {selectedItem.review_reason === "missing_value" && (
                  <div className="bg-slate-50 p-3.5 rounded border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <span className="font-semibold text-[#F6983E]">
                        Field Correction Form (Blank / Placeholder Tokens)
                      </span>
                      <span className="text-slate-500 text-[11px]">SI values are read-only references</span>
                    </div>

                    <div className="space-y-2.5">
                      {(selectedItem.evidence?.fields || []).length > 0 ? (
                        selectedItem.evidence!.fields.map((f, idx) => (
                          <div
                            key={idx}
                            className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-center bg-white p-2.5 rounded border border-slate-200"
                          >
                            <div className="sm:col-span-1">
                              <span className="font-semibold text-slate-700 block">{f.field_name}</span>
                              <span className="text-[10px] text-slate-500">
                                SI Ref: <strong className="text-slate-700 font-mono">{f.si_value}</strong>
                              </span>
                            </div>

                            <div className="text-[11px] text-slate-500 sm:col-span-1">
                              Orig BL: <span className="text-[#F6983E] font-mono font-semibold">{f.bl_value}</span>
                            </div>

                            <div className="sm:col-span-2">
                              <input
                                type="text"
                                value={correctionsInput[f.field_name] || ""}
                                onChange={(e) => handleCorrectionChange(f.field_name, e.target.value)}
                                placeholder={`Corrected BL ${f.field_name}...`}
                                className="w-full px-2.5 py-1 rounded bg-white border border-slate-200 text-slate-800 font-mono text-xs focus:outline-none focus:border-[#485C8B]"
                              />
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-slate-500 text-xs italic">No document fields extracted to display.</p>
                      )}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Reviewer Note:</label>
                  <input
                    type="text"
                    placeholder="Enter audit resolution notes..."
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    className="w-full px-3 py-2 rounded bg-white border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#485C8B]"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setSelectedItem(null)}
                    className="px-3.5 py-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-medium text-xs transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded bg-[#485C8B] hover:bg-[#3b4c73] text-white font-semibold text-xs transition-colors shadow-none"
                  >
                    Save Resolution
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
