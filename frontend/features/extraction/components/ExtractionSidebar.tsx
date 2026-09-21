"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { routes } from "@/lib/routes";
import type { SidebarSection } from "../types";

function isActive(pathname: string, href: string): boolean {
  // "All" lives at /extraction, which is a prefix of every other view,
  // so it must match exactly.
  if (href === routes.extraction()) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function ExtractionSidebar({ sections }: { sections: SidebarSection[] }) {
  const pathname = usePathname();

  const hasActiveSender = sections
    .find((s) => s.title?.toLowerCase().includes("sender"))
    ?.items.some((item) => isActive(pathname, item.href));

  const [sendersOpen, setSendersOpen] = useState(Boolean(hasActiveSender));

  useEffect(() => {
    if (hasActiveSender) {
      setSendersOpen(true);
    }
  }, [hasActiveSender]);

  return (
    <aside className="border-b border-gray-200 bg-white md:sticky md:top-0 md:h-screen md:w-64 md:min-w-64 md:max-w-64 md:shrink-0 md:overflow-y-auto no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden md:border-r md:border-b-0">
      <div className="px-5 pt-5 pb-3 md:pt-8">
        <h1 className="text-lg font-semibold text-navy">Extraction</h1>
        <p className="text-sm text-gray-500">Emails pulled from the inbox</p>
      </div>

      <nav aria-label="Extraction views" className="px-3 pb-3 md:pb-6">
        {sections.map((section, index) => {
          const isSendersSection = Boolean(
            section.title && section.title.toLowerCase().includes("sender")
          );

          return (
            <div key={section.title ?? index} className={index > 0 ? "md:mt-5" : undefined}>
              {section.title && isSendersSection ? (
                <button
                  type="button"
                  onClick={() => setSendersOpen((prev) => !prev)}
                  aria-expanded={sendersOpen}
                  className="flex w-full items-center justify-between rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors focus-visible:outline-2 focus-visible:outline-navy"
                >
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span className="truncate">{section.title}</span>
                    <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[11px] font-normal text-gray-500 shrink-0">
                      {section.items.length}
                    </span>
                  </span>
                  <svg
                    className={`size-4 text-gray-400 transition-transform duration-200 shrink-0 ${
                      sendersOpen ? "rotate-180 text-gray-600" : ""
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>
              ) : section.title ? (
                <p className="px-3 pb-1 text-sm font-medium text-gray-500">{section.title}</p>
              ) : null}

              {(!isSendersSection || sendersOpen) && (
                <ul
                  className={`flex gap-1 overflow-x-auto no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden md:flex-col ${
                    isSendersSection
                      ? "mt-1 pl-1 max-h-60 md:overflow-y-auto"
                      : "md:overflow-visible"
                  }`}
                >
                  {section.items.map((item) => {
                    const active = isActive(pathname, item.href);
                    const showPending =
                      typeof item.pendingCount === "number" && item.pendingCount > 0;
                    return (
                      <li key={item.href} className="shrink-0">
                        <Link
                          href={item.href}
                          aria-current={active ? "page" : undefined}
                          className={`relative flex items-center justify-between gap-3 rounded-md px-3 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy min-w-0 ${
                            active
                              ? "bg-cream font-semibold text-navy"
                              : "text-gray-700 hover:bg-gray-100"
                          }`}
                        >
                          {active && (
                            <span
                              aria-hidden
                              className="absolute inset-y-1.5 left-0 hidden w-1 rounded-full bg-tangerine md:block"
                            />
                          )}
                          <span className="truncate" title={item.label}>
                            {item.label}
                          </span>
                          <span className="flex items-center gap-1.5 shrink-0">
                            {showPending && (
                              <span
                                title="Emails that have not been analysed yet"
                                className={`rounded-full px-2 py-0.5 text-xs font-medium tabular-nums text-gray-900 ${
                                  active ? "bg-tangerine" : "bg-tangerine/25"
                                }`}
                              >
                                {item.pendingCount} not analysed
                              </span>
                            )}
                            {typeof item.count === "number" && (
                              <span
                                className={`rounded-full px-2 py-0.5 text-xs tabular-nums ${
                                  active ? "bg-white text-navy" : "bg-gray-100 text-gray-600"
                                }`}
                              >
                                {item.count}
                              </span>
                            )}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
