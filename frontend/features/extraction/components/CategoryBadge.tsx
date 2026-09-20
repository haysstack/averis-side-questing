import { CATEGORY_META } from "../config/categories";
import type { EmailCategory } from "../types";

const BASE = "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium";

export default function CategoryBadge({ category }: { category: EmailCategory | null }) {
  if (!category) {
    return (
      <span className={`${BASE} border border-dashed border-gray-300 text-gray-500`}>
        Unclassified
      </span>
    );
  }
  const meta = CATEGORY_META[category];
  return <span className={`${BASE} ${meta.className}`}>{meta.label}</span>;
}
