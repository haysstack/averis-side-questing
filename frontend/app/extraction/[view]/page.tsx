import { notFound } from "next/navigation";
import ExtractionView from "@/features/extraction/components/ExtractionView";
import { getViewBySlug } from "@/features/extraction/config/views";
import { parseListQuery, type RawSearchParams } from "@/features/extraction/utils";

export default async function ExtractionFilteredPage({
  params,
  searchParams,
}: {
  params: Promise<{ view: string }>;
  searchParams: Promise<RawSearchParams>;
}) {
  const [{ view: slug }, raw] = await Promise.all([params, searchParams]);

  const view = getViewBySlug(slug);
  if (!view) notFound();

  return <ExtractionView view={view} query={parseListQuery(raw)} />;
}
