"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, useCallback } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface SITemplate {
  id: string;
  name: string;
  company_header: string;
  document_title: string;
  default_instructions?: string;
  is_custom?: boolean;
}

const DEFAULT_TEMPLATES: SITemplate[] = [
  {
    id: "averis_default",
    name: "Averis Global Logistics (Standard)",
    company_header: "AVERIS GLOBAL LOGISTICS",
    document_title: "SHIPPING DOCUMENTATION SERVICES",
  },
  {
    id: "april_fine_paper",
    name: "APRIL Fine Paper Trading",
    company_header: "APRIL FINE PAPER TRADING",
    document_title: "OFFICIAL MARITIME SHIPPING INSTRUCTION",
  },
  {
    id: "asia_symbol",
    name: "Asia Symbol Pulp & Paper",
    company_header: "ASIA SYMBOL PULP & PAPER",
    document_title: "SHIPPING DOCUMENTATION & LOGISTICS SERVICES",
  },
];

interface CustomField {
  label: string;
  value: string;
}

interface SIDraft {
  email_id: string;
  template: string;
  company_header?: string | null;
  document_title?: string | null;
  booking_ref: string | null;
  shipper: string | null;
  consignee: string | null;
  notify_party: string | null;
  port_of_loading: string | null;
  port_of_discharge: string | null;
  container_count: number | null;
  container_type: string | null;
  gross_weight_kg: number | null;
  cargo_description: string | null;
  hs_code: string | null;
  vessel_name: string | null;
  voyage_no: string | null;
  freight_term: string | null;
  special_instructions: string | null;
  custom_fields?: CustomField[];
  sender_email: string | null;
  email_subject: string | null;
  raw_email_body?: string | null;
  missing_fields: string[];
  draft_email_response: string | null;
  status: "COMPLETE" | "MISSING_INFO";
}

