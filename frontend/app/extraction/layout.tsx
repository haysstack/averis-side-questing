import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: "Voyara — Extraction" };

export default function ExtractionLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}