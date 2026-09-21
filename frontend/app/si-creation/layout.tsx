import type { Metadata } from "next";
import type { ReactNode } from "react";
import { fetchEmailStats } from "@/features/extraction/api/emails";
import { fetchSenders } from "@/features/extraction/api/senders";
import ExtractionSidebar from "@/features/extraction/components/ExtractionSidebar";
import { buildSidebarSections } from "@/features/extraction/config/views";

export const metadata: Metadata = {
  title: "SI Creation — Shipping Documentation",
};

export default async function SICreationLayout({ children }: { children: ReactNode }) {
  const [stats, senders] = await Promise.all([
    fetchEmailStats().catch(() => null),
    fetchSenders().catch(() => []),
  ]);

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 text-gray-900 md:flex-row">
      <ExtractionSidebar sections={buildSidebarSections(stats, senders)} />
      <div className="min-w-0 flex-1 bg-gray-50">
        {children}
      </div>
    </div>
  );
}
