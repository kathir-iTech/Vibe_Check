import { NextRequest, NextResponse } from "next/server";
import { encodeSignedReport } from "@/lib/report-crypto.mjs";

export async function POST(request: NextRequest) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const repoUrl = typeof body?.repoUrl === "string" ? body.repoUrl.trim() : "";
  const headSha = typeof body?.headSha === "string" ? body.headSha.trim() : "";
  const claims = Array.isArray(body?.claims) ? body.claims.slice(0, 15) : [];
  const evidence = body?.evidence && typeof body.evidence === "object" ? body.evidence : {};
  const verdicts = Array.isArray(body?.verdicts) ? body.verdicts.slice(0, 15) : [];

  if (!claims.length) {
    return NextResponse.json({ error: "No claims to report" }, { status: 400 });
  }

  const generatedAt = new Date().toISOString();
  const { id, sig, signedPayload } = encodeSignedReport({
    repoUrl,
    headSha,
    claims,
    evidence,
    verdicts,
    generatedAt,
  });

  const proto =
    request.headers.get("x-forwarded-proto") ||
    request.nextUrl.protocol.replace(":", "") ||
    "http";
  const host = request.headers.get("host") || "localhost:3000";
  const permalink = `${proto}://${host}/report/${id}`;

  return NextResponse.json({ permalink, sig, report: signedPayload });
}
