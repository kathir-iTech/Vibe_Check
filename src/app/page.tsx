"use client";
import { useState } from "react";
import { ResultsPanel } from "@/components/ResultsPanel";
import { ReportExport } from "@/components/ReportExport";
import { DemoMode } from "@/components/DemoMode";
import { SpinnerIcon } from "@/components/icons";

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
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:py-12">
      <h1 className="sr-only">VibeCheck</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Paste your agent&rsquo;s last claim + a GitHub repo URL. Get verdicts with evidence.
      </p>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Input Panel
        </h2>
        <div className="space-y-3">
          <textarea
            id="agentMessage"
            rows={4}
            placeholder="Paste agent message here..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="block w-full min-h-[7rem] resize-y rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2.5 font-mono text-sm text-zinc-900 placeholder-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
          />
          <input
            type="text"
            id="repoUrl"
            placeholder="GitHub repo URL..."
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            className="block w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2.5 font-mono text-sm text-zinc-900 placeholder-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
          />
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              onClick={handleCheck}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? <SpinnerIcon className="h-4 w-4" /> : null}
              {loading ? "Checking..." : "Check Claims"}
            </button>
            {error ? (
              <p className="text-sm font-medium text-red-600 dark:text-red-400">{error}</p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Results
        </h2>
        <ResultsPanel
          claims={claims}
          evidence={evidence}
          driftFlags={driftFlags}
          loading={loading}
        />
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Report
        </h2>
        <ReportExport repoUrl={repoUrl} claims={claims} evidence={evidence} verdicts={driftFlags} />
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Demo Mode
        </h2>
        <DemoMode />
      </section>
    </main>
  );
}
