import { Claim } from "@/types";

export function formatClaimText(claim: Claim): string {
  return claim.text;
}

export function getVerdictColor(verdict: string): string {
  switch (verdict) {
    case "TRUE":
      return "#22c55e";
    case "UNVERIFIED":
      return "#ef4444";
    case "SPEC-DRIFT":
      return "#f59e0b";
    default:
      return "#666";
  }
}
