import type { Metadata } from "next";
import type { ReactNode } from "react";
import { fetchEmailStats } from "@/features/extraction/api/emails";
import { fetchSenders } from "@/features/extraction/api/senders";
import ExtractionSidebar from "@/features/extraction/components/ExtractionSidebar";
import { buildSidebarSections } from "@/features/extraction/config/views";

export const metadata: Metadata = { title: "Extraction" };

export default async function ExtractionLayout({ children }: { children: ReactNode }) {
  // If the backend is down the sidebar still renders, just without counts.
  const [stats, senders] = await Promise.all([
    fetchEmailStats().catch(() => null),
    fetchSenders().catch(() => []),
  ]);

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 text-gray-900 md:flex-row">
      <ExtractionSidebar sections={buildSidebarSections(stats, senders)} />
      <main className="min-w-0 flex-1 px-4 py-6 md:px-10 md:py-10">
        {children}
      </main>
    </div>
  );
}
