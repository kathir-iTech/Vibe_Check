import { NextRequest, NextResponse } from "next/server";
import { extractClaimsViaGemini } from "@/lib/gemini";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

export async function GET() {
  return NextResponse.json({ error: "Use POST to extract claims" }, { status: 405 });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const message = body.message || body.agentMessage || "";

  if (!message) {
    return NextResponse.json({ error: "message required" }, { status: 400 });
  }

  if (!GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY not set. Cannot extract claims." },
      { status: 500 }
    );
  }

  try {
    const claims = await extractClaimsViaGemini(message, GEMINI_API_KEY);
    if (!claims.length) {
      return NextResponse.json(
        { error: "Gemini returned zero claims" },
        { status: 502 }
      );
    }
    return NextResponse.json({ claims });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Gemini API error: ${msg}` },
      { status: 502 }
    );
  }
}
