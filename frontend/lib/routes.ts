/**
 * Single source of truth for every URL in the app.
 * Never hardcode "/something" in a component; add it here instead.
 * When a teammate ships a page, they add (or fix) one line here.
 */
export const routes = {
  home: "/",

  // Extraction (this feature)
  extraction: (slug?: string) => (slug ? `/extraction/${slug}` : "/extraction"),

  // Teammates' pages. Agree on these paths with them.
  email: (emailId: string) => `/emails/${encodeURIComponent(emailId)}`,
  // comparison: (emailId: string) => `/comparison/${encodeURIComponent(emailId)}`,
  // review: (emailId: string) => `/review/${encodeURIComponent(emailId)}`,
} as const;
