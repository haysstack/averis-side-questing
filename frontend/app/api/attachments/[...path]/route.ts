const DOCKER_URL = (process.env.DOCKER_INBOX_URL ?? "http://localhost:8080").replace(/\/$/, "");

const TYPES: Record<string, string> = {
  pdf: "application/pdf",
  txt: "text/plain; charset=utf-8",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

/**
 * GET /api/attachments/attachments/email_001_si.pdf[?download=1]
 * Streams the file from the Docker inbox server, so the browser only talks to this app
 * (no CORS setup, and the inbox server URL stays private).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  if (path.length === 0 || path.some((segment) => segment === ".." || segment === ".")) {
    return new Response("Bad path.", { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${DOCKER_URL}/${path.map(encodeURIComponent).join("/")}`, {
      cache: "no-store",
    });
  } catch {
    return new Response("Could not reach the inbox server.", { status: 502 });
  }
  if (!upstream.ok || !upstream.body) {
    return new Response("Attachment not found.", { status: upstream.status === 404 ? 404 : 502 });
  }

  const name = path[path.length - 1].replace(/"/g, "");
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const download = new URL(request.url).searchParams.get("download") === "1";

  return new Response(upstream.body, {
    headers: {
      "Content-Type": TYPES[ext] ?? upstream.headers.get("content-type") ?? "application/octet-stream",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${name}"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}
