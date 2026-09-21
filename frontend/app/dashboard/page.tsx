import type { Metadata } from "next";
import DashboardView from "@/features/dashboard/components/DashboardView";

export const metadata: Metadata = {
  title: "Voyara — Operations Dashboard",
};

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  return <DashboardView />;
}
