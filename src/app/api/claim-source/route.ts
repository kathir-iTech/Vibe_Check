import { NextRequest, NextResponse } from "next/server";
import { fetchClaimTextFromUrl } from "@/lib/github";

export async function GET() {
  return NextResponse.json({ error: "Use POST to fetch a claim source" }, { status: 405 });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const url = typeof body.url === "string" ? body.url.trim() : "";

  if (!url) {
    return NextResponse.json({ error: "A PR or commit URL is required" }, { status: 400 });
  }

  try {
    const text = await fetchClaimTextFromUrl(url);
    return NextResponse.json({ text });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const status = msg.includes("Not a valid") ? 400 : 502;
    return NextResponse.json({ error: msg }, { status });
  }
}
