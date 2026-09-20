import { notFound } from "next/navigation";
import ExtractionView from "@/features/extraction/components/ExtractionView";
import { getViewBySlug } from "@/features/extraction/config/views";
import { parsePage } from "@/features/extraction/utils";

export default async function ExtractionFilteredPage({
  params,
  searchParams,
}: {
  params: Promise<{ view: string }>;
  searchParams: Promise<{ page?: string | string[]; email?: string | string[] }>;
}) {
  const [{ view: slug }, { page, email }] = await Promise.all([params, searchParams]);

  const view = getViewBySlug(slug);
  if (!view) notFound();

  const selectedId = Array.isArray(email) ? email[0] : email;
  return <ExtractionView view={view} page={parsePage(page)} selectedId={selectedId} />;
}
