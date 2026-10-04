import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const repoUrl = typeof body.repoUrl === "string" ? body.repoUrl : "";
  const claims = Array.isArray(body.claims) ? body.claims : [];
  const evidence = body.evidence && typeof body.evidence === "object" ? body.evidence : {};
  const verdicts = Array.isArray(body.verdicts) ? body.verdicts : [];

  if (!claims.length) {
    return NextResponse.json({ error: "No claims to report" }, { status: 400 });
  }

  const report = {
    repoUrl,
    claims,
    evidence,
    verdicts,
    generatedAt: new Date().toISOString(),
  };

  const id = Buffer.from(JSON.stringify(report), "utf8").toString("base64url");

  const proto =
    request.headers.get("x-forwarded-proto") ||
    request.nextUrl.protocol.replace(":", "") ||
    "http";
  const host = request.headers.get("host") || "localhost:3000";
  const permalink = `${proto}://${host}/report/${id}`;

  return NextResponse.json({ permalink, report });
}
