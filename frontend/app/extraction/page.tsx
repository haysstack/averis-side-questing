import ExtractionView from "@/features/extraction/components/ExtractionView";
import { ALL_VIEW } from "@/features/extraction/config/views";
import { parsePage } from "@/features/extraction/utils";

export default async function ExtractionAllPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[]; email?: string | string[] }>;
}) {
  const { page, email } = await searchParams;
  const selectedId = Array.isArray(email) ? email[0] : email;
  return <ExtractionView view={ALL_VIEW} page={parsePage(page)} selectedId={selectedId} />;
}
