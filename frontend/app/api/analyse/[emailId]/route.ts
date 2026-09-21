import { NextResponse } from "next/server";
import { analyseEmail } from "@/features/extraction/api/analyse";

/**
 * POST /api/analyse/email_001            classify, then extract if needed
 * POST /api/analyse/email_001?step=classify | extract
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ emailId: string }> },
) {
  const { emailId } = await params;
  const step = new URL(request.url).searchParams.get("step");
  const result = await analyseEmail(
    emailId,
    step === "classify" || step === "extract" ? step : "all",
  );
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
