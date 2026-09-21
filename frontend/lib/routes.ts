/**
 * Single source of truth for every URL in the app.
 * Never hardcode "/something" in a component; add it here instead.
 * When a teammate ships a page, they add (or fix) one line here.
 */
export const routes = {
  home: "/",
  dashboard: "/dashboard",

  // Extraction (classified inbox)
  extraction: (slug?: string) => (slug ? `/extraction/${slug}` : "/extraction"),

  // Teammates' pages. Agree on these paths with them.
  email: (emailId: string) => `/emails/${encodeURIComponent(emailId)}`,
  // Teammate's SI creation page.
  siCreation: (emailId?: string) =>
    emailId ? `/si-creation?email_id=${encodeURIComponent(emailId)}` : "/si-creation",
  review: "/",
} as const;
