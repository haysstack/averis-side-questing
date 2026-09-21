import type { Metadata } from "next";
import "./globals.css";
import { fetchEmailStats } from "@/features/extraction/api/emails";
import { fetchSenders } from "@/features/extraction/api/senders";
import ExtractionSidebar from "@/features/extraction/components/ExtractionSidebar";
import { buildSidebarSections } from "@/features/extraction/config/views";

export const metadata: Metadata = {
  title: "Shipping Document Verification System",
  description: "Person D Reliability, Edge Cases, and Review Queue",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [stats, senders] = await Promise.all([
    fetchEmailStats().catch(() => null),
    fetchSenders().catch(() => []),
  ]);

  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-slate-950 text-slate-100 font-sans">
        <div className="flex min-h-screen flex-col md:flex-row">
          <ExtractionSidebar sections={buildSidebarSections(stats, senders)} />
          <main className="min-w-0 flex-1 px-4 py-6 md:px-10 md:py-10">{children}</main>
        </div>
      </body>
    </html>
  );
}