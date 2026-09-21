import { NextResponse } from "next/server";

const API_BASE_URL = (process.env.API_BASE_URL ?? "http://localhost:8000").replace(/\/$/, "");

export async function POST(
  request: Request,
  { params }: { params: Promise<{ emailId: string }> },
) {
  const { emailId } = await params;
  const res = await fetch(`${API_BASE_URL}/compare/${encodeURIComponent(emailId)}`, {
    method: "POST",
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}