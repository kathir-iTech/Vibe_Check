"use client";
import { useState } from "react";
import { ResultsPanel } from "@/components/ResultsPanel";
import { ReportExport } from "@/components/ReportExport";
import { DemoMode } from "@/components/DemoMode";

export default function Home() {
  const [message, setMessage] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [claims, setClaims] = useState<any[]>([]);
  const [evidence, setEvidence] = useState<Record<string, any>>({});
  const [driftFlags, setDriftFlags] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleCheck() {
    if (!message.trim()) {
      setError("Paste an agent message first.");
      return;
    }
    if (!repoUrl.trim()) {
      setError("Enter a GitHub repo URL.");
      return;
    }

    setLoading(true);
    setError("");
    setClaims([]);
    setEvidence({});
    setDriftFlags([]);

    try {
      const extractRes = await fetch("/api/extract-claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, repoUrl }),
      });
      const extractData = await extractRes.json();
      if (!extractRes.ok || extractData.error) {
        throw new Error(extractData.error || `extract-claims failed (${extractRes.status})`);
      }
      const extractedClaims = extractData.claims;
      if (!Array.isArray(extractedClaims) || !extractedClaims.length) {
        throw new Error("No claims were extracted from the message.");
      }
      setClaims(extractedClaims);

      const evidenceRes = await fetch("/api/check-evidence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl, claims: extractedClaims }),
      });
      const evidenceData = await evidenceRes.json();
      if (!evidenceRes.ok || evidenceData.error) {
        throw new Error(evidenceData.error || `check-evidence failed (${evidenceRes.status})`);
      }
      setEvidence(evidenceData.evidence || {});

      const driftRes = await fetch("/api/check-spec-drift", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl, claims: extractedClaims, evidence: evidenceData.evidence || {} }),
      });
      const driftData = await driftRes.json();
      if (!driftRes.ok || driftData.error) {
        throw new Error(driftData.error || `check-spec-drift failed (${driftRes.status})`);
      }
      setDriftFlags(driftData.drift || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
      <h1>VibeCheck</h1>
      <p>Paste your agent&rsquo;s last claim + a GitHub repo URL. Get verdicts with evidence.</p>

      <div style={{ border: "1px solid #333", borderRadius: 8, padding: 16, margin: 16 }}>
        <h2>Input Panel</h2>
        <textarea
          id="agentMessage"
          placeholder="Paste agent message here..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          style={{ width: "100%", minHeight: 80, background: "#1a1a1a", color: "#e5e5e5", border: "1px solid #444", borderRadius: 4, padding: 8, fontFamily: "inherit" }}
        />
        <input
          type="text"
          id="repoUrl"
          placeholder="GitHub repo URL..."
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          style={{ width: "100%", padding: 8, marginTop: 8, background: "#1a1a1a", color: "#e5e5e5", border: "1px solid #444", borderRadius: 4, fontFamily: "inherit" }}
        />
        <button
          onClick={handleCheck}
          disabled={loading}
          style={{ padding: "8px 16px", background: loading ? "#666" : "#22c55e", color: "#000", border: "none", borderRadius: 4, cursor: loading ? "wait" : "pointer", fontWeight: "bold", marginTop: 8 }}
        >
          {loading ? "Checking..." : "Check Claims"}
        </button>
        {error && (
          <p style={{ color: "#ef4444", marginTop: 8, fontSize: 14 }}>{error}</p>
        )}
      </div>

      <div style={{ border: "1px solid #333", borderRadius: 8, padding: 16, margin: 16 }}>
        <h2>Results</h2>
        <ResultsPanel claims={claims} evidence={evidence} driftFlags={driftFlags} />
      </div>

      <div style={{ border: "1px solid #333", borderRadius: 8, padding: 16, margin: 16 }}>
        <h2>Report</h2>
        <ReportExport repoUrl={repoUrl} claims={claims} evidence={evidence} verdicts={driftFlags} />
      </div>

      <div style={{ border: "1px solid #333", borderRadius: 8, padding: 16, margin: 16 }}>
        <h2>Demo Mode</h2>
        <DemoMode />
      </div>
    </main>
  );
}
