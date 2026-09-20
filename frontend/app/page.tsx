"use client";

import { useState } from "react";

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

const INITIAL_PREVIEW_ITEMS: ReviewItem[] = [
  {
    email_id: "email_014",
    subject: "Draft B/L for Booking #BK-9921",
    category: "BL_COMPARISON",
    priority: "High",
    review_reason: "wrong_doc_type",
    confidence: 0.92,
    status: "NEEDS_REVIEW",
    resolved: false,
    evidence: {
      doc_si_name: "SI_BK9921.txt",
      doc_bl_name: "Commercial_Invoice_INV9921.txt (INCORRECT DOC)",
      evidence_summary:
        "Attached file is a Commercial Invoice instead of a Bill of Lading. Port & vessel details are missing.",
      fields: [
        {
          field_name: "Shipper",
          si_value: "ACME Logistics Ltd",
          bl_value: "ACME Logistics Ltd (Seller)",
          is_mismatch: false,
          is_missing: false,
        },
        {
          field_name: "Consignee",
          si_value: "Global Import Co.",
          bl_value: "Global Import Co. (Buyer)",
          is_mismatch: false,
          is_missing: false,
        },
        {
          field_name: "Port of Loading",
          si_value: "Port Klang (MYPKG)",
          bl_value: "N/A (Invoice Header)",
          is_mismatch: true,
          is_missing: true,
          explanation: "Port of Loading is missing because attachment is a Commercial Invoice.",
        },
        {
          field_name: "Port of Discharge",
          si_value: "Hamburg (DEHAM)",
          bl_value: "N/A (Invoice Header)",
          is_mismatch: true,
          is_missing: true,
          explanation: "Port of Discharge is missing from Commercial Invoice.",
        },
        {
          field_name: "Cargo Description",
          si_value: "Rubber Gloves 100 CTNS",
          bl_value: "Rubber Gloves USD 45,000",
          is_mismatch: true,
          is_missing: false,
          explanation: "Invoice lists monetary amount instead of shipping commodity terms.",
        },
        {
          field_name: "Gross Weight",
          si_value: "12,500 KG",
          bl_value: "N/A",
          is_mismatch: true,
          is_missing: true,
          explanation: "Gross Weight is missing from the attached Commercial Invoice.",
        },
      ],
    },
  },
  {
    email_id: "email_027",
    subject: "Shipping Instruction - MV OCEAN HORIZON",
    category: "BL_COMPARISON",
    priority: "High",
    review_reason: "missing_attachment",
    confidence: 1.0,
    status: "NEEDS_REVIEW",
    resolved: false,
    evidence: {
      doc_si_name: "SI_MV_Horizon.txt",
      doc_bl_name: "[MISSING ATTACHMENT]",
      evidence_summary:
        "Email contains only 1 attachment (SI). Comparison requires 2 documents (SI + draft BL).",
      fields: [
        {
          field_name: "Shipper",
          si_value: "Oceanic Supply Chain",
          bl_value: "MISSING",
          is_mismatch: true,
          is_missing: true,
          explanation: "Draft BL document was omitted from the incoming email.",
        },
        {
          field_name: "Consignee",
          si_value: "Pacific Trading Ltd",
          bl_value: "MISSING",
          is_mismatch: true,
          is_missing: true,
          explanation: "Draft BL document was omitted from the incoming email.",
        },
        {
          field_name: "Port of Loading",
          si_value: "Shanghai (CNSHA)",
          bl_value: "MISSING",
          is_mismatch: true,
          is_missing: true,
        },
        {
          field_name: "Port of Discharge",
          si_value: "Rotterdam (NLRTM)",
          bl_value: "MISSING",
          is_mismatch: true,
          is_missing: true,
        },
        {
          field_name: "Gross Weight",
          si_value: "24,000 KG",
          bl_value: "MISSING",
          is_mismatch: true,
          is_missing: true,
          explanation: "Gross Weight cannot be verified because draft BL attachment is missing.",
        },
      ],
    },
  },
  {
    email_id: "email_055",
    subject: "Scanned BL copy for validation",
    category: "BL_COMPARISON",
    priority: "Medium",
    review_reason: "unreadable",
    confidence: 0.88,
    status: "NEEDS_REVIEW",
    resolved: false,
    evidence: {
      doc_si_name: "SI_Validation_055.txt",
      doc_bl_name: "BL_Scanned_055.pdf (UNREADABLE SCAN)",
      evidence_summary:
        "PDF attachment `BL_Scanned_055.pdf` has no OCR text layer (rasterized image scan).",
      fields: [
        {
          field_name: "Shipper",
          si_value: "Pioneer Freight Systems",
          bl_value: "[Unreadable Scan]",
          is_mismatch: true,
          is_missing: true,
          explanation: "Text layer missing from scanned PDF.",
        },
        {
          field_name: "Consignee",
          si_value: "Delta Distribution Inc",
          bl_value: "[Unreadable Scan]",
          is_mismatch: true,
          is_missing: true,
          explanation: "Text layer missing from scanned PDF.",
        },
        {
          field_name: "Port of Loading",
          si_value: "Tanjung Pelepas (MYTPP)",
          bl_value: "[Unreadable Scan]",
          is_mismatch: true,
          is_missing: true,
        },
        {
          field_name: "Port of Discharge",
          si_value: "Felixstowe (GBFXT)",
          bl_value: "[Unreadable Scan]",
          is_mismatch: true,
          is_missing: true,
        },
        {
          field_name: "Gross Weight",
          si_value: "18,250 KG",
          bl_value: "[Unreadable Scan]",
          is_mismatch: true,
          is_missing: true,
          explanation: "Image-only PDF prevents automated text extraction.",
        },
      ],
    },
  },
  {
    email_id: "email_102",
    subject: "SI Details for Container CNTR-7712",
    category: "BL_COMPARISON",
    priority: "Low",
    review_reason: "missing_value",
    confidence: 0.95,
    status: "NEEDS_REVIEW",
    resolved: false,
    evidence: {
      doc_si_name: "SI_CNTR7712.txt",
      doc_bl_name: "Draft_BL_CNTR7712.pdf",
      evidence_summary:
        "Shipping Instruction contains blank placeholder tokens (`???` and `_______`) in required fields.",
      fields: [
        {
          field_name: "Shipper",
          si_value: "Apex International",
          bl_value: "Apex International",
          is_mismatch: false,
          is_missing: false,
        },
        {
          field_name: "Consignee",
          si_value: "???",
          bl_value: "Global Buyers Inc",
          is_mismatch: true,
          is_missing: true,
          explanation: "Consignee in SI contains placeholder token '???'.",
        },
        {
          field_name: "Port of Loading",
          si_value: "Singapore (SGSIN)",
          bl_value: "Singapore (SGSIN)",
          is_mismatch: false,
          is_missing: false,
        },
        {
          field_name: "Port of Discharge",
          si_value: "Los Angeles (USLAX)",
          bl_value: "Los Angeles (USLAX)",
          is_mismatch: false,
          is_missing: false,
        },
        {
          field_name: "Gross Weight",
          si_value: "_______",
          bl_value: "15,400 KG",
          is_mismatch: true,
          is_missing: true,
          explanation: "Gross Weight in SI is missing (contains blank underscore token '_______').",
        },
      ],
    },
  },
];

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

