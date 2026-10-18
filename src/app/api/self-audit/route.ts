import { NextRequest, NextResponse } from "next/server";
import { POST as checkEvidence } from "../check-evidence/route";
import { POST as checkSpecDrift } from "../check-spec-drift/route";
import { createTimings, serverTimingHeader } from "@/lib/timings";
import { Claim, SelfAuditResult, Verdict } from "@/types";
import selfAuditClaims from "@/lib/self-audit-claims.json";

export const maxDuration = 60;

const REPO_URL = "https://github.com/kathir-iTech/Vibe_Check";

const VERDICTS = new Set<Verdict>(["TRUE", "UNVERIFIED", "SPEC-DRIFT"]);

const SELF_CLAIMS: Claim[] = selfAuditClaims as Claim[];

function fakeRequest(body: unknown): NextRequest {
  return { json: () => Promise.resolve(body) } as unknown as NextRequest;
}

export async function POST() {
  const timings = createTimings();
  let evidenceData: any;
  try {
    const res = await checkEvidence(
      fakeRequest({ repoUrl: REPO_URL, claims: SELF_CLAIMS })
    );
    evidenceData = await res.json();
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `check-evidence failed: ${msg}` },
      { status: 502 }
    );
  }
  if (evidenceData?.error) {
    return NextResponse.json(
      { error: evidenceData.error },
      { status: 502 }
    );
  }
  timings.lap("evidence");

  const evidence: Record<string, any> = evidenceData?.evidence || {};

  let driftData: any;
  try {
    const res = await checkSpecDrift(
      fakeRequest({ repoUrl: REPO_URL, claims: SELF_CLAIMS, evidence, headSha: evidenceData.headSha })
    );
    driftData = await res.json();
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `check-spec-drift failed: ${msg}` },
      { status: 502 }
    );
  }
  if (driftData?.error) {
    return NextResponse.json(
      { error: driftData.error },
      { status: 502 }
    );
  }
  timings.lap("drift");

  const drift: any[] = Array.isArray(driftData?.drift) ? driftData.drift : [];
  const claims = [];

  for (const claim of SELF_CLAIMS) {
    const flag = drift.find((d) => d.claimId === claim.id);
    if (!flag || !VERDICTS.has(flag.verdict)) {
      return NextResponse.json(
        { error: `check-spec-drift returned no valid verdict for ${claim.id}` },
        { status: 502 }
      );
    }
    const ev = evidence[claim.id] || {};
    claims.push({
      id: claim.id,
      text: claim.text,
      verdict: flag.verdict as Verdict,
      reason: typeof flag.reason === "string" ? flag.reason : "",
      specReference:
        typeof flag.specReference === "string" ? flag.specReference : "",
      files: Array.isArray(ev.files) ? ev.files : [],
      commits: Array.isArray(ev.commits) ? ev.commits : [],
    });
  }

  const result: SelfAuditResult = {
    repoUrl: REPO_URL,
    runAt: new Date().toISOString(),
    claims,
  };

  const finalTimings = timings.finish();
  return NextResponse.json(
    {
      ...result,
      timings: {
        evidence: evidenceData.timings || {},
        drift: driftData.timings || {},
        selfAudit: finalTimings,
        total: finalTimings.total,
      },
      usage: driftData.usage || null,
    },
    { headers: { "Server-Timing": serverTimingHeader(finalTimings) } }
  );
}
