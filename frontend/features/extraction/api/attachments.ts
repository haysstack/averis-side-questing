const DOCKER_URL = (process.env.DOCKER_INBOX_URL ?? "http://localhost:8080").replace(/\/$/, "");

/** Attachment paths for one email, read from the Docker inbox server (same source extract.py uses). */
export async function fetchAttachments(emailId: string): Promise<string[]> {
  const response = await fetch(`${DOCKER_URL}/emails/${encodeURIComponent(emailId)}`, {
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Inbox server returned ${response.status}`);
  const data = (await response.json()) as { attachments?: unknown };
  return Array.isArray(data.attachments)
    ? data.attachments.filter((item): item is string => typeof item === "string")
    : [];
}
