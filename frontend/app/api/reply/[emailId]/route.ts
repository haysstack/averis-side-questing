import { NextResponse } from "next/server";
import { draftReply } from "@/features/extraction/api/reply";

/** POST /api/reply/email_001[?force_ai=1] */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ emailId: string }> },
) {
  const { emailId } = await params;
  const forceAi = new URL(request.url).searchParams.get("force_ai") === "1";
  const result = await draftReply(emailId, forceAi);
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
