"use client";

export default function ExtractionError({ reset }: { reset: () => void }) {
  return (
    <div role="alert" className="rounded-lg border border-tangerine bg-cream/50 px-5 py-4">
      <p className="font-medium text-gray-900">This page could not be displayed</p>
      <p className="mt-1 text-sm text-gray-700">
        Something failed while rendering. Try again, and check the backend logs if it keeps happening.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-3 rounded-md bg-navy px-3 py-1.5 text-sm font-medium text-white hover:bg-navy/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
      >
        Try again
      </button>
    </div>
  );
}
