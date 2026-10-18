"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Audit } from "@/types/audit";
import { AuditResults } from "@/components/AuditResults";
import { downloadFile, verifyDownloadedReport } from "@/lib/report-client";
export default function VerifiedReportPage() {
  const [audit, setAudit] = useState<Audit | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const raw = location.hash.slice(1);
        if (!raw || raw.length > 256 * 1024)
          throw new Error(
            "Report fragment is missing or exceeds the size limit.",
          );
        const json = new TextDecoder().decode(
          Uint8Array.from(
            atob(raw.replace(/-/g, "+").replace(/_/g, "/")),
            (c) => c.charCodeAt(0),
          ),
        );
        const report = await verifyDownloadedReport(JSON.parse(json));
        if (!report.verified)
          throw new Error(
            "A service signature is required for this shared audit.",
          );
        if (active) setAudit(report.audit);
      } catch (err) {
        if (active)
          setError(
            err instanceof Error ? err.message : "Report verification failed",
          );
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);
  return (
    <main className="workspace-shell" id="inspector">
      <section className="verified-report">
        <p className="eyebrow">VIBECHECK / SHARED ASSESSMENT</p>
        <h1>
          {error
            ? "This report could not be verified."
            : audit
              ? "The report is intact. Inspect the evidence."
              : "Verifying the complete report…"}
        </h1>
        {error ? (
          <div className="error-message" role="alert">
            {error}
          </div>
        ) : audit ? (
          <>
            <p className="notice-message">
              Ed25519 signature verified against this service’s public key. This
              authenticates the complete assessment bytes; it does not certify
              runtime correctness.
            </p>
            <p className="panel-note">
              {audit.repoUrl} · <code>{audit.headSha.slice(0, 12)}</code> ·{" "}
              {new Date(audit.generatedAt).toLocaleString()}
            </p>
            <AuditResults audit={audit} />
            <div className="report-actions">
              <button
                onClick={() =>
                  downloadFile(
                    "vibecheck-audit.json",
                    JSON.stringify(audit, null, 2),
                  )
                }
              >
                Download signed JSON ↓
              </button>
            </div>
          </>
        ) : null}
        <Link className="text-button" href="/">
          ← Inspect another handoff
        </Link>
      </section>
    </main>
  );
}