const PRIORITY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  High: { bg: "bg-rose-500/10", text: "text-rose-400", border: "border-rose-500/20" },
  Medium: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20" },
  Low: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20" },
};

const CATEGORIES = ["ALL", "BL_COMPARISON", "SI_REQUEST", "INVOICE_QUERY", "GENERAL", "SPAM"];
const REASONS = ["ALL", "wrong_doc_type", "missing_attachment", "unreadable", "missing_value"];

export default function ReviewQueuePage() {
  const [items, setItems] = useState<ReviewItem[]>(INITIAL_PREVIEW_ITEMS);
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
    item.evidence.fields.forEach((f) => {
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

  const handleResolveSubmit = (e: React.FormEvent) => {
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
        selectedItem.evidence.fields.forEach((f) => {
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
        selectedItem.evidence.fields.forEach((f) => {
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

    setItems((prevItems) =>
      prevItems.map((item) => {
        if (item.email_id === emailId) {
          return {
            ...item,
            status: "RESOLVED",
            resolved: true,
            resolvedAt: now,
            resolutionOutcome: outcomeLabel,
            resolutionNotes: resolutionNotes.trim() || defaultNote,
            correctionsHistory: appliedCorrections,
          };
        }
        return item;
      })
    );

    setSuccessToast(`✓ Review for ${emailId} successfully RESOLVED (${outcomeLabel})`);
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
              <h1 className="font-semibold text-slate-100 text-sm leading-none">
                Shipping Document Verification System
              </h1>
              <span className="text-xs text-slate-400">Operations Control Centre — Person D</span>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 font-medium">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
              Static Preview Dataset (Offline Mode)
            </div>
          </div>
        </div>
      </header>

      {/* Toast Notification */}
      {successToast && (
        <div className="fixed top-20 right-6 z-50 bg-emerald-950 border border-emerald-500/50 text-emerald-200 px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 text-sm animate-bounce">
          <span>{successToast}</span>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto w-full px-6 py-8 flex-1 flex flex-col gap-6">
        {/* Banner Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 p-6 rounded-2xl border border-slate-800/80 shadow-xl">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-medium mb-2">
              Operations Dashboard
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Shipping Operations Control Centre</h2>
            <p className="text-sm text-slate-400 mt-1 max-w-2xl">
              End-to-end verification pipeline metrics, edge-case breakdown, and reason-specific human resolution.
            </p>
          </div>
        </div>

        {/* Operations Overview Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 shadow-lg flex flex-col justify-between">
            <span className="text-xs font-medium text-slate-400">Total Emails</span>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-3xl font-extrabold text-white">520</span>
              <span className="text-xs text-slate-500 font-mono">100% Dataset</span>
            </div>
          </div>

          <div className="bg-slate-900/60 p-5 rounded-2xl border border-rose-950/60 shadow-lg flex flex-col justify-between">
            <span className="text-xs font-medium text-rose-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
              Needs Review
            </span>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-3xl font-extrabold text-rose-400">42</span>
              <span className="text-xs text-rose-400/70 font-mono">8.1% Escalated</span>
            </div>
          </div>

          <div className="bg-slate-900/60 p-5 rounded-2xl border border-emerald-950/60 shadow-lg flex flex-col justify-between">
            <span className="text-xs font-medium text-emerald-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Verified Clean
            </span>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-3xl font-extrabold text-emerald-400">318</span>
              <span className="text-xs text-emerald-400/70 font-mono">61.2% Auto-Pass</span>
            </div>
          </div>

          <div className="bg-slate-900/60 p-5 rounded-2xl border border-blue-950/60 shadow-lg flex flex-col justify-between">
            <span className="text-xs font-medium text-blue-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              In Processing
            </span>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-3xl font-extrabold text-blue-400">160</span>
              <span className="text-xs text-blue-400/70 font-mono">30.7% In Stage 1/2</span>
            </div>
          </div>
        </div>

        {/* Review Reasons Breakdown & Pipeline Health Bar */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-slate-900/60 p-5 rounded-2xl border border-slate-800 shadow-xl flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
                Review Reasons Breakdown
              </h3>
              <span className="text-xs text-slate-400">Total Escalated: 42 Items</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl bg-purple-950/30 border border-purple-800/40 flex flex-col gap-1">
                <div className="flex items-center justify-between text-purple-300 text-xs font-medium">
                  <span>Wrong Doc Type</span>
                  <span>📄</span>
                </div>
                <span className="text-2xl font-bold text-purple-200 mt-1">5</span>
                <span className="text-[10px] text-purple-400/70">Invoice / Packing List</span>
              </div>

              <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-800/40 flex flex-col gap-1">
                <div className="flex items-center justify-between text-amber-300 text-xs font-medium">
                  <span>Missing Attachment</span>
                  <span>⚠️</span>
                </div>
                <span className="text-2xl font-bold text-amber-200 mt-1">8</span>
                <span className="text-[10px] text-amber-400/70">Single File Received</span>
              </div>

              <div className="p-3.5 rounded-xl bg-rose-950/30 border border-rose-800/40 flex flex-col gap-1">
                <div className="flex items-center justify-between text-rose-300 text-xs font-medium">
                  <span>Unreadable File</span>
                  <span>🚫</span>
                </div>
                <span className="text-2xl font-bold text-rose-200 mt-1">11</span>
                <span className="text-[10px] text-rose-400/70">Scanned / 0 Bytes</span>
              </div>

              <div className="p-3.5 rounded-xl bg-cyan-950/30 border border-cyan-800/40 flex flex-col gap-1">
                <div className="flex items-center justify-between text-cyan-300 text-xs font-medium">
                  <span>Missing Value</span>
                  <span>❓</span>
                </div>
                <span className="text-2xl font-bold text-cyan-200 mt-1">18</span>
                <span className="text-[10px] text-cyan-400/70">Blank Token ??? / ____</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 shadow-xl flex flex-col justify-between gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
                Review Pipeline Health
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-semibold">
                91.9% Operational
              </span>
            </div>

            <div className="space-y-3">
              <div className="h-3 w-full bg-slate-950 rounded-full overflow-hidden flex border border-slate-800">
                <div className="h-full bg-emerald-500" style={{ width: "61.2%" }} title="Verified Clean: 61.2%"></div>
                <div className="h-full bg-blue-500" style={{ width: "30.7%" }} title="Processing: 30.7%"></div>
                <div className="h-full bg-rose-500" style={{ width: "8.1%" }} title="Needs Review: 8.1%"></div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-[11px]">
                <div className="flex items-center gap-1.5 text-slate-300">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
                  <span>Verified: 61.2%</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-300">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"></span>
                  <span>Processing: 30.7%</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-300">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span>
                  <span>Review: 8.1%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Queue Header & Tab Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
          <div>
            <h3 className="text-lg font-bold text-white">Review & Resolution Worklist</h3>
            <p className="text-xs text-slate-400">Select any item to inspect reason-specific evidence and resolve.</p>
          </div>

          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab("active")}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
                activeTab === "active"
                  ? "bg-indigo-600 text-white shadow-md"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <span>Pending Queue</span>
              <span className="px-1.5 py-0.5 rounded-full bg-slate-900/60 text-[10px]">
                {unresolvedCount}
              </span>
            </button>
            <button
              onClick={() => setActiveTab("resolved")}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
                activeTab === "resolved"
                  ? "bg-emerald-600 text-white shadow-md"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <span>Resolved History</span>
              <span className="px-1.5 py-0.5 rounded-full bg-slate-900/60 text-[10px]">
                {resolvedCount}
              </span>
            </button>
          </div>
        </div>

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
          {filteredItems.length === 0 ? (
            <div className="p-16 text-center">
              <div className="text-3xl mb-2">{activeTab === "active" ? "🎉" : "📋"}</div>
              <h3 className="text-slate-200 font-semibold text-base">
                {activeTab === "active" ? "No Pending Reviews" : "No Resolved Items"}
              </h3>
              <p className="text-slate-400 text-xs mt-1">
                {activeTab === "active"
                  ? "All review items have been resolved or filtered out."
                  : "Items you resolve will appear in this history tab."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/90 text-slate-400 text-xs uppercase tracking-wider font-semibold">
                    <th className="px-6 py-3.5">Email ID</th>
                    <th className="px-6 py-3.5">Subject</th>
                    <th className="px-6 py-3.5">Category</th>
                    <th className="px-6 py-3.5">Priority</th>
                    <th className="px-6 py-3.5">Review Reason</th>
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
                    const pMeta = PRIORITY_COLORS[item.priority] || {
                      bg: "bg-slate-800",
                      text: "text-slate-300",
                      border: "border-slate-700",
                    };
                    return (
                      <tr
                        key={item.email_id}
                        onClick={() => handleOpenModal(item)}
                        className="hover:bg-indigo-950/20 cursor-pointer transition-colors group"
                      >
                        <td className="px-6 py-4 font-mono text-xs font-semibold text-indigo-400">
                          {item.email_id}
                        </td>
                        <td className="px-6 py-4 text-slate-200 font-medium group-hover:text-white transition-colors max-w-xs truncate">
                          {item.subject}
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 text-slate-300 text-xs font-medium">
                            {item.category}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${pMeta.bg} ${pMeta.text} ${pMeta.border}`}
                          >
                            {item.priority}
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
                        <td className="px-6 py-4">
                          {item.resolved ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                              RESOLVED ({item.resolutionOutcome})
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                              {item.status}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenModal(item);
                            }}
                            className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                              item.resolved
                                ? "bg-slate-800 border-slate-700 text-slate-400 hover:text-white"
                                : "bg-indigo-600/20 hover:bg-indigo-600 border-indigo-500/30 hover:border-indigo-500 text-indigo-300 hover:text-white"
                            }`}
                          >
                            {item.resolved ? "View Resolution" : "Review Item"}
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

      {/* Reason-Specific Review / Resolve Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full p-6 shadow-2xl flex flex-col gap-5 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div>
                <span className="font-mono text-xs font-semibold text-indigo-400">
                  {selectedItem.email_id}
                </span>
                <h3 className="text-lg font-bold text-white mt-1">{selectedItem.subject}</h3>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="text-slate-400 hover:text-white text-xl p-1"
              >
                ✕
              </button>
            </div>

            {/* 6 Required Fields Summary Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs">
              <div>
                <span className="text-slate-500 block mb-1">Email ID</span>
                <span className="font-mono font-semibold text-indigo-300">{selectedItem.email_id}</span>
              </div>
              <div>
                <span className="text-slate-500 block mb-1">Subject</span>
                <span className="font-medium text-slate-200 truncate block">{selectedItem.subject}</span>
              </div>
              <div>
                <span className="text-slate-500 block mb-1">Category</span>
                <span className="font-medium text-slate-200">{selectedItem.category}</span>
              </div>
              <div>
                <span className="text-slate-500 block mb-1">Priority</span>
                <span
                  className={`font-semibold ${
                    PRIORITY_COLORS[selectedItem.priority]?.text || "text-slate-200"
                  }`}
                >
                  {selectedItem.priority}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block mb-1">Review Reason</span>
                <span className="font-medium text-slate-200">{selectedItem.review_reason}</span>
              </div>
              <div>
                <span className="text-slate-500 block mb-1">Current Status</span>
                <span
                  className={`font-semibold ${
                    selectedItem.resolved ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {selectedItem.status}
                </span>
              </div>
            </div>

            {/* Reason Banner */}
            <div
              className={`p-3.5 rounded-xl border flex items-center gap-3 text-xs ${
                REASON_COLORS[selectedItem.review_reason]?.bg || "bg-slate-800"
              } ${REASON_COLORS[selectedItem.review_reason]?.border || "border-slate-700"}`}
            >
              <span className="text-2xl">
                {REASON_COLORS[selectedItem.review_reason]?.icon || "⚠️"}
              </span>
              <div>
                <span
                  className={`font-semibold block ${
                    REASON_COLORS[selectedItem.review_reason]?.text || "text-slate-200"
                  }`}
                >
                  {REASON_COLORS[selectedItem.review_reason]?.label || selectedItem.review_reason}
                </span>
                <p className="text-slate-300 mt-0.5">{selectedItem.evidence.evidence_summary}</p>
              </div>
            </div>

            {/* Shipment Details & Review Evidence Section */}
            <div className="border border-slate-800 rounded-xl bg-slate-950 overflow-hidden">
              <div className="bg-slate-900/90 px-4 py-3 border-b border-slate-800 flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-200">🔍 Shipment Details Evidence (SI vs BL)</span>
                <div className="flex items-center gap-3 text-slate-400 text-[11px] font-mono">
                  <span>SI: {selectedItem.evidence.doc_si_name}</span>
                  <span>|</span>
                  <span className="text-indigo-400">BL: {selectedItem.evidence.doc_bl_name}</span>
                </div>
              </div>

              <div className="p-4 space-y-3">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-500 font-medium">
                      <th className="py-2 px-3">Field</th>
                      <th className="py-2 px-3">SI Reference (Read-Only)</th>
                      <th className="py-2 px-3">Original BL Value</th>
                      <th className="py-2 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {selectedItem.evidence.fields.map((f, idx) => (
                      <tr
                        key={idx}
                        className={
                          f.is_mismatch
                            ? f.is_missing
                              ? "bg-purple-950/20"
                              : "bg-amber-950/20"
                            : "hover:bg-slate-900/50"
                        }
                      >
                        <td className="py-2.5 px-3 font-semibold text-slate-300">{f.field_name}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-200">{f.si_value}</td>
                        <td className="py-2.5 px-3 font-mono">
                          <span
                            className={
                              f.is_missing
                                ? "text-rose-400 font-semibold px-2 py-0.5 rounded bg-rose-950/40 border border-rose-800/40"
                                : f.is_mismatch
                                ? "text-amber-300 font-semibold"
                                : "text-slate-200"
                            }
                          >
                            {f.bl_value}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          {f.is_mismatch ? (
                            <span className="text-amber-300 text-[11px] font-medium flex items-center gap-1">
                              <span>⚠️</span>
                              <span>Discrepancy</span>
                            </span>
                          ) : (
                            <span className="text-emerald-400 text-[11px] font-medium">✓ Match</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Resolution Form / Reason-Specific Workflow */}
            {selectedItem.resolved ? (
              <div className="bg-slate-950 border border-emerald-800/50 p-4 rounded-xl text-xs space-y-3">
                <div className="flex items-center justify-between text-emerald-400 font-semibold border-b border-slate-800 pb-2">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    Resolved Status: {selectedItem.resolutionOutcome}
                  </span>
                  <span className="text-slate-400 font-mono text-[11px]">
                    Resolved at: {selectedItem.resolvedAt}
                  </span>
                </div>

                <p className="text-slate-300">
                  <strong className="text-slate-400">Reviewer Note:</strong>{" "}
                  {selectedItem.resolutionNotes}
                </p>

                {selectedItem.correctionsHistory && selectedItem.correctionsHistory.length > 0 && (
                  <div className="mt-3 bg-slate-900 p-3 rounded-lg border border-slate-800 space-y-2">
                    <span className="font-semibold text-slate-200 block text-[11px] uppercase tracking-wider">
                      🛠️ Human Verified Corrections Applied:
                    </span>
                    <div className="space-y-1.5 divide-y divide-slate-800">
                      {selectedItem.correctionsHistory.map((c, i) => (
                        <div key={i} className="pt-1.5 first:pt-0 grid grid-cols-4 gap-2 text-[11px]">
                          <span className="font-medium text-slate-300">{c.field_name}</span>
                          <span className="text-slate-400">SI: {c.si_value}</span>
                          <span className="text-rose-400 line-through">BL: {c.original_bl_value}</span>
                          <span className="text-emerald-400 font-semibold font-mono">
                            Verified: {c.corrected_bl_value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <form onSubmit={handleResolveSubmit} className="flex flex-col gap-4 text-xs">
                {/* 1. MISSING ATTACHMENT FLOW */}
                {selectedItem.review_reason === "missing_attachment" && (
                  <div className="bg-slate-950 p-4 rounded-xl border border-amber-800/40 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="font-semibold text-amber-300 flex items-center gap-1.5">
                        <span>⚠️</span> Document Checklist (Missing Attachment)
                      </span>
                      <span className="text-slate-400 text-[11px]">Do NOT create fake BL values</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-800/40 text-emerald-300 font-medium">
                        ✓ Shipping Instruction (SI): Present ({selectedItem.evidence.doc_si_name})
                      </div>
                      <div className="p-2.5 rounded-lg bg-rose-950/30 border border-rose-800/40 text-rose-300 font-medium">
                        ✗ Draft Bill of Lading (BL): MISSING
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-300 mb-2">Select Resolution Action:</label>
                      <div className="grid grid-cols-3 gap-3">
                        <button
                          type="button"
                          onClick={() => setActionChoice("CONFIRM_MISSING")}
                          className={`p-2.5 rounded-xl border font-semibold transition-all ${
                            actionChoice === "CONFIRM_MISSING"
                              ? "bg-amber-600 text-white border-amber-500 shadow-md"
                              : "bg-slate-900 border-slate-800 text-slate-400"
                          }`}
                        >
                          📩 Confirm BL Missing & Request Sender
                        </button>
                        <button
                          type="button"
                          onClick={() => setActionChoice("RECEIVED_SEPARATELY")}
                          className={`p-2.5 rounded-xl border font-semibold transition-all ${
                            actionChoice === "RECEIVED_SEPARATELY"
                              ? "bg-indigo-600 text-white border-indigo-500 shadow-md"
                              : "bg-slate-900 border-slate-800 text-slate-400"
                          }`}
                        >
                          📄 BL Received Separately (Offline)
                        </button>
                        <button
                          type="button"
                          onClick={() => setActionChoice("DISMISS")}
                          className={`p-2.5 rounded-xl border font-semibold transition-all ${
                            actionChoice === "DISMISS"
                              ? "bg-slate-700 text-white border-slate-600 shadow-md"
                              : "bg-slate-900 border-slate-800 text-slate-400"
                          }`}
                        >
                          ✕ Dismiss Issue
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. WRONG DOC TYPE FLOW */}
                {selectedItem.review_reason === "wrong_doc_type" && (
                  <div className="bg-slate-950 p-4 rounded-xl border border-purple-800/40 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="font-semibold text-purple-300 flex items-center gap-1.5">
                        <span>📄</span> Document Mismatch Escalation
                      </span>
                      <span className="text-slate-400 text-[11px]">Commercial Invoice attached instead of BL</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
                        <strong>Expected:</strong> Draft Bill of Lading (BL)
                      </div>
                      <div className="p-2.5 rounded-lg bg-purple-950/40 border border-purple-800/40 text-purple-300">
                        <strong>Received:</strong> Commercial Invoice ({selectedItem.evidence.doc_bl_name})
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-300 mb-2">Select Resolution Action:</label>
                      <div className="grid grid-cols-3 gap-3">
                        <button
                          type="button"
                          onClick={() => setActionChoice("CONFIRM_WRONG_DOC")}
                          className={`p-2.5 rounded-xl border font-semibold transition-all ${
                            actionChoice === "CONFIRM_WRONG_DOC"
                              ? "bg-purple-600 text-white border-purple-500 shadow-md"
                              : "bg-slate-900 border-slate-800 text-slate-400"
                          }`}
                        >
                          🚫 Confirm Wrong Doc & Request BL
                        </button>
                        <button
                          type="button"
                          onClick={() => setActionChoice("REPLACEMENT_RECEIVED")}
                          className={`p-2.5 rounded-xl border font-semibold transition-all ${
                            actionChoice === "REPLACEMENT_RECEIVED"
                              ? "bg-indigo-600 text-white border-indigo-500 shadow-md"
                              : "bg-slate-900 border-slate-800 text-slate-400"
                          }`}
                        >
                          📄 Correct Document Received
                        </button>
                        <button
                          type="button"
                          onClick={() => setActionChoice("DISMISS")}
                          className={`p-2.5 rounded-xl border font-semibold transition-all ${
                            actionChoice === "DISMISS"
                              ? "bg-slate-700 text-white border-slate-600 shadow-md"
                              : "bg-slate-900 border-slate-800 text-slate-400"
                          }`}
                        >
                          ✕ Dismiss Issue
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. UNREADABLE FLOW */}
                {selectedItem.review_reason === "unreadable" && (
                  <div className="bg-slate-950 p-4 rounded-xl border border-rose-800/40 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="font-semibold text-rose-300 flex items-center gap-1.5">
                        <span>🚫</span> Unreadable Scan Resolution
                      </span>
                      <span className="text-slate-400 text-[11px]">Rasterized image PDF / 0 OCR text</span>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-300 mb-2">Select Resolution Action:</label>
                      <div className="grid grid-cols-3 gap-3">
                        <button
                          type="button"
                          onClick={() => setActionChoice("CONFIRM_UNREADABLE")}
                          className={`p-2.5 rounded-xl border font-semibold transition-all ${
                            actionChoice === "CONFIRM_UNREADABLE"
                              ? "bg-rose-600 text-white border-rose-500 shadow-md"
                              : "bg-slate-900 border-slate-800 text-slate-400"
                          }`}
                        >
                          🔍 Confirm Unreadable & Request Rescan
                        </button>
                        <button
                          type="button"
                          onClick={() => setActionChoice("HUMAN_VERIFIED")}
                          className={`p-2.5 rounded-xl border font-semibold transition-all ${
                            actionChoice === "HUMAN_VERIFIED"
                              ? "bg-indigo-600 text-white border-indigo-500 shadow-md"
                              : "bg-slate-900 border-slate-800 text-slate-400"
                          }`}
                        >
                          ✍️ Human Verified Manual Entry
                        </button>
                        <button
                          type="button"
                          onClick={() => setActionChoice("DISMISS")}
                          className={`p-2.5 rounded-xl border font-semibold transition-all ${
                            actionChoice === "DISMISS"
                              ? "bg-slate-700 text-white border-slate-600 shadow-md"
                              : "bg-slate-900 border-slate-800 text-slate-400"
                          }`}
                        >
                          ✕ Dismiss Issue
                        </button>
                      </div>
                    </div>

                    {/* Show manual input only if HUMAN_VERIFIED chosen */}
                    {actionChoice === "HUMAN_VERIFIED" && (
                      <div className="mt-3 p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                        <span className="font-semibold text-indigo-300 text-xs block">
                          ✍️ Enter Human Verified Values (Marked as Verified):
                        </span>
                        <div className="space-y-2">
                          {selectedItem.evidence.fields.map((f, i) => (
                            <div key={i} className="grid grid-cols-3 gap-2 items-center text-xs">
                              <span className="text-slate-300 font-medium">{f.field_name}</span>
                              <span className="text-slate-500 font-mono text-[11px]">SI: {f.si_value}</span>
                              <input
                                type="text"
                                value={correctionsInput[f.field_name] || ""}
                                onChange={(e) => handleCorrectionChange(f.field_name, e.target.value)}
                                placeholder={`Verified ${f.field_name}...`}
                                className="px-3 py-1 rounded bg-slate-950 border border-slate-800 text-emerald-300 font-mono text-xs focus:outline-none focus:border-indigo-500"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 4. MISSING VALUE FLOW */}
                {selectedItem.review_reason === "missing_value" && (
                  <div className="bg-slate-950 p-4 rounded-xl border border-cyan-800/40 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="font-semibold text-cyan-300 flex items-center gap-1.5">
                        <span>❓</span> Field Correction Form (Blank / Placeholder Tokens)
                      </span>
                      <span className="text-slate-400 text-[11px]">SI values are read-only references</span>
                    </div>

                    <div className="space-y-3">
                      {selectedItem.evidence.fields.map((f, idx) => (
                        <div
                          key={idx}
                          className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-center bg-slate-900 p-2.5 rounded-lg border border-slate-800"
                        >
                          <div className="sm:col-span-1">
                            <span className="font-semibold text-slate-300 block">{f.field_name}</span>
                            <span className="text-[10px] text-slate-500">
                              SI Ref: <strong className="text-slate-300 font-mono">{f.si_value}</strong>
                            </span>
                          </div>

                          <div className="text-[11px] text-slate-400 sm:col-span-1">
                            Orig BL: <span className="text-rose-400 font-mono">{f.bl_value}</span>
                          </div>

                          <div className="sm:col-span-2">
                            <input
                              type="text"
                              value={correctionsInput[f.field_name] || ""}
                              onChange={(e) => handleCorrectionChange(f.field_name, e.target.value)}
                              placeholder={`Corrected BL ${f.field_name}...`}
                              className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-emerald-300 font-mono text-xs focus:outline-none focus:border-emerald-500"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block font-semibold text-slate-300 mb-1.5">Reviewer Note:</label>
                  <input
                    type="text"
                    placeholder="Enter audit resolution notes..."
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setSelectedItem(null)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-all shadow-lg shadow-indigo-600/30 flex items-center gap-2"
                  >
                    <span>Save Resolution</span>
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
