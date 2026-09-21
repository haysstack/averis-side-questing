import { notFound } from "next/navigation";
import { fetchSenders } from "@/features/extraction/api/senders";
import ExtractionView from "@/features/extraction/components/ExtractionView";
import { senderView } from "@/features/extraction/config/views";
import { parseListQuery, type RawSearchParams } from "@/features/extraction/utils";

export default async function SenderPage({
  params,
  searchParams,
}: {
  params: Promise<{ domain: string }>;
  searchParams: Promise<RawSearchParams>;
}) {
  const [{ domain }, raw] = await Promise.all([params, searchParams]);
  const wanted = decodeURIComponent(domain).toLowerCase();

  const senders = await fetchSenders(1, 1000).catch(() => []);
  const sender = senders.find((s) => s.domain === wanted);
  if (!sender) notFound();

  return <ExtractionView view={senderView(sender)} query={parseListQuery(raw)} />;
}
