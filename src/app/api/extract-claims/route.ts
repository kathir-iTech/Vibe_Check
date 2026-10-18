import { NextRequest, NextResponse } from "next/server";
import { extractClaimsViaGemini, MAX_MESSAGE_CHARS } from "@/lib/gemini";
import { validateAuditClaims } from "@/lib/audit-policy.mjs";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

export async function GET() {
  return NextResponse.json(
    { error: "Use POST to extract claims", model: null },
    { status: 405 },
  );
}

export async function POST(request: NextRequest) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body", model: null },
      { status: 400 },
    );
  }

  const rawMessage = body?.message || body?.agentMessage || "";
  if (typeof rawMessage !== "string" || !rawMessage.trim()) {
    return NextResponse.json(
      { error: "message required", model: null },
      { status: 400 },
    );
  }
  if (rawMessage.length > MAX_MESSAGE_CHARS * 4) {
    return NextResponse.json(
      { error: "Message payload exceeds maximum size (32KB).", model: null },
      { status: 400 },
    );
  }

  if (!GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY not set. Cannot extract claims.", model: null },
      { status: 500 },
    );
  }

  try {
    const {
      data: claims,
      model,
      modelFallback,
      usage,
      timings,
    } = await extractClaimsViaGemini(
      rawMessage,
      GEMINI_API_KEY,
      request.signal,
    );
    if (!claims.length) {
      return NextResponse.json(
        { error: "Gemini returned zero claims", model, modelFallback },
        { status: 502 },
      );
    }
    return NextResponse.json({
      claims: validateAuditClaims(claims),
      model,
      modelFallback,
      usage,
      timings,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Gemini API error: ${msg}`, model: null, modelFallback: false },
      { status: 502 },
    );
  }
}
