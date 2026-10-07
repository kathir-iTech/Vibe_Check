"use client";
import { useState } from "react";
import { SelfAuditResult } from "@/types";
import { SELF_AUDIT_SEED } from "@/lib/self-audit-seed";
import { cacheKey, formatStamp, readCached, writeCached } from "@/lib/result-cache";
import { SpinnerIcon } from "./icons";
import { VerdictBadge } from "./ResultsPanel";

const SELF_AUDIT_KEY = cacheKey([
  "self-audit",
  "https://github.com/kathir-iTech/Vibe_Check",
]);

export function SelfAudit() {
  const [result, setResult] = useState<SelfAuditResult>(SELF_AUDIT_SEED);
  const [source, setSource] = useState<"seed" | "live" | "cached">("seed");
  const [savedAt, setSavedAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function rerun(forceLive = false) {
    if (!forceLive) {
      const cached = readCached<SelfAuditResult>(SELF_AUDIT_KEY);
      if (cached) {
        setResult(cached.data);
        setSource("cached");
        setSavedAt(cached.savedAt);
        setError("");
        console.info("[VibeCheck] self-audit cache hit — served from sessionStorage, 0 fetch calls");
        return;
      }
    }

    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/self-audit", { method: "POST" });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || `self-audit failed (${res.status})`);
      }
      const entry = writeCached<SelfAuditResult>(SELF_AUDIT_KEY, data as SelfAuditResult);
      setResult(entry.data);
      setSource("live");
      setSavedAt(entry.savedAt);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="min-w-0 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
          Three fixed claims about VibeCheck itself, run through the real
          pipeline against{" "}
          <span className="break-all font-mono text-zinc-700 dark:text-zinc-300">
            github.com/kathir-iTech/Vibe_Check
          </span>
          . Seeded from a genuine run &mdash; nothing fires until you ask it to.
        </p>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            onClick={() => rerun(false)}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
          >
            {loading ? <SpinnerIcon className="h-3.5 w-3.5" /> : null}
            {loading ? "Re-running..." : "Re-run"}
          </button>
          <button
            onClick={() => rerun(true)}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
          >
            {loading ? <SpinnerIcon className="h-3.5 w-3.5" /> : null}
            {loading ? "Re-running..." : "Re-run live"}
          </button>
        </div>
      </div>

      <p
        role="status"
        className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400"
      >
        {loading
          ? "Running self-audit against the repo..."
          : source === "cached"
            ? `Cached result (saved ${formatStamp(savedAt)}) \u2014 Re-run live for a fresh check. Last run: ${result.runAt}`
            : source === "live"
              ? `Last run: ${result.runAt} (live)`
              : `Last run: ${result.runAt}`}
      </p>

      {error ? (
        <p className="text-sm font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}

      <ul className="space-y-3">
        {result.claims.map((claim) => (
          <li
            key={claim.id}
            className="space-y-2 rounded-lg border border-zinc-100 bg-zinc-50 p-3.5 dark:border-zinc-800 dark:bg-zinc-800/50"
          >
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <VerdictBadge verdict={claim.verdict} />
              <p className="min-w-0 flex-1 break-words text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {claim.text}
              </p>
            </div>
            {claim.files.length || claim.commits.length ? (
              <p className="break-all font-mono text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                {claim.files.length
                  ? `Files: ${claim.files.join(", ")}`
                  : ""}
                {claim.commits.length
                  ? `${claim.files.length ? " | " : ""}Commits: ${claim.commits
                      .map((c) => c.sha?.slice(0, 7))
                      .join(", ")}`
                  : ""}
              </p>
            ) : null}
            {claim.reason ? (
              <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
                {claim.reason}
              </p>
            ) : null}
            {claim.specReference ? (
              <p className="break-all font-mono text-xs leading-relaxed text-amber-700 dark:text-amber-400">
                &rarr; {claim.specReference}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
