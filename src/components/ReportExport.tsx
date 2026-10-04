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
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleGenerate}
          disabled={busy || !hasClaims}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Generating..." : "Generate Shareable Report"}
        </button>
        <button
          onClick={handleExport}
          disabled={!hasClaims}
          className="rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
        >
          Export Report (JSON)
        </button>
      </div>
      {!hasClaims ? (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Run a check first &mdash; a report needs claims.
        </p>
      ) : null}
      {error ? (
        <p className="text-sm font-medium text-red-600 dark:text-red-400">{error}</p>
      ) : null}
      {permalink ? (
        <div className="space-y-1">
          <a
            href={permalink}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium text-emerald-700 underline underline-offset-2 hover:text-emerald-600 dark:text-emerald-400 dark:hover:text-emerald-300"
          >
            Open shareable report in new tab
          </a>
          <p className="break-all font-mono text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
            {permalink}
          </p>
        </div>
      ) : null}
    </div>
  );
}
