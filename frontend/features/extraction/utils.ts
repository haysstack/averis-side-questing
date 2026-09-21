import type { ListQuery, SearchField } from "./types";

export type RawSearchParams = Record<string, string | string[] | undefined>;

export const SEARCH_FIELDS: { value: SearchField; label: string }[] = [
  { value: "all", label: "All fields" },
  { value: "id", label: "Email ID" },
  { value: "sender", label: "Sender" },
  { value: "subject", label: "Subject" },
  { value: "content", label: "Email content" },
  { value: "category", label: "Category" },
  { value: "priority", label: "Priority" },
  { value: "summary", label: "AI summary" },
];

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** Turns the URL's search params into one safe, typed object. */
export function parseListQuery(raw: RawSearchParams): ListQuery {
  const page = Number.parseInt(first(raw.page) ?? "1", 10);
  const sort = first(raw.sort);
  const field = first(raw.field);
  const priority = first(raw.priority);

  return {
    page: Number.isFinite(page) && page >= 1 ? page : 1,
    sort: sort === "priority" || sort === "subject" ? sort : undefined,
    email: first(raw.email) || undefined,
    q: first(raw.q)?.trim() || undefined,
    field: SEARCH_FIELDS.some((f) => f.value === field) ? (field as SearchField) : "all",
    priority:
      priority === "High" || priority === "Medium" || priority === "Low" ? priority : undefined,
    attachments: first(raw.attachments) === "1",
  };
}

/** Builds /extraction/... URLs so page, sort, search, filters and the open email stay consistent. */
export function buildHref(basePath: string, params: Partial<ListQuery>): string {
  const search = new URLSearchParams();
  if (params.page && params.page > 1) search.set("page", String(params.page));
  if (params.sort) search.set("sort", params.sort);
  if (params.q) {
    search.set("q", params.q);
    if (params.field && params.field !== "all") search.set("field", params.field);
  }
  if (params.priority) search.set("priority", params.priority);
  if (params.attachments) search.set("attachments", "1");
  if (params.email) search.set("email", params.email);
  const qs = search.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}
