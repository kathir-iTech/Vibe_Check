"use client";
import { useState } from "react";

interface Props {
  repoUrl: string;
  claims: any[];
  evidence: Record<string, any>;
  verdicts: any[];
}

export function ReportExport({ repoUrl, claims, evidence, verdicts }: Props) {
  const [permalink, setPermalink] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const hasClaims = claims.length > 0;

  async function handleGenerate() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/generate-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl, claims, evidence, verdicts }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || `generate-report failed (${res.status})`);
      }
      setPermalink(data.permalink);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  function handleExport() {
    const payload = { repoUrl, claims, evidence, verdicts, generatedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "vibecheck-report.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <button
        onClick={handleGenerate}
        disabled={busy || !hasClaims}
        style={{ padding: "8px 16px", background: hasClaims ? "#3b82f6" : "#666", color: "#fff", border: "none", borderRadius: 4, cursor: busy ? "wait" : hasClaims ? "pointer" : "not-allowed", fontWeight: "bold" }}
      >
        {busy ? "Generating..." : "Generate Shareable Report"}
      </button>
      <button
        onClick={handleExport}
        disabled={!hasClaims}
        style={{ padding: "8px 16px", marginLeft: 8, background: hasClaims ? "#555" : "#666", color: "#fff", border: "none", borderRadius: 4, cursor: hasClaims ? "pointer" : "not-allowed" }}
      >
        Export Report (JSON)
      </button>
      {!hasClaims ? (
        <p style={{ fontSize: 13, color: "#888", marginTop: 8 }}>
          Run a check first — a report needs claims.
        </p>
      ) : null}
      {error ? (
        <p style={{ color: "#ef4444", fontSize: 14, marginTop: 8 }}>{error}</p>
      ) : null}
      {permalink ? (
        <div style={{ marginTop: 8 }}>
          <a href={permalink} target="_blank" rel="noreferrer" style={{ color: "#22c55e" }}>
            Open shareable report in new tab
          </a>
          <p style={{ fontSize: 11, color: "#888", wordBreak: "break-all", fontFamily: "monospace", marginTop: 4 }}>
            {permalink}
          </p>
        </div>
      ) : null}
    </div>
  );
}
