import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Shipping Document Verification System — Human Review Queue",
  description: "Person D Reliability, Edge Cases, and Review Queue",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-slate-950 text-slate-100 font-sans">{children}</body>
    </html>
  );
}
