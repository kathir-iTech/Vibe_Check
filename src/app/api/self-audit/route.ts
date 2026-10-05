import { NextRequest, NextResponse } from "next/server";
import { POST as checkEvidence } from "../check-evidence/route";
import { POST as checkSpecDrift } from "../check-spec-drift/route";
import { Claim, SelfAuditResult, Verdict } from "@/types";

const REPO_URL = "https://github.com/kathir-iTech/Vibe_Check";

const VERDICTS = new Set<Verdict>(["TRUE", "UNVERIFIED", "SPEC-DRIFT"]);

const SELF_CLAIMS: Claim[] = [
  {
    id: "self-1",
    text: "Evidence checks are static/API-based only \u2014 no sandboxed code execution.",
    evidenceType: ["file", "commit"],
  },
  {
    id: "self-2",
    text: "Every verdict is one of TRUE, UNVERIFIED, or SPEC-DRIFT \u2014 reachable from a real branch in check-spec-drift, never a UI default.",
    evidenceType: ["file", "commit"],
  },
  {
    id: "self-3",
    text: "SPEC-DRIFT citations are verified against the real file content server-side before being shown \u2014 a quote that doesn't actually exist in the cited doc throws an error instead of displaying.",
    evidenceType: ["file", "commit"],
  },
];

function fakeRequest(body: unknown): NextRequest {
  return { json: () => Promise.resolve(body) } as unknown as NextRequest;
}

export async function POST() {
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

  const evidence: Record<string, any> = evidenceData?.evidence || {};

  let driftData: any;
  try {
    const res = await checkSpecDrift(
      fakeRequest({ repoUrl: REPO_URL, claims: SELF_CLAIMS, evidence })
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

  return NextResponse.json(result);
}
