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

  return (
    <div className="min-h-screen bg-white text-slate-800 flex flex-col font-sans">
      {/* Navigation Header */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded bg-[#485C8B] flex items-center justify-center font-bold text-white text-xs tracking-wider">
              SD
            </div>
            <div>
              <h1 className="font-semibold text-[#485C8B] text-sm leading-tight">
                Shipping Document Verification System
              </h1>
              <span className="text-xs text-[#6F8AB7]">Operations Control Centre — Person D</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="px-2.5 py-1 rounded text-xs font-medium border border-[#FDD58D] bg-[#FFE7B7]/30 text-[#485C8B]">
              Static Preview Dataset (Offline Mode)
            </span>
          </div>
        </div>
      </header>

      {/* Toast Notification */}
      {successToast && (
        <div className="fixed top-16 right-6 z-50 bg-white border border-[#6F8AB7] text-[#485C8B] px-4 py-2.5 rounded shadow-sm flex items-center gap-2 text-xs font-medium">
          <span className="text-[#6F8AB7]">✓</span>
          <span>{successToast}</span>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto w-full px-6 py-6 flex-1 flex flex-col gap-5">
        {/* Operations Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <h2 className="text-xl font-bold text-[#485C8B] tracking-tight">Shipping Operations Control Centre</h2>
            <p className="text-xs text-[#6F8AB7] mt-0.5 max-w-2xl">
              End-to-end verification pipeline metrics, edge-case breakdown, and reason-specific human resolution.
            </p>
          </div>
          <div className="flex items-center gap-2">
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
              <span className="text-2xl font-bold text-[#485C8B]">520</span>
              <span className="text-xs text-slate-400 font-mono">100% Volume</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded border border-slate-200 border-l-4 border-l-[#F6983E] flex flex-col justify-between">
            <span className="text-xs font-medium text-[#F6983E]">Needs Human Review</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-[#F6983E]">42</span>
              <span className="text-xs text-[#F6983E] font-medium">8.1% Escalated</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded border border-slate-200 flex flex-col justify-between">
            <span className="text-xs font-medium text-[#6F8AB7]">Verified Clean</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-[#485C8B]">318</span>
              <span className="text-xs text-slate-500 font-mono">61.2% Auto-Pass</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded border border-slate-200 flex flex-col justify-between">
            <span className="text-xs font-medium text-[#6F8AB7]">In Processing</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-[#485C8B]">160</span>
              <span className="text-xs text-slate-500 font-mono">30.7% Stage 1/2</span>
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
              <span className="text-xs text-[#6F8AB7]">Total Escalated: 42 Items</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded border border-slate-200 bg-white flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-600">Wrong Doc Type</span>
                <span className="text-xl font-bold text-[#485C8B]">5</span>
                <span className="text-[11px] text-slate-400">Invoice / Packing List</span>
              </div>

              <div className="p-3 rounded border border-[#FDD58D] bg-[#FFE7B7]/20 flex flex-col gap-1">
                <span className="text-xs font-medium text-[#F6983E]">Missing Attachment</span>
                <span className="text-xl font-bold text-[#F6983E]">8</span>
                <span className="text-[11px] text-slate-500">Single File Received</span>
              </div>

              <div className="p-3 rounded border border-[#FDD58D] bg-[#FFE7B7]/20 flex flex-col gap-1">
                <span className="text-xs font-medium text-[#F6983E]">Unreadable File</span>
                <span className="text-xl font-bold text-[#F6983E]">11</span>
                <span className="text-[11px] text-slate-500">Scanned / 0 Bytes</span>
              </div>

              <div className="p-3 rounded border border-slate-200 bg-white flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-600">Missing Value</span>
                <span className="text-xl font-bold text-[#485C8B]">18</span>
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
                91.9% Operational
              </span>
            </div>

            <div className="space-y-3">
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden flex border border-slate-200">
                <div className="h-full bg-[#485C8B]" style={{ width: "61.2%" }} title="Verified Clean: 61.2%"></div>
                <div className="h-full bg-[#6F8AB7]" style={{ width: "30.7%" }} title="Processing: 30.7%"></div>
                <div className="h-full bg-[#F6983E]" style={{ width: "8.1%" }} title="Needs Review: 8.1%"></div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-[11px]">
                <div className="flex items-center gap-1.5 text-slate-600">
                  <span className="w-2 h-2 rounded-full bg-[#485C8B] inline-block"></span>
                  <span>Verified: 61.2%</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-600">
                  <span className="w-2 h-2 rounded-full bg-[#6F8AB7] inline-block"></span>
                  <span>Processing: 30.7%</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-600">
                  <span className="w-2 h-2 rounded-full bg-[#F6983E] inline-block"></span>
                  <span>Review: 8.1%</span>
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
          {filteredItems.length === 0 ? (
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
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded border border-slate-200 text-xs">
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

            {/* Reason Attention Banner */}
            <div className="p-3 rounded border border-[#FDD58D] bg-[#FFE7B7]/30 text-xs flex flex-col gap-1">
              <span className="font-semibold text-[#F6983E]">
                {REASON_COLORS[selectedItem.review_reason]?.label || selectedItem.review_reason}
              </span>
              <p className="text-slate-700">{selectedItem.evidence.evidence_summary}</p>
            </div>

            {/* Shipment Details & Evidence Section */}
            <div className="border border-slate-200 rounded overflow-hidden">
              <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between text-xs font-semibold">
                <span className="text-[#485C8B]">Shipment Comparison Evidence (SI vs BL)</span>
                <div className="flex items-center gap-2 text-slate-500 text-[11px] font-mono">
                  <span>SI: {selectedItem.evidence.doc_si_name}</span>
                  <span>|</span>
                  <span className="text-[#485C8B]">BL: {selectedItem.evidence.doc_bl_name}</span>
                </div>
              </div>

              <div className="p-3">
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
                        ✓ Shipping Instruction (SI): Present ({selectedItem.evidence.doc_si_name})
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
                        <strong>Received:</strong> Commercial Invoice ({selectedItem.evidence.doc_bl_name})
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
                          {selectedItem.evidence.fields.map((f, i) => (
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
                          ))}
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
                      {selectedItem.evidence.fields.map((f, idx) => (
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
                      ))}
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
