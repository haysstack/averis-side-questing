import { PRIORITY_META } from "../config/categories";
import type { EmailPriority } from "../types";

export default function PriorityBadge({ priority }: { priority: EmailPriority | null }) {
  if (!priority) return null;
  const meta = PRIORITY_META[priority];
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-gray-700">
      <span aria-hidden className={`size-2 rounded-full ${meta.swatch}`} />
      {meta.label}
    </span>
  );
}
