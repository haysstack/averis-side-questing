export type FileKind = "pdf" | "text" | "docx" | "other";

export function fileName(path: string): string {
  return path.split("/").pop() ?? path;
}

export function fileKind(path: string): FileKind {
  const ext = fileName(path).split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "pdf";
  if (ext === "txt") return "text";
  if (ext === "docx") return "docx";
  return "other";
}

/** Same-origin URL served by app/api/attachments, which proxies the Docker inbox server. */
export function attachmentUrl(path: string, download = false): string {
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `/api/attachments/${encoded}${download ? "?download=1" : ""}`;
}
