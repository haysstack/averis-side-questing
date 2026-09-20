/**
 * Tiny fetch wrapper for the FastAPI backend.
 * Only used on the server (server components and route handlers), so there are
 * no CORS issues and the backend URL never reaches the browser.
 */
const API_BASE_URL = (process.env.API_BASE_URL ?? "http://localhost:8000").replace(/\/$/, "");

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type Query = Record<string, string | number | null | undefined>;

function buildUrl(path: string, query?: Query): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  }
  const qs = search.toString();
  return `${API_BASE_URL}${path}${qs ? `?${qs}` : ""}`;
}

/** FastAPI puts its error text in { detail: "..." }. */
async function readErrorDetail(response: Response): Promise<string | null> {
  try {
    const body = (await response.json()) as { detail?: unknown };
    return typeof body.detail === "string" ? body.detail : null;
  } catch {
    return null;
  }
}

async function request<T>(method: "GET" | "POST", path: string, query?: Query): Promise<T> {
  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), { method, cache: "no-store" });
  } catch {
    throw new ApiError(503, `Could not reach the backend at ${API_BASE_URL}. Check that it is running.`);
  }

  if (!response.ok) {
    const detail = await readErrorDetail(response);
    throw new ApiError(response.status, detail ?? `The backend returned ${response.status} for ${path}.`);
  }

  return (await response.json()) as T;
}

export function apiGet<T>(path: string, query?: Query): Promise<T> {
  return request<T>("GET", path, query);
}

export function apiPost<T>(path: string, query?: Query): Promise<T> {
  return request<T>("POST", path, query);
}
