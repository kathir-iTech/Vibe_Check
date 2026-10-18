import {
  canonicalJSON,
  unsignedReport,
  validReportShape,
  REPORT_SCHEMA,
} from "./report-format.mjs";
import type { Audit } from "@/types/audit";

export async function verifyDownloadedReport(
  value: unknown,
): Promise<{ audit: Audit; verified: boolean }> {
  if (!validReportShape(value))
    throw new Error("This file is not a valid bounded VibeCheck report.");
  const audit = value as Audit;
  if (!audit.sig)
    return {
      audit: {
        ...audit,
        source: { kind: "imported", label: "User-supplied unsigned file" },
      },
      verified: false,
    };
  if (audit.schema !== REPORT_SCHEMA)
    throw new Error(
      "Legacy signatures do not authenticate complete evidence. Re-audit the source.",
    );
  const response = await fetch("/api/report-key", { cache: "no-store" });
  const key = await response.json();
  if (!response.ok || key.keyId !== audit.keyId)
    throw new Error(
      "The report signing key is unavailable or differs from this service.",
    );
  const binary = Uint8Array.from(atob(key.publicKey), (c) => c.charCodeAt(0));
  const imported = await crypto.subtle.importKey(
    "spki",
    binary,
    { name: "Ed25519" },
    false,
    ["verify"],
  );
  const sig = Uint8Array.from(
    atob(audit.sig.replace(/-/g, "+").replace(/_/g, "/")),
    (c) => c.charCodeAt(0),
  );
  const valid = await crypto.subtle.verify(
    "Ed25519",
    imported,
    sig,
    new TextEncoder().encode(canonicalJSON(unsignedReport(audit))),
  );
  if (!valid)
    throw new Error("Report rejected: its signed content was changed.");
  return { audit, verified: true };
}

export function downloadFile(
  name: string,
  content: string,
  mime = "application/json",
) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function auditMarkdown(audit: Audit) {
  const cell = (s: string) =>
    String(s || "")
      .replace(/\|/g, "\\|")
      .replace(/\r?\n/g, " ");
  return `# VibeCheck audit\n\nRepository: ${audit.repoUrl}\nCommit: ${audit.headSha}\nSource: ${audit.source.label}\nAssessed: ${audit.generatedAt}\nVerifier: ${audit.verifierVersion}\n\nSource support is not a runtime guarantee.\n\n| Claim | Assessment | Evidence / next step |\n|---|---|---|\n${audit.claims
    .map((c) => {
      const v = audit.verdicts.find((v) => v.claimId === c.id);
      return `| ${cell(c.text)} | ${v?.verdict || "UNVERIFIED"} | ${cell(v?.specReference || v?.nextEvidence || "")} |`;
    })
    .join(
      "\n",
    )}\n\n## Limitations\n${audit.warnings.map((w) => `- ${w}`).join("\n")}\n`;
}
