import { Claim } from "@/types";
import { getVerdictColor } from "./ClaimInput";

interface Props {
  claims: Claim[];
  evidence: Record<string, any>;
  driftFlags: any[];
}

export function ResultsPanel({ claims, evidence, driftFlags }: Props) {
  if (!claims.length) {
    return <p className="placeholder">Submit a claim to see verdicts.</p>;
  }

  return (
    <div>
      {claims.map((claim) => {
        const claimEvidence = evidence[claim.id || claim.text];
        const driftFlag = driftFlags.find((d) => d.claimId === (claim.id || claim.text));
        const verdict = driftFlag?.verdict || "UNVERIFIED";
        const color = getVerdictColor(verdict);

        return (
          <div key={claim.id || claim.text} style={{ borderLeft: `4px solid ${color}`, padding: "8px 12px", margin: "8px 0" }}>
            <strong style={{ color }}>{verdict}</strong>: {claim.text}
            {claimEvidence?.files?.length || claimEvidence?.commits?.length ? (
              <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>
                {claimEvidence.files?.length ? `Files: ${claimEvidence.files.join(", ")}` : ""}
                {claimEvidence.commits?.length ? `${claimEvidence.files?.length ? " | " : ""}Commits: ${claimEvidence.commits.map((c: any) => c.sha?.slice(0, 7)).join(", ")}` : ""}
              </div>
            ) : null}
            {driftFlag?.reason ? (
              <div style={{ fontSize: 12, color: "#aaa", marginTop: 4 }}>{driftFlag.reason}</div>
            ) : null}
            {driftFlag?.specReference ? (
              <div style={{ fontSize: 12, color: "#f59e0b", marginTop: 4, fontFamily: "monospace" }}>
                &rarr; {driftFlag.specReference}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
