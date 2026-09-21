import ExtractionView from "@/features/extraction/components/ExtractionView";
import { ALL_VIEW } from "@/features/extraction/config/views";
import { parseListQuery, type RawSearchParams } from "@/features/extraction/utils";

export default async function ExtractionAllPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  return <ExtractionView view={ALL_VIEW} query={parseListQuery(await searchParams)} />;
}
