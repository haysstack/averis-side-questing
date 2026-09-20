import { NextResponse } from "next/server";
import { analyseEmail } from "@/features/extraction/api/analyse";

/**
 * POST /api/analyse/email_001
 * The browser calls this instead of the FastAPI backend directly,
 * so no CORS setup is needed and the backend URL stays private.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ emailId: string }> },
) {
  const { emailId } = await params;
  const result = await analyseEmail(emailId);
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
