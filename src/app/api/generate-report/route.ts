import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const repoUrl = body.repoUrl || "";
  const claims = body.claims || [];

  const reportId = `rpt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const permalink = `${request.headers.get("x-forwarded-proto") || "https"}://${request.headers.get("host") || "vibecheck.dev"}/report/${reportId}`;

  const report = {
    id: reportId,
    repoUrl,
    claims,
    generatedAt: new Date().toISOString(),
    permalink,
  };

  return NextResponse.json({ report, permalink });
}

export async function GET(request: NextRequest) {
  const reportId = request.nextUrl.searchParams.get("id") || "";
  return NextResponse.json({ report: { id: reportId, generatedAt: new Date().toISOString() } });
}
