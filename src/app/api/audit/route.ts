import { NextRequest, NextResponse } from "next/server";
import { runAudit } from "@/lib/audit-service";
import { encodeSignedReport } from "@/lib/report-crypto.mjs";

export const maxDuration = 180;
export async function POST(request: NextRequest) {
  const raw = await request.text();
  if (raw.length > 24000)
    return NextResponse.json(
      { error: "Audit input exceeds 24KB" },
      { status: 413 },
    );
  let input: any;
  try {
    input = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (
    !input ||
    typeof input !== "object" ||
    (!input.message && !input.sourceUrl && !input.claims)
  )
    return NextResponse.json(
      { error: "Provide an agent message, claims or a GitHub source URL" },
      { status: 400 },
    );
  const wantsStream = request.headers
    .get("accept")
    ?.includes("application/x-ndjson");
  const finish = (report: any) => {
    try {
      const signed = encodeSignedReport(report);
      return { audit: signed.signedPayload, auditReceipt: signed.id };
    } catch {
      return {
        audit: report,
        auditReceipt: null,
        signingWarning:
          "Signature unavailable. This result can be exported as an unsigned assessment.",
      };
    }
  };
  if (!wantsStream) {
    try {
      return NextResponse.json(finish(await runAudit(input, request.headers)), {
        headers: { "Cache-Control": "no-store" },
      });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Audit failed" },
        { status: 502 },
      );
    }
  }
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (event: unknown) => {
        if (!closed)
          try {
            controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
          } catch {
            closed = true;
          }
      };
      try {
        const result = await runAudit(input, request.headers, (stage) =>
          send({ type: "stage", stage }),
        );
        send({ type: "result", ...finish(result) });
      } catch (error) {
        send({
          type: "error",
          error: error instanceof Error ? error.message : "Audit failed",
        });
      } finally {
        if (!closed) controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
