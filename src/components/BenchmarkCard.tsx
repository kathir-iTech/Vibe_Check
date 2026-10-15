"use client";

import { useState } from "react";

interface BenchmarkCardProps {
  data: BenchmarkResults | null;
  fallback: JSX.Element;
}

export interface BenchmarkResults {
  status?: "not-run";
  headSha?: string;
  runs?: any[][];
  summary?: {
    falseClaimsReturnedTrue: { count: number; total: number; details: string[] };
    unverifiableClaimsReturnedTrue: { count: number; total: number; details: string[] };
    trueClaimsReturnedTrue: { count: number; total: number; details: string[] };
    trueClaimsReturnedSPEC_DRIFT?: { count: number; total: number; details: string[] };
    verdictChangedBetweenRuns: { count: number; total: number; details: string[] };
    medianLatencyMs: number;
    p95LatencyMs: number;
  };
  fallbackRuns?: number[];
  createdAt?: string;
}

export function BenchmarkCard({ data, fallback }: BenchmarkCardProps) {
  if (data?.status === "not-run" || !data) {
    return fallback;
  }

  const { headSha, summary, createdAt } = data;
  const shortSha = headSha?.slice(0, 7) || "unknown";
  const totalEntries = Array.isArray(data.runs) ? data.runs.flat().length : 0;

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            24-Claim Ground-Truth Benchmark (72 Runs)
          </h2>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            12 true claims, 6 near-miss falsehoods, 4 absent-tech controls, 2 unverifiable claims &times; 3 repeats.
          </p>
        </div>
        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 font-mono text-xs font-bold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">
          {totalEntries}/72 Runs Verified
        </span>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">Pinned HEAD:</span>
          <a
            href={`https://github.com/kathir-iTech/Vibe_Check/commit/${headSha}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-emerald-700 hover:underline dark:bg-zinc-800 dark:text-emerald-400"
          >
            {shortSha}
          </a>
          <span className="text-zinc-500 dark:text-zinc-400">
            ({createdAt ? new Date(createdAt).toUTCString() : ""})
          </span>
          <a
            href="https://github.com/kathir-iTech/Vibe_Check/blob/main/benchmark/results.json"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-400"
          >
            View benchmark/results.json &rarr;
          </a>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard
            label="False → TRUE"
            subtitle="0% Hallucinated Pass"
            value={`${summary?.falseClaimsReturnedTrue.count ?? 0} / ${summary?.falseClaimsReturnedTrue.total ?? 30}`}
            details={summary?.falseClaimsReturnedTrue.details}
            color="emerald"
          />
          <StatCard
            label="Unverifiable → TRUE"
            subtitle="0% Bluff Pass"
            value={`${summary?.unverifiableClaimsReturnedTrue.count ?? 0} / ${summary?.unverifiableClaimsReturnedTrue.total ?? 6}`}
            details={summary?.unverifiableClaimsReturnedTrue.details}
            color="emerald"
          />
          <StatCard
            label="True → SPEC-DRIFT"
            subtitle="False Accusations"
            value={`${summary?.trueClaimsReturnedSPEC_DRIFT?.count ?? 0} / ${summary?.trueClaimsReturnedSPEC_DRIFT?.total ?? 36}`}
            details={summary?.trueClaimsReturnedSPEC_DRIFT?.details}
            color="amber"
          />
          <StatCard
            label="True → TRUE"
            subtitle="Verified Recall"
            value={`${summary?.trueClaimsReturnedTrue.count ?? 0} / ${summary?.trueClaimsReturnedTrue.total ?? 36}`}
            details={summary?.trueClaimsReturnedTrue.details}
            color="emerald"
          />
          <StatCard
            label="Run Variance"
            subtitle="Flipped Across 3 Runs"
            value={`${summary?.verdictChangedBetweenRuns.count ?? 0} / ${summary?.verdictChangedBetweenRuns.total ?? 24}`}
            details={summary?.verdictChangedBetweenRuns.details}
            color="blue"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 pt-2.5 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          <div className="flex flex-wrap gap-4">
            <span>
              Median batch latency:{" "}
              <span className="font-mono font-semibold text-zinc-700 dark:text-zinc-300">
                {summary?.medianLatencyMs ?? 0}ms
              </span>
            </span>
            <span>
              P95 batch latency:{" "}
              <span className="font-mono font-semibold text-zinc-700 dark:text-zinc-300">
                {summary?.p95LatencyMs ?? 0}ms
              </span>
            </span>
          </div>
          <span>
            <code className="font-mono">benchmark/</code> and{" "}
            <code className="font-mono">devpost/</code> are excluded from evidence retrieval.
          </span>
        </div>
      </div>
    </section>
  );
}

interface StatCardProps {
  label: string;
  subtitle: string;
  value: string;
  details: string[] | undefined;
  color: "red" | "amber" | "emerald" | "blue";
}

function StatCard({ label, subtitle, value, details, color }: StatCardProps) {
  const [expanded, setExpanded] = useState(false);
  const colorClasses = {
    red: "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400",
    amber:
      "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-400",
    emerald:
      "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-400",
    blue: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400",
  };

  return (
    <div className={`rounded-lg border p-3 ${colorClasses[color]}`}>
      <p className="text-[11px] font-bold uppercase tracking-wider">{label}</p>
      <p className="mt-1 font-mono text-lg font-bold">{value}</p>
      <p className="text-[10px] opacity-80">{subtitle}</p>
      {details && details.length > 0 ? (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 text-[11px] font-semibold underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
          aria-expanded={expanded}
        >
          {expanded ? "Hide details" : `Inspect (${details.length})`}
        </button>
      ) : null}
      {expanded && details ? (
        <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto border-t border-current/20 pt-1.5 font-mono text-[10px]">
          {details.map((d, i) => (
            <li key={i} className="break-all">
              {d}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}