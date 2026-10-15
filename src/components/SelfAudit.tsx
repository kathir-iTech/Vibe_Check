"use client";
import { useState } from "react";
import { SelfAuditResult } from "@/types";
import { SELF_AUDIT_SEED } from "@/lib/self-audit-seed";
import { cacheKey, formatStamp, readCached, writeCached } from "@/lib/result-cache";
import { fetchWithTimeout } from "@/lib/http";
import { ExternalLinkIcon, SpinnerIcon } from "./icons";
import { VerdictBadge } from "./ResultsPanel";

const SELF_AUDIT_REPO = "https://github.com/kathir-iTech/Vibe_Check";
const SELF_AUDIT_KEY = cacheKey(["self-audit", SELF_AUDIT_REPO]);

function parseRefLink(specRef: string): { file: string; line: number | null } | null {
  if (!specRef) return null;
  const m = specRef.match(/^([^:\s]+):(\d+):/);
  if (!m) return null;
  return { file: m[1], line: Number(m[2]) || null };
}

export function SelfAudit() {
  const [result, setResult] = useState<SelfAuditResult>(SELF_AUDIT_SEED);
  const [source, setSource] = useState<"seed" | "live" | "cached">("seed");
  const [savedAt, setSavedAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);

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
    setElapsed(0);
    const startedAt = Date.now();
    const ticker = setInterval(() => setElapsed(Math.round((Date.now() - startedAt) / 1000)), 1000);
    try {
      const res = await fetchWithTimeout("/api/self-audit", { method: "POST" });
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
      clearInterval(ticker);
      setLoading(false);
    }
  }

  const trueCount = result.claims.filter((c) => c.verdict === "TRUE").length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 font-mono text-xs font-bold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">
              {trueCount}/{result.claims.length} Self-Claims Verified
            </span>
            <a
              href={SELF_AUDIT_REPO}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-mono text-xs text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-400"
            >
              <span>github.com/kathir-iTech/Vibe_Check</span>
              <ExternalLinkIcon className="h-3 w-3" />
            </a>
          </div>
          <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
            Three architectural claims about VibeCheck itself, verified through the real pipeline against its own repository. Seeded from a real run &mdash; nothing fires automatically on page load.
          </p>
        </div>
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
            className="inline-flex items-center gap-2 rounded-lg border border-emerald-600/40 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 transition-colors hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/20"
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
          ? `Running self-audit against the repo... (${elapsed}s elapsed)`
          : source === "cached"
            ? `Cached result (saved ${formatStamp(savedAt)}) \u2014 Re-run live for a fresh check. Last run: ${result.runAt}`
            : source === "live"
              ? `Last run: ${result.runAt} (live)`
              : `Last run: ${result.runAt} (verified seed)`}
      </p>

      {error ? (
        <p className="text-sm font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}

      <ul className="space-y-3">
        {result.claims.map((claim) => {
          const parsedLink = parseRefLink(claim.specReference || "");
          return (
            <li
              key={claim.id}
              className="space-y-2 rounded-xl border border-zinc-200 border-l-4 border-l-emerald-500 bg-zinc-50/70 p-3.5 dark:border-zinc-800 dark:border-l-emerald-500 dark:bg-zinc-800/50"
            >
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <VerdictBadge verdict={claim.verdict} />
                <span className="rounded bg-zinc-200/70 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                  {claim.id}
                </span>
                <p className="min-w-0 flex-1 break-words text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {claim.text}
                </p>
              </div>
              {claim.reason ? (
                <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
                  {claim.reason}
                </p>
              ) : null}
              {claim.specReference ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-2 font-mono text-xs leading-relaxed text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-950/30 dark:text-emerald-300">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider opacity-80">
                      Server-Verified Line Citation
                    </span>
                    {parsedLink ? (
                      <a
                        href={`${SELF_AUDIT_REPO}/blob/main/${parsedLink.file}${
                          parsedLink.line ? `#L${parsedLink.line}` : ""
                        }`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-semibold underline underline-offset-2"
                      >
                        <span>
                          {parsedLink.file}
                          {parsedLink.line ? `:${parsedLink.line}` : ""}
                        </span>
                        <ExternalLinkIcon className="h-3 w-3" />
                      </a>
                    ) : null}
                  </div>
                  <p className="mt-0.5 break-all">&rarr; {claim.specReference}</p>
                </div>
              ) : null}
              {claim.files.length || claim.commits.length ? (
                <p className="break-all font-mono text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                  {claim.files.length ? `Files: ${claim.files.join(", ")}` : ""}
                  {claim.commits.length
                    ? `${claim.files.length ? " | " : ""}Commits: ${claim.commits
                        .map((c) => c.sha?.slice(0, 7))
                        .join(", ")}`
                    : ""}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
