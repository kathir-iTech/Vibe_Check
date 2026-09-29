import { NextRequest, NextResponse } from "next/server";
import { demoClaims } from "@/lib/demo-data";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const MODEL = "gemini-3-flash-preview";

export async function GET() {
  return NextResponse.json({ claims: demoClaims });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const message = body.message || body.agentMessage || "";
  const repoUrl = body.repoUrl || "";

  if (!GEMINI_API_KEY) {
    return NextResponse.json({
      claims: demoClaims,
      note: "Using demo claims — GEMINI_API_KEY not set",
    });
  }

  try {
    const prompt = `Extract discrete checkable claims from this AI coding agent message. Return only a JSON array of claim objects, each with "id", "text", and "evidenceType" fields. Be precise and specific. Message: "${message}" Repo URL: "${repoUrl}"`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1 },
        }),
      }
    );

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    try {
      const claims = JSON.parse(text);
      return NextResponse.json({ claims });
    } catch {
      return NextResponse.json({
        claims: [{ id: "raw-1", text: message, evidenceType: ["file", "commit"] }],
        raw: text,
      });
    }
  } catch (error) {
    return NextResponse.json({
      claims: demoClaims,
      error: `Gemini API error: ${error}`,
    });
  }
}
