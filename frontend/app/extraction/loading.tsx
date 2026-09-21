export default function ExtractionLoading() {
  return (
    <div aria-busy="true" aria-label="Loading emails">
      <div className="mb-6 h-8 w-56 rounded bg-gray-200 motion-safe:animate-pulse" />
      <div className="divide-y divide-gray-200 overflow-hidden rounded-lg border border-gray-200 bg-white">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-2 py-4 pr-5 pl-6">
            <div className="h-4 w-28 rounded bg-gray-200 motion-safe:animate-pulse" />
            <div className="h-4 w-2/3 rounded bg-gray-200 motion-safe:animate-pulse" />
            <div className="h-3 w-1/3 rounded bg-gray-100 motion-safe:animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
