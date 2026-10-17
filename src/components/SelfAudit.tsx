"use client";
import { useState } from "react";
import { EvidenceDisplay } from "./EvidenceDisplay";
import { SelfAuditResult } from "@/types";
import { SELF_AUDIT_SEED } from "@/lib/self-audit-seed";
import { cacheKey, formatStamp, readCached, writeCached } from "@/lib/result-cache";
import { fetchWithTimeout } from "@/lib/http";
import { ExternalLinkIcon, SpinnerIcon } from "./icons";
import { VerdictBadge } from "./ResultsPanel";

const SELF_AUDIT_REPO = "https://github.com/kathir-iTech/Vibe_Check";
const SELF_AUDIT_KEY = cacheKey(["self-audit", SELF_AUDIT_REPO]);

function parseRefLink(specRef: string): { file: string; line: number | null; quote: string } | null {
  if (!specRef) return null;
  const m = specRef.match(/^([^:\s]+):(\d+):\s*([\s\S]*)$/);
  if (!m) return null;
  return { file: m[1], line: Number(m[2]) || null, quote: m[3] };
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 font-mono text-xs font-bold text-emerald-700 dark:text-emerald-300">
            ✓ {trueCount}/{result.claims.length} Self-Claims Verified
          </span>
          <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
            {loading
              ? `Running live check... (${elapsed}s)`
              : source === "cached"
                ? `Cached (${formatStamp(savedAt)})`
                : source === "live"
                  ? `Live (${result.runAt})`
                  : "Verified Repo Snapshot"}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => rerun(false)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-zinc-50 px-2.5 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
          >
            {loading ? <SpinnerIcon className="h-3 w-3" /> : null}
            <span>Re-run</span>
          </button>
          <button
            onClick={() => rerun(true)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-500/20 disabled:opacity-60 dark:text-emerald-300"
          >
            {loading ? <SpinnerIcon className="h-3 w-3" /> : null}
            <span>Re-run Live</span>
          </button>
        </div>
      </div>

      {error ? (
        <p className="text-xs font-medium text-red-600 dark:text-red-400">{error}</p>
      ) : null}

      <div className="grid gap-2.5 md:grid-cols-3">
        {result.claims.map((claim) => {
          const parsedLink = parseRefLink(claim.specReference || "");
          return (
            <div
              key={claim.id}
              className="flex flex-col justify-between space-y-2 rounded-xl border border-zinc-200/90 border-t-4 border-t-emerald-500 bg-zinc-50/60 p-3 dark:border-zinc-800 dark:border-t-emerald-500 dark:bg-zinc-900/60"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <VerdictBadge verdict={claim.verdict} />
                  {parsedLink ? (
                    <a
                      href={`${SELF_AUDIT_REPO}/blob/main/${parsedLink.file}${
                        parsedLink.line ? `#L${parsedLink.line}` : ""
                      }`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-mono text-[10px] font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
                    >
                      <span>
                        {parsedLink.file.split("/").pop()}
                        {parsedLink.line ? `:${parsedLink.line}` : ""}
                      </span>
                      <ExternalLinkIcon className="h-2.5 w-2.5" />
                    </a>
                  ) : null}
                </div>
                <p className="text-xs font-semibold leading-snug text-zinc-900 dark:text-zinc-100">
                  {claim.text}
                </p>
              </div>
              <EvidenceDisplay
                evidence={{ files: claim.files.slice(0, 2), commits: claim.commits.slice(0, 1), defaultBranch: "main" }}
                ghBase={SELF_AUDIT_REPO}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