function SICreationContent() {
  const searchParams = useSearchParams();
  const emailId = searchParams.get("email_id") || "email_007";

  const [draft, setDraft] = useState<SIDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [updatingPreview, setUpdatingPreview] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"document" | "original" | "email">("document");
  const [resolvedMissing, setResolvedMissing] = useState<Record<string, boolean>>({});

  // Template Management State
  const [templates, setTemplates] = useState<SITemplate[]>(DEFAULT_TEMPLATES);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string>("averis_default");
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [tplFormName, setTplFormName] = useState("");
  const [tplFormHeader, setTplFormHeader] = useState("");
  const [tplFormTitle, setTplFormTitle] = useState("");
  const [tplFormClauses, setTplFormClauses] = useState("");

  // Load custom templates from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("averis_si_custom_templates");
      if (stored) {
        const parsed: SITemplate[] = JSON.parse(stored);
        setTemplates([...DEFAULT_TEMPLATES, ...parsed]);
      }
    } catch {
      // ignore JSON parse error
    }
  }, []);

  // Function to generate the live PDF blob from current draft state
  const fetchPdfBlob = useCallback(async (currentDraft: SIDraft) => {
    setUpdatingPreview(true);
    try {
      const res = await fetch(`${API_URL}/si/export-pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(currentDraft),
      });
      if (!res.ok) throw new Error("Could not render live PDF preview.");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setPdfPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
    } catch (err) {
      console.error("Live PDF preview error:", err);
    } finally {
      setUpdatingPreview(false);
    }
  }, []);

  useEffect(() => {
    async function loadDraft() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_URL}/si/draft/${emailId}`, {
          method: "POST",
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail || "Could not generate SI draft.");
        }
        const data: SIDraft = await res.json();
        if (!data.custom_fields) data.custom_fields = [];
        setDraft(data);
        // Load initial live PDF preview
        void fetchPdfBlob(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load draft SI.");
      } finally {
        setLoading(false);
      }
    }
    void loadDraft();
  }, [emailId, fetchPdfBlob]);

  const updateField = (field: keyof SIDraft, value: unknown) => {
    if (!draft) return;
    const updated = {
      ...draft,
      [field]: value,
    };
    setDraft(updated);
  };

  // Helper to determine if a missing field is waived/resolved or filled
  const isFieldResolved = useCallback(
    (fieldLabel: string): boolean => {
      if (resolvedMissing[fieldLabel]) return true;
      if (!draft) return false;
      if (fieldLabel.includes("Vessel") && draft.vessel_name && draft.vessel_name.trim()) return true;
      if (fieldLabel.includes("Voyage") && draft.voyage_no && draft.voyage_no.trim()) return true;
      if (fieldLabel.includes("Booking") && draft.booking_ref && draft.booking_ref.trim()) return true;
      if (fieldLabel.includes("Shipper") && draft.shipper && draft.shipper.trim()) return true;
      if (fieldLabel.includes("Consignee") && draft.consignee && draft.consignee.trim()) return true;
      if (fieldLabel.includes("Notify") && draft.notify_party && draft.notify_party.trim()) return true;
      if (fieldLabel.includes("POL") && draft.port_of_loading && draft.port_of_loading.trim()) return true;
      if (fieldLabel.includes("POD") && draft.port_of_discharge && draft.port_of_discharge.trim()) return true;
      if (fieldLabel.includes("Container") && draft.container_count) return true;
      if (fieldLabel.includes("Weight") && draft.gross_weight_kg) return true;
      if (fieldLabel.includes("Cargo") && draft.cargo_description && draft.cargo_description.trim()) return true;
      return false;
    },
    [draft, resolvedMissing]
  );

  const activeMissing = (draft?.missing_fields || []).filter(
    (f) => !isFieldResolved(f)
  );
  const hasUnresolved = activeMissing.length > 0;

  // Email Draft Generators
  const generateConfirmationEmail = useCallback((d: SIDraft): string => {
    const recipientName = d.sender_email
      ? d.sender_email.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
      : "Valued Partner";
    const refMention = d.booking_ref ? ` for Booking Ref: ${d.booking_ref}` : "";
    const vesselStr = `${d.vessel_name || "Pending Carrier Schedule"} / ${d.voyage_no || "Pending"}`;
    const cntrStr = `${d.container_count || 1} x ${d.container_type || "20GP"}`;
    const wtStr = d.gross_weight_kg ? `${d.gross_weight_kg.toLocaleString()} KG` : "As per packing list";

    return (
      `Dear ${recipientName},\n\n` +
      `Thank you for your Shipping Instruction request${refMention}.\n\n` +
      `We are pleased to confirm that all required shipping particulars have been verified and found in order. ` +
      `The official Shipping Instruction (SI) has been successfully created and lodged with the ocean carrier for Bill of Lading generation.\n\n` +
      `Key Shipment Particulars Confirmed:\n` +
      `  - Booking Reference: ${d.booking_ref || "N/A"}\n` +
      `  - Ocean Vessel / Voyage: ${vesselStr}\n` +
      `  - Port of Loading (POL): ${d.port_of_loading || "N/A"}\n` +
      `  - Port of Discharge (POD): ${d.port_of_discharge || "N/A"}\n` +
      `  - Container Particulars: ${cntrStr} (${wtStr})\n` +
      `  - Freight Terms: ${d.freight_term || "CFR TERM"}\n\n` +
      `The carrier will issue the draft Bill of Lading (B/L) in due course. ` +
      `We will promptly forward the draft B/L for your final review and approval as soon as it is released.\n\n` +
      `Best regards,\n` +
      `Shipping Documentation Team\n` +
      `Averis Global Logistics Services`
    );
  }, []);

  const generateInquiryEmail = useCallback((d: SIDraft, missingList: string[]): string => {
    const recipientName = d.sender_email
      ? d.sender_email.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
      : "Valued Partner";
    const refMention = d.booking_ref ? ` for Booking Ref: ${d.booking_ref}` : "";
    const itemsList = missingList.map((f) => `  - ${f}`).join("\n");

    return (
      `Dear ${recipientName},\n\n` +
      `Thank you for your Shipping Instruction request${refMention}.\n\n` +
      `We have compiled the draft Shipping Instruction based on the details provided. ` +
      `However, to finalize the SI and confirm booking with the ocean carrier, ` +
      `please provide the following missing information at your earliest convenience:\n\n` +
      `${itemsList}\n\n` +
      `Once received, we will promptly finalize the SI and transmit it to the carrier to generate your draft Bill of Lading.\n\n` +
      `Best regards,\n` +
      `Shipping Documentation Team\n` +
      `Averis Global Logistics Services`
    );
  }, []);

  const toggleResolveMissing = (fieldLabel: string) => {
    if (!draft) return;
    const willBeResolved = !resolvedMissing[fieldLabel];
    const newResolved = { ...resolvedMissing, [fieldLabel]: willBeResolved };
    setResolvedMissing(newResolved);

    const remaining = (draft.missing_fields || []).filter((f) => {
      if (newResolved[f]) return false;
      if (f.includes("Vessel") && draft.vessel_name?.trim()) return false;
      if (f.includes("Voyage") && draft.voyage_no?.trim()) return false;
      if (f.includes("Booking") && draft.booking_ref?.trim()) return false;
      if (f.includes("Shipper") && draft.shipper?.trim()) return false;
      if (f.includes("Consignee") && draft.consignee?.trim()) return false;
      if (f.includes("Notify") && draft.notify_party?.trim()) return false;
      if (f.includes("POL") && draft.port_of_loading?.trim()) return false;
      if (f.includes("POD") && draft.port_of_discharge?.trim()) return false;
      if (f.includes("Container") && draft.container_count) return false;
      if (f.includes("Weight") && draft.gross_weight_kg) return false;
      if (f.includes("Cargo") && draft.cargo_description?.trim()) return false;
      return true;
    });

    if (remaining.length === 0) {
      updateField("draft_email_response", generateConfirmationEmail(draft));
    } else {
      updateField("draft_email_response", generateInquiryEmail(draft, remaining));
    }
  };

  const resolveAllMissing = () => {
    if (!draft) return;
    const next: Record<string, boolean> = {};
    (draft.missing_fields || []).forEach((f) => {
      next[f] = true;
    });
    setResolvedMissing(next);
    updateField("draft_email_response", generateConfirmationEmail(draft));
  };

  // Custom Fields Handlers
  const handleAddCustomField = () => {
    if (!draft) return;
    const current = draft.custom_fields || [];
    updateField("custom_fields", [...current, { label: "", value: "" }]);
  };

  const handleUpdateCustomField = (index: number, key: "label" | "value", val: string) => {
    if (!draft) return;
    const current = [...(draft.custom_fields || [])];
    current[index] = { ...current[index], [key]: val };
    updateField("custom_fields", current);
  };

  const handleRemoveCustomField = (index: number) => {
    if (!draft) return;
    const current = [...(draft.custom_fields || [])];
    current.splice(index, 1);
    updateField("custom_fields", current);
  };

  const handleTemplateChange = (templateId: string) => {
    if (!draft) return;
    const matched = templates.find((t) => t.id === templateId);
    if (!matched) return;

    const updated: SIDraft = {
      ...draft,
      template: matched.id,
      company_header: matched.company_header,
      document_title: matched.document_title,
      special_instructions: matched.default_instructions || draft.special_instructions,
    };
    setDraft(updated);
    void fetchPdfBlob(updated);
  };

  const openTemplateModal = () => {
    const currentId = draft?.template || templates[0].id;
    const tpl = templates.find((t) => t.id === currentId) || templates[0];
    setEditingTemplateId(tpl.id);
    setIsCreatingNew(false);
    setTplFormName(tpl.name);
    setTplFormHeader(tpl.company_header);
    setTplFormTitle(tpl.document_title);
    setTplFormClauses(tpl.default_instructions || "");
    setShowTemplateModal(true);
  };

  const selectTemplateForEdit = (tpl: SITemplate) => {
    setEditingTemplateId(tpl.id);
    setIsCreatingNew(false);
    setTplFormName(tpl.name);
    setTplFormHeader(tpl.company_header);
    setTplFormTitle(tpl.document_title);
    setTplFormClauses(tpl.default_instructions || "");
  };

  const handleStartNewTemplate = () => {
    setIsCreatingNew(true);
    setEditingTemplateId("");
    setTplFormName("");
    setTplFormHeader("");
    setTplFormTitle("MARITIME SHIPPING INSTRUCTION");
    setTplFormClauses("");
  };

  const handleSaveTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tplFormName.trim() || !tplFormHeader.trim()) {
      alert("Please enter both a Template Name and Company Header.");
      return;
    }

    let updatedList: SITemplate[];
    let targetId: string;

    if (isCreatingNew) {
      targetId = `custom_${Date.now()}`;
      const newTpl: SITemplate = {
        id: targetId,
        name: tplFormName.trim(),
        company_header: tplFormHeader.trim().toUpperCase(),
        document_title: (tplFormTitle.trim() || "MARITIME SHIPPING INSTRUCTION").toUpperCase(),
        default_instructions: tplFormClauses.trim() || undefined,
        is_custom: true,
      };
      updatedList = [...templates, newTpl];
    } else {
      targetId = editingTemplateId;
      updatedList = templates.map((t) => {
        if (t.id === editingTemplateId) {
          return {
            ...t,
            name: tplFormName.trim(),
            company_header: tplFormHeader.trim().toUpperCase(),
            document_title: (tplFormTitle.trim() || "MARITIME SHIPPING INSTRUCTION").toUpperCase(),
            default_instructions: tplFormClauses.trim() || undefined,
          };
        }
        return t;
      });
    }

    setTemplates(updatedList);
    const customOnly = updatedList.filter((t) => t.is_custom);
    try {
      localStorage.setItem("averis_si_custom_templates", JSON.stringify(customOnly));
    } catch {
      // storage unavailable
    }

    if (draft && (draft.template === targetId || isCreatingNew)) {
      const activeTpl = updatedList.find((t) => t.id === targetId);
      if (activeTpl) {
        const updatedDraft: SIDraft = {
          ...draft,
          template: activeTpl.id,
          company_header: activeTpl.company_header,
          document_title: activeTpl.document_title,
          special_instructions: activeTpl.default_instructions || draft.special_instructions,
        };
        setDraft(updatedDraft);
        void fetchPdfBlob(updatedDraft);
      }
    }

    setIsCreatingNew(false);
    setEditingTemplateId(targetId);
  };

  const handleDeleteTemplate = (idToDelete: string) => {
    if (templates.length <= 1) {
      alert("At least one template must remain.");
      return;
    }
    const tplToDelete = templates.find((t) => t.id === idToDelete);
    if (!tplToDelete) return;
    if (!confirm(`Delete template "${tplToDelete.name}"?`)) return;

    const updatedList = templates.filter((t) => t.id !== idToDelete);
    setTemplates(updatedList);

    const customOnly = updatedList.filter((t) => t.is_custom);
    try {
      localStorage.setItem("averis_si_custom_templates", JSON.stringify(customOnly));
    } catch {
      // storage unavailable
    }

    const fallback = updatedList[0];
    if (draft && draft.template === idToDelete) {
      const updatedDraft: SIDraft = {
        ...draft,
        template: fallback.id,
        company_header: fallback.company_header,
        document_title: fallback.document_title,
        special_instructions: fallback.default_instructions || draft.special_instructions,
      };
      setDraft(updatedDraft);
      void fetchPdfBlob(updatedDraft);
    }

    selectTemplateForEdit(fallback);
  };

  const handleDownloadPdf = async () => {
    if (!draft) return;
    setDownloading(true);
    try {
      const res = await fetch(`${API_URL}/si/export-pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!res.ok) throw new Error("Could not export PDF.");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `SI_${draft.booking_ref || draft.email_id}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      alert(err instanceof Error ? err.message : "PDF export failed.");
    } finally {
      setDownloading(false);
    }
  };

  const handleCopyEmail = () => {
    if (!draft?.draft_email_response) return;
    navigator.clipboard.writeText(draft.draft_email_response);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2500);
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 px-6 py-12 text-gray-900">
        <div className="mx-auto max-w-5xl rounded-xl border border-gray-200 bg-white p-12 text-center shadow-sm">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-navy border-t-transparent"></div>
          <p className="mt-4 text-base font-medium text-gray-700">Extracting Shipping Instruction details…</p>
        </div>
      </main>
    );
  }

  if (error || !draft) {
    return (
      <main className="min-h-screen bg-gray-50 px-6 py-12 text-gray-900">
        <div className="mx-auto max-w-xl rounded-xl border border-red-300 bg-red-50 p-8 text-center text-red-800 shadow-sm">
          <h2 className="text-lg font-bold">Error Generating SI Draft</h2>
          <p className="mt-2 text-sm">{error || "Could not retrieve email data."}</p>
          <div className="mt-6 flex justify-center gap-3">
            <Link href="/extraction" className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
              ← Inbox
            </Link>
            <button
              onClick={() => window.location.reload()}
              className="rounded-lg bg-navy px-4 py-2 text-sm text-white hover:bg-navy/90"
            >
              Retry
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      {/* Top Navigation Bar */}
      <nav className="border-b border-gray-200 bg-white px-6 py-3 shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/extraction"
              className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
            >
              ← 
            </Link>
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-bold text-gray-800">
              {draft.email_id}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {hasUnresolved ? (
              <span className="flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                {activeMissing.length} Missing Fields
              </span>
            ) : (
              <span className="flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                Ready for Submission
              </span>
            )}
          </div>
        </div>
      </nav>

      {/* Main Workspace */}
      <section className="mx-auto max-w-7xl px-6 py-6">
        {/* Template & Entity Switcher Header */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#FDD58D] bg-white p-4 shadow-sm">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[#485C8B]">
              Shipping Instruction Editor
            </h1>
            <p className="text-xs text-[#6F8AB7]">
              Source: <span className="font-semibold text-[#485C8B]">{draft.email_subject}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-[#6F8AB7]">
              Template:
            </label>
            <select
              value={draft.template}
              onChange={(e) => handleTemplateChange(e.target.value)}
              className="cursor-pointer rounded-lg border border-[#B9C8DF] bg-white px-3 py-1.5 text-xs font-semibold text-[#485C8B] shadow-sm"
            >
              {templates.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  {tpl.is_custom ? `[Custom] ${tpl.name}` : tpl.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={openTemplateModal}
              className="cursor-pointer rounded-lg border border-[#6F8AB7] bg-[#EAF0F8] px-3 py-1.5 text-xs font-semibold text-[#485C8B] hover:bg-[#d5e2f5]"
            >
              Edit Templates
            </button>
          </div>
        </div>

        {/* Workspace 2-Column Grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left Column: Form Editor (6 Cols) */}
          <div className="space-y-6 lg:col-span-6">
            {/* Box 1: Reference & Vessel Schedule */}
            <div className="rounded-xl border border-[#B9C8DF] bg-white p-5 shadow-sm">
              <h2 className="mb-3 border-b border-[#FDD58D] pb-2 text-xs font-bold uppercase tracking-wider text-[#6F8AB7]">
                1. Booking & Vessel
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#485C8B]">Booking Ref</label>
                  <input
                    type="text"
                    value={draft.booking_ref || ""}
                    onChange={(e) => updateField("booking_ref", e.target.value)}
                    placeholder="e.g. 5RFR-37631"
                    className="w-full rounded-md border border-[#B9C8DF] px-3 py-1.5 text-sm outline-none focus:border-[#6F8AB7]"
                  />
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <label className="block text-xs font-medium text-[#485C8B]">Vessel Name</label>
                    {!draft.vessel_name && (
                      isFieldResolved("Vessel Name") ? (
                        <span className="flex items-center gap-1 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                          Resolved
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
                          Missing
                        </span>
                      )
                    )}
                  </div>
                  <input
                    type="text"
                    value={draft.vessel_name || ""}
                    onChange={(e) => updateField("vessel_name", e.target.value)}
                    placeholder="e.g. MMSS 2507"
                    className={`w-full rounded-md border px-3 py-1.5 text-sm outline-none ${
                      !draft.vessel_name && !isFieldResolved("Vessel Name")
                        ? "border-amber-400 bg-amber-50/50"
                        : "border-[#B9C8DF]"
                    }`}
                  />
                  {!draft.vessel_name && (
                    <div className="group relative mt-1.5">
                      {isFieldResolved("Vessel Name") ? (
                        <button
                          type="button"
                          onClick={() => toggleResolveMissing("Vessel Name")}
                          className="w-full cursor-pointer rounded-md border border-emerald-300 bg-emerald-50 py-1 text-center text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition"
                        >
                          Unresolve
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => toggleResolveMissing("Vessel Name")}
                          className="w-full cursor-pointer rounded-md border border-amber-300 bg-amber-50 py-1 text-center text-xs font-semibold text-amber-900 hover:bg-amber-100 transition"
                        >
                          Resolve
                        </button>
                      )}
                      {/* Tooltip on Hover */}
                      <div className="pointer-events-none absolute bottom-full left-1/2 mb-1.5 hidden -translate-x-1/2 rounded-md bg-slate-800 px-2.5 py-1 text-[11px] leading-tight text-white shadow-md group-hover:block z-20 w-56 text-center">
                        {isFieldResolved("Vessel Name")
                          ? "Click to mark back as missing"
                          : "Resolves this field without requiring you to enter any value."}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <label className="block text-xs font-medium text-[#485C8B]">Voyage No.</label>
                    {!draft.voyage_no && (
                      isFieldResolved("Voyage Number") ? (
                        <span className="flex items-center gap-1 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                          Resolved
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
                          Missing
                        </span>
                      )
                    )}
                  </div>
                  <input
                    type="text"
                    value={draft.voyage_no || ""}
                    onChange={(e) => updateField("voyage_no", e.target.value)}
                    placeholder="e.g. 11S"
                    className={`w-full rounded-md border px-3 py-1.5 text-sm outline-none ${
                      !draft.voyage_no && !isFieldResolved("Voyage Number")
                        ? "border-amber-400 bg-amber-50/50"
                        : "border-[#B9C8DF]"
                    }`}
                  />
                  {!draft.voyage_no && (
                    <div className="group relative mt-1.5">
                      {isFieldResolved("Voyage Number") ? (
                        <button
                          type="button"
                          onClick={() => toggleResolveMissing("Voyage Number")}
                          className="w-full cursor-pointer rounded-md border border-emerald-300 bg-emerald-50 py-1 text-center text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition"
                        >
                          Unresolve
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => toggleResolveMissing("Voyage Number")}
                          className="w-full cursor-pointer rounded-md border border-amber-300 bg-amber-50 py-1 text-center text-xs font-semibold text-amber-900 hover:bg-amber-100 transition"
                        >
                          Resolve
                        </button>
                      )}
                      {/* Tooltip on Hover */}
                      <div className="pointer-events-none absolute bottom-full left-1/2 mb-1.5 hidden -translate-x-1/2 rounded-md bg-slate-800 px-2.5 py-1 text-[11px] leading-tight text-white shadow-md group-hover:block z-20 w-56 text-center">
                        {isFieldResolved("Voyage Number")
                          ? "Click to mark back as missing"
                          : "Resolves this field without requiring you to enter any value (e.g. carrier schedule pending)."}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Box 2: Shipment Parties */}
            <div className="rounded-xl border border-[#B9C8DF] bg-white p-5 shadow-sm">
              <h2 className="mb-3 border-b border-[#FDD58D] pb-2 text-xs font-bold uppercase tracking-wider text-[#6F8AB7]">
                2. Shipment Parties
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#485C8B]">
                    Shipper / Exporter
                  </label>
                  <textarea
                    rows={4}
                    value={draft.shipper || ""}
                    onChange={(e) => updateField("shipper", e.target.value)}
                    placeholder="Company name, registered address, contact details"
                    className="w-full rounded-md border border-[#B9C8DF] px-3 py-2 text-xs leading-relaxed outline-none focus:border-[#6F8AB7]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#485C8B]">
                    Consignee
                  </label>
                  <textarea
                    rows={4}
                    value={draft.consignee || ""}
                    onChange={(e) => updateField("consignee", e.target.value)}
                    placeholder="Consignee name, registered address, tax ID (or TO ORDER)"
                    className="w-full rounded-md border border-[#B9C8DF] px-3 py-2 text-xs leading-relaxed outline-none focus:border-[#6F8AB7]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#485C8B]">
                    Notify Party
                  </label>
                  <textarea
                    rows={4}
                    value={draft.notify_party || ""}
                    onChange={(e) => updateField("notify_party", e.target.value)}
                    placeholder="Notify party name, address, contact details"
                    className="w-full rounded-md border border-[#B9C8DF] px-3 py-2 text-xs leading-relaxed outline-none focus:border-[#6F8AB7]"
                  />
                </div>
              </div>
            </div>

            {/* Box 3: Routing & Port Details */}
            <div className="rounded-xl border border-[#B9C8DF] bg-white p-5 shadow-sm">
              <h2 className="mb-3 border-b border-[#FDD58D] pb-2 text-xs font-bold uppercase tracking-wider text-[#6F8AB7]">
                3. Ports & Routing
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#485C8B]">Port of Loading (POL)</label>
                  <input
                    type="text"
                    value={draft.port_of_loading || ""}
                    onChange={(e) => updateField("port_of_loading", e.target.value)}
                    className="w-full rounded-md border border-[#B9C8DF] px-3 py-2 text-sm outline-none focus:border-[#6F8AB7]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#485C8B]">Port of Discharge (POD)</label>
                  <input
                    type="text"
                    value={draft.port_of_discharge || ""}
                    onChange={(e) => updateField("port_of_discharge", e.target.value)}
                    className="w-full rounded-md border border-[#B9C8DF] px-3 py-2 text-sm outline-none focus:border-[#6F8AB7]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#485C8B]">Freight Terms</label>
                  <input
                    type="text"
                    value={draft.freight_term || "CFR TERM"}
                    onChange={(e) => updateField("freight_term", e.target.value)}
                    className="w-full rounded-md border border-[#B9C8DF] px-3 py-2 text-sm outline-none focus:border-[#6F8AB7]"
                  />
                </div>
              </div>
            </div>

            {/* Box 4: Cargo & Containers */}
            <div className="rounded-xl border border-[#B9C8DF] bg-white p-5 shadow-sm">
              <h2 className="mb-3 border-b border-[#FDD58D] pb-2 text-xs font-bold uppercase tracking-wider text-[#6F8AB7]">
                4. Cargo & Containers
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="min-w-0">
                  <label className="mb-1 block text-xs font-medium text-[#485C8B]">Containers (Count & Type)</label>
                  <div className="flex min-w-0 gap-1.5">
                    <input
                      type="number"
                      min="1"
                      value={draft.container_count ?? ""}
                      onChange={(e) => updateField("container_count", parseInt(e.target.value) || null)}
                      placeholder="Qty"
                      className="w-16 shrink-0 rounded-md border border-[#B9C8DF] px-2 py-1.5 text-xs outline-none focus:border-[#6F8AB7]"
                    />
                    <input
                      type="text"
                      value={draft.container_type || ""}
                      onChange={(e) => updateField("container_type", e.target.value)}
                      placeholder="20'GP / 40'HC"
                      className="min-w-0 flex-1 rounded-md border border-[#B9C8DF] px-2.5 py-1.5 text-xs outline-none focus:border-[#6F8AB7]"
                    />
                  </div>
                </div>
                <div className="min-w-0">
                  <label className="mb-1 block text-xs font-medium text-[#485C8B]">Gross Weight (KG)</label>
                  <input
                    type="number"
                    value={draft.gross_weight_kg ?? ""}
                    onChange={(e) => updateField("gross_weight_kg", parseFloat(e.target.value) || null)}
                    className="w-full rounded-md border border-[#B9C8DF] px-3 py-1.5 text-xs outline-none focus:border-[#6F8AB7]"
                  />
                </div>
                <div className="min-w-0">
                  <label className="mb-1 block text-xs font-medium text-[#485C8B]">HS Code</label>
                  <input
                    type="text"
                    value={draft.hs_code || ""}
                    onChange={(e) => updateField("hs_code", e.target.value)}
                    placeholder="e.g. 48109200"
                    className="w-full rounded-md border border-[#B9C8DF] px-3 py-1.5 text-xs outline-none focus:border-[#6F8AB7]"
                  />
                </div>
              </div>
              <div className="mt-4">
                <label className="mb-1 block text-xs font-medium text-[#485C8B]">
                  Cargo Description & Packaging
                </label>
                <textarea
                  rows={5}
                  value={draft.cargo_description || ""}
                  onChange={(e) => updateField("cargo_description", e.target.value)}
                  className="w-full rounded-md border border-[#B9C8DF] px-3 py-2 text-xs leading-relaxed outline-none focus:border-[#6F8AB7]"
                />
              </div>
              <div className="mt-4">
                <label className="mb-1 block text-xs font-medium text-[#485C8B]">
                  Special Instructions & Requirements
                </label>
                <textarea
                  rows={6}
                  value={draft.special_instructions || ""}
                  onChange={(e) => updateField("special_instructions", e.target.value)}
                  placeholder="e.g. Documents required: 3 Original BLs, Certificate of Origin, 14 days free detention at POD."
                  className="w-full rounded-md border border-[#B9C8DF] px-3 py-2 text-xs leading-relaxed outline-none focus:border-[#6F8AB7]"
                />
              </div>
            </div>

            {/* Box 5: Custom Fields */}
            <div className="rounded-xl border border-[#B9C8DF] bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between border-b border-[#FDD58D] pb-2">
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-[#6F8AB7]">
                    5. Custom Fields
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Add custom fields (e.g. Temperature, LC No., Dangerous Goods).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddCustomField}
                  className="cursor-pointer rounded-lg border border-[#6F8AB7] bg-[#EAF0F8] px-2.5 py-1 text-xs font-semibold text-[#485C8B] hover:bg-[#d5e2f5]"
                >
                  + Add Field
                </button>
              </div>

              {draft.custom_fields && draft.custom_fields.length > 0 ? (
                <div className="space-y-3">
                  {draft.custom_fields.map((cf, index) => (
                    <div key={index} className="flex items-center gap-2 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-2.5">
                      <div className="w-2/5">
                        <label className="mb-0.5 block text-[10px] font-semibold text-[#6F8AB7]">Label</label>
                        <input
                          type="text"
                          value={cf.label}
                          onChange={(e) => handleUpdateCustomField(index, "label", e.target.value)}
                          placeholder="e.g. Temperature Control"
                          className="w-full rounded border border-[#CBD5E1] bg-white px-2 py-1 text-xs font-medium text-[#1E293B] outline-none focus:border-[#485C8B]"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="mb-0.5 block text-[10px] font-semibold text-[#6F8AB7]">Value</label>
                        <input
                          type="text"
                          value={cf.value}
                          onChange={(e) => handleUpdateCustomField(index, "value", e.target.value)}
                          placeholder="e.g. Maintain at -18°C"
                          className="w-full rounded border border-[#CBD5E1] bg-white px-2 py-1 text-xs text-[#1E293B] outline-none focus:border-[#485C8B]"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveCustomField(index)}
                        title="Remove custom field"
                        className="mt-3.5 cursor-pointer rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-2 text-center text-xs italic text-slate-400">
                  No custom fields added. Click &quot;+ Add Field&quot; to add extra details.
                </p>
              )}
            </div>
          </div>

          {/* Right Column: Exact 1:1 Live PDF Preview, Original Email & Follow-up Email (6 Cols) */}
          <div className="space-y-4 lg:col-span-6">
            {/* 3 Tabs for Right Panel */}
            <div className="flex items-center justify-center border-b border-[#FDD58D] bg-white rounded-t-xl px-3 pt-2">
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveTab("document")}
                  className={`cursor-pointer px-4 py-2 text-xs font-bold uppercase tracking-wider ${
                    activeTab === "document"
                      ? "border-b-2 border-[#485C8B] text-[#485C8B]"
                      : "text-[#6F8AB7] hover:text-[#485C8B]"
                  }`}
                >
                  PDF Preview
                </button>
                <button
                  onClick={() => setActiveTab("original")}
                  className={`cursor-pointer px-4 py-2 text-xs font-bold uppercase tracking-wider ${
                    activeTab === "original"
                      ? "border-b-2 border-[#485C8B] text-[#485C8B]"
                      : "text-[#6F8AB7] hover:text-[#485C8B]"
                  }`}
                >
                  Original Email
                </button>
                <button
                  onClick={() => setActiveTab("email")}
                  className={`relative cursor-pointer px-4 py-2 text-xs font-bold uppercase tracking-wider ${
                    activeTab === "email"
                      ? "border-b-2 border-[#485C8B] text-[#485C8B]"
                      : "text-[#6F8AB7] hover:text-[#485C8B]"
                  }`}
                >
                  {hasUnresolved ? "Follow-up Email" : "Confirmation Email"}
                  {hasUnresolved ? (
                    <span className="ml-1.5 rounded-full bg-amber-500 px-1.5 py-0.2 text-[10px] text-white">
                      {activeMissing.length}
                    </span>
                  ) : (
                    <span className="ml-1.5 rounded-full bg-emerald-600 px-1.5 py-0.2 text-[10px] text-white">
                      Ready
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* TAB 1: Real Live PDF Preview via iframe */}
            {activeTab === "document" && (
              <div className="rounded-b-xl border border-t-0 border-[#B9C8DF] bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs text-[#6F8AB7]">
                    Live view of the PDF generated from your inputs:
                  </p>
                  <button
                    onClick={() => draft && fetchPdfBlob(draft)}
                    disabled={updatingPreview}
                    className="cursor-pointer rounded-lg border border-[#B9C8DF] bg-[#F4F7FB] px-3 py-1.5 text-xs font-semibold text-[#485C8B] shadow-sm hover:bg-[#EAF0F8] disabled:opacity-50"
                  >
                    {updatingPreview ? "Updating…" : "Update Preview"}
                  </button>
                </div>

                {pdfPreviewUrl ? (
                  <div className="overflow-hidden rounded-lg border border-black bg-white shadow-sm">
                    <iframe
                      src={pdfPreviewUrl}
                      title="Shipping Instruction PDF Preview"
                      className="h-[750px] w-full"
                    />
                  </div>
                ) : (
                  <div className="flex h-[750px] w-full flex-col items-center justify-center rounded-lg border border-dashed border-[#B9C8DF] bg-slate-50 text-slate-400">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#6F8AB7] border-t-transparent"></div>
                    <p className="mt-2 text-xs">Loading live PDF preview…</p>
                  </div>
                )}

                <div className="mt-4">
                  <button
                    onClick={handleDownloadPdf}
                    disabled={downloading}
                    className="w-full cursor-pointer rounded-lg bg-[#485C8B] py-2.5 text-xs font-semibold text-white shadow hover:bg-[#6F8AB7] disabled:opacity-50"
                  >
                    {downloading ? "Preparing PDF…" : "Download Finalised SI (PDF) ↓"}
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: Original Email Display */}
            {activeTab === "original" && (
              <div className="rounded-b-xl border border-t-0 border-[#B9C8DF] bg-white p-5 shadow-sm space-y-4">
                <div className="border-b border-[#FDD58D] pb-3">
                  <h3 className="text-sm font-bold text-[#485C8B]">Customer Request Email</h3>
                  <p className="text-xs text-[#6F8AB7]">Email ID: <span className="font-mono font-semibold text-[#485C8B]">{draft.email_id}</span></p>
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <span className="font-semibold text-slate-500">From: </span>
                    <span className="font-medium text-[#485C8B]">{draft.sender_email || "Unknown"}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-500">Subject: </span>
                    <span className="font-semibold text-[#485C8B]">{draft.email_subject || "(No Subject)"}</span>
                  </div>
                </div>

                <div className="rounded-lg border border-[#CBD5E1] bg-[#F8FAFC] p-4">
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">Email Body:</p>
                  <p className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-slate-800 max-h-[600px] overflow-y-auto">
                    {draft.raw_email_body || "No email body content available."}
                  </p>
                </div>
              </div>
            )}

            {/* TAB 3: Draft Follow-up or Confirmation Email */}
            {activeTab === "email" && (
              <div className="rounded-b-xl border border-t-0 border-[#B9C8DF] bg-white p-5 shadow-sm">
                {draft.missing_fields && draft.missing_fields.length > 0 && (
                  <div
                    className={`mb-4 rounded-lg border p-3.5 text-xs transition ${
                      hasUnresolved
                        ? "border-amber-300 bg-amber-50 text-amber-900"
                        : "border-emerald-300 bg-emerald-50 text-emerald-900"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/10 pb-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold text-white ${
                            hasUnresolved ? "bg-amber-500" : "bg-emerald-600"
                          }`}
                        >
                          {hasUnresolved ? "!" : "●"}
                        </span>
                        <span className="font-bold">
                          {hasUnresolved
                            ? `${activeMissing.length} Missing Field(s)`
                            : "All Particulars Resolved"}
                        </span>
                      </div>
                      {hasUnresolved && (
                        <div className="group relative">
                          <button
                            type="button"
                            onClick={resolveAllMissing}
                            className="cursor-pointer rounded border border-amber-400 bg-white px-2.5 py-1 text-[11px] font-semibold text-amber-900 shadow-xs hover:bg-amber-100"
                          >
                            Resolve All
                          </button>
                          <div className="pointer-events-none absolute bottom-full right-0 mb-1.5 hidden whitespace-normal rounded-md bg-slate-800 px-2.5 py-1 text-[11px] leading-tight text-white shadow-md group-hover:block z-20 w-48 text-center">
                            Resolves all missing fields without requiring you to enter any values.
                            <div className="absolute top-full right-4 border-4 border-transparent border-t-slate-800" />
                          </div>
                        </div>
                      )}
                    </div>

                    <p className="mt-2 text-[11px] leading-relaxed text-slate-700">
                      {hasUnresolved
                        ? "These fields were not found in the email request. Resolve if optional or pending carrier schedule:"
                        : "All fields resolved. A formal confirmation email has been generated below."}
                    </p>

                    <div className="mt-2.5 space-y-1.5">
                      {draft.missing_fields.map((field) => {
                        const resolved = isFieldResolved(field);
                        return (
                          <div
                            key={field}
                            className={`flex items-center justify-between rounded-md border px-3 py-1.5 transition ${
                              resolved
                                ? "border-emerald-200 bg-white/80 text-slate-500"
                                : "border-amber-200 bg-white text-slate-800"
                            }`}
                          >
                            <span className={`text-xs ${resolved ? "line-through text-slate-400" : "font-medium"}`}>
                              - {field}
                            </span>
                            <div className="group relative">
                              <button
                                type="button"
                                onClick={() => toggleResolveMissing(field)}
                                className={`cursor-pointer rounded px-2.5 py-0.5 text-[10px] font-semibold transition ${
                                  resolved
                                    ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                                    : "border border-amber-300 bg-white text-amber-900 hover:bg-amber-50"
                                }`}
                              >
                                {resolved ? "Resolved" : "Resolve"}
                              </button>
                              <div className="pointer-events-none absolute bottom-full right-0 mb-1.5 hidden whitespace-normal rounded-md bg-slate-800 px-2.5 py-1 text-[11px] leading-tight text-white shadow-md group-hover:block z-20 w-48 text-center">
                                {resolved
                                  ? "Click to mark back as missing"
                                  : "Resolves this field without requiring you to enter any value."}
                                <div className="absolute top-full right-4 border-4 border-transparent border-t-slate-800" />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wide text-[#6F8AB7]">
                      {hasUnresolved ? "Follow-up Inquiry Email" : "SI Confirmation Email"}
                    </span>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => updateField("draft_email_response", generateConfirmationEmail(draft))}
                        className="cursor-pointer rounded border border-[#B9C8DF] bg-[#F4F7FB] px-2 py-0.5 text-[10px] font-semibold text-[#485C8B] hover:bg-[#EAF0F8]"
                        title="Switch template to confirmation email"
                      >
                        Use Confirmation Draft
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateField(
                            "draft_email_response",
                            generateInquiryEmail(draft, activeMissing.length > 0 ? activeMissing : draft.missing_fields)
                          )
                        }
                        className="cursor-pointer rounded border border-[#B9C8DF] bg-[#F4F7FB] px-2 py-0.5 text-[10px] font-semibold text-[#485C8B] hover:bg-[#EAF0F8]"
                        title="Switch template to inquiry email"
                      >
                        Use Inquiry Draft
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#6F8AB7]">Recipient</label>
                    <input
                      type="text"
                      readOnly
                      value={draft.sender_email || ""}
                      className="w-full rounded border border-[#B9C8DF] bg-[#F4F7FB] px-2.5 py-1.5 text-xs text-slate-600"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#6F8AB7]">Subject</label>
                    <input
                      type="text"
                      readOnly
                      value={
                        hasUnresolved
                          ? `Re: ${draft.email_subject || "Shipping Instruction"} - Action Required: Missing Details`
                          : `Confirmation: Shipping Instruction Created - Booking Ref: ${draft.booking_ref || draft.email_id}`
                      }
                      className="w-full rounded border border-[#B9C8DF] bg-[#F4F7FB] px-2.5 py-1.5 text-xs text-slate-600"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#6F8AB7]">Email Content</label>
                    <textarea
                      rows={14}
                      value={draft.draft_email_response || ""}
                      onChange={(e) => updateField("draft_email_response", e.target.value)}
                      className="w-full rounded-md border border-[#B9C8DF] p-3 text-xs leading-relaxed outline-none focus:border-[#6F8AB7]"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleCopyEmail}
                      className="flex-1 cursor-pointer rounded-lg border border-[#6F8AB7] bg-white py-2.5 text-xs font-semibold text-[#485C8B] hover:bg-[#EAF0F8]"
                    >
                      {copiedEmail ? "Copied!" : "Copy Email Body"}
                    </button>
                    {draft.sender_email && (
                      <a
                        href={`mailto:${draft.sender_email}?subject=${encodeURIComponent(
                          hasUnresolved
                            ? `Re: ${draft.email_subject || "Shipping Instruction"} - Missing Details`
                            : `Confirmation: Shipping Instruction Created - ${draft.booking_ref || draft.email_id}`
                        )}&body=${encodeURIComponent(draft.draft_email_response || "")}`}
                        className="flex-1 rounded-lg bg-[#485C8B] py-2.5 text-center text-xs font-semibold text-white hover:bg-[#6F8AB7]"
                      >
                        Open in Mail Client
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* MODAL: Manage Templates */}
      {showTemplateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs"
          onClick={() => setShowTemplateModal(false)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-xl border border-[#FDD58D] bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#FDD58D] px-6 py-4">
              <div>
                <h3 className="text-base font-bold text-[#485C8B]">
                  Manage Shipping Instruction Templates
                </h3>
                <p className="text-xs text-[#6F8AB7]">
                  Configure company headers, document titles, and standard clauses.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowTemplateModal(false)}
                className="cursor-pointer text-lg leading-none text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            {/* Modal Body: Master-Detail Layout */}
            <div className="flex flex-1 overflow-hidden">
              {/* Left Panel: List of templates + New button */}
              <div className="w-1/3 border-r border-[#B9C8DF]/50 bg-[#FAFBFD] p-4 flex flex-col justify-between">
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#6F8AB7]">
                      Templates ({templates.length})
                    </span>
                  </div>
                  <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-1">
                    {templates.map((tpl) => {
                      const isSelected = !isCreatingNew && editingTemplateId === tpl.id;
                      return (
                        <button
                          key={tpl.id}
                          type="button"
                          onClick={() => selectTemplateForEdit(tpl)}
                          className={`w-full text-left rounded-lg px-3 py-2 text-xs transition cursor-pointer border ${
                            isSelected
                              ? "border-[#485C8B] bg-white font-bold text-[#485C8B] shadow-xs"
                              : "border-transparent bg-transparent text-slate-700 hover:bg-[#EAF0F8]"
                          }`}
                        >
                          <div className="truncate">{tpl.name}</div>
                          <div className="text-[10px] font-normal text-slate-400">
                            {tpl.is_custom ? "Custom" : "Standard"}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-4 border-t border-[#B9C8DF]/40">
                  <button
                    type="button"
                    onClick={handleStartNewTemplate}
                    className={`w-full cursor-pointer rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                      isCreatingNew
                        ? "border-[#485C8B] bg-[#485C8B] text-white"
                        : "border-[#6F8AB7] bg-[#EAF0F8] text-[#485C8B] hover:bg-[#d5e2f5]"
                    }`}
                  >
                    + Create New Template
                  </button>
                </div>
              </div>

              {/* Right Panel: Template Editor Form */}
              <div className="flex-1 p-6 overflow-y-auto">
                <form onSubmit={handleSaveTemplate} className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-xs font-bold text-[#485C8B]">
                      {isCreatingNew ? "New Template Details" : "Edit Template"}
                    </span>
                    {!isCreatingNew && templates.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleDeleteTemplate(editingTemplateId)}
                        className="cursor-pointer text-xs font-medium text-rose-600 hover:text-rose-800 hover:underline"
                      >
                        Remove Template
                      </button>
                    )}
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#485C8B]">
                      Template Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={tplFormName}
                      onChange={(e) => setTplFormName(e.target.value)}
                      placeholder="e.g. Apical Palm Oil Export"
                      className="w-full rounded-md border border-[#B9C8DF] px-3 py-1.5 text-xs outline-none focus:border-[#6F8AB7]"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#485C8B]">
                      Company / Legal Entity Header *
                    </label>
                    <input
                      type="text"
                      required
                      value={tplFormHeader}
                      onChange={(e) => setTplFormHeader(e.target.value)}
                      placeholder="e.g. APICAL TRADING PTE LTD"
                      className="w-full rounded-md border border-[#B9C8DF] px-3 py-1.5 text-xs outline-none focus:border-[#6F8AB7]"
                    />
                    <span className="text-[10px] text-slate-500">
                      Rendered in bold at the top of the official PDF.
                    </span>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#485C8B]">
                      Document Title
                    </label>
                    <input
                      type="text"
                      value={tplFormTitle}
                      onChange={(e) => setTplFormTitle(e.target.value)}
                      placeholder="e.g. MARITIME SHIPPING INSTRUCTION"
                      className="w-full rounded-md border border-[#B9C8DF] px-3 py-1.5 text-xs outline-none focus:border-[#6F8AB7]"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#485C8B]">
                      Default Special Instructions & Clauses
                    </label>
                    <textarea
                      rows={4}
                      value={tplFormClauses}
                      onChange={(e) => setTplFormClauses(e.target.value)}
                      placeholder="e.g. 1) Clean on Board Bills of Lading required&#10;2) 14 days free detention at POD."
                      className="w-full rounded-md border border-[#B9C8DF] px-3 py-1.5 text-xs outline-none focus:border-[#6F8AB7]"
                    />
                  </div>

                  <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowTemplateModal(false)}
                      className="cursor-pointer rounded-lg border border-[#B9C8DF] bg-white px-3 py-1.5 text-xs font-semibold text-[#485C8B] hover:bg-[#F4F7FB]"
                    >
                      Close
                    </button>
                    <button
                      type="submit"
                      className="cursor-pointer rounded-lg bg-[#485C8B] px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-[#6F8AB7]"
                    >
                      {isCreatingNew ? "Create & Apply" : "Save Changes"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default function SICreationPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#FFF9F0] p-12 text-center text-[#485C8B]">
          Loading Shipping Instruction workspace…
        </div>
      }
    >
      <SICreationContent />
    </Suspense>
  );
}
