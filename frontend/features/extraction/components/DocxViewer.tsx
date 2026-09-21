"use client";

import { useEffect, useRef, useState } from "react";

/** Draws a .docx in the page using docx-preview (browsers cannot show Word files in an iframe). */
export default function DocxViewer({ url }: { url: string }) {
  const container = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;

    async function render() {
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("Download failed");
        const blob = await response.blob();
        const { renderAsync } = await import("docx-preview");
        if (cancelled || !container.current) return;
        container.current.innerHTML = "";
        await renderAsync(blob, container.current);
        if (!cancelled) setState("ready");
      } catch {
        if (!cancelled) setState("error");
      }
    }

    void render();
    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <div className="h-full overflow-auto bg-gray-100 p-4">
      {state === "loading" && <p className="text-sm text-gray-600">Loading document…</p>}
      {state === "error" && (
        <p role="alert" className="text-sm text-gray-900">
          This document could not be displayed. Use Download to open it.
        </p>
      )}
      <div ref={container} className={state === "error" ? "hidden" : undefined} />
    </div>
  );
}
