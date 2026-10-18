import { NextRequest, NextResponse } from "next/server";
import { safeDecodeReportId, reportVerificationKey } from "@/lib/report-crypto.mjs";

export async function POST(request: NextRequest) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const report = safeDecodeReportId(body?.auditReceipt);
  if (!report?.signatureVerified || report.source?.kind !== "live") {
    return NextResponse.json({error:"A valid server-issued audit receipt is required. Run a live audit first; client-authored and demo results cannot receive an audited signature."},{status:422});
  }
  return NextResponse.json({permalink:`${request.nextUrl.origin}/report/view#${body.auditReceipt}`,report,verificationKey:reportVerificationKey()},{headers:{"Cache-Control":"no-store"}});
}
