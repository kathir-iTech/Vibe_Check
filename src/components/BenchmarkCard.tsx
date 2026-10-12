"use client";

import { useState } from "react";

import BenchmarkResults from "benchmark/results.json";

interface BenchmarkCardProps {
  data: BenchmarkResults | null;
  fallback: JSX.Element;
}

interface BenchmarkResults {
  status?: "not-run";
  headSha?: string;
  runs?: any[][];
  summary?: {
    falseClaimsReturnedTrue: { count: number; total: number; details: string[] };
    unverifiableClaimsReturnedTrue: { count: number; total: number; details: string[] };
    trueClaimsReturnedTrue: { count: number; total: number; details: string[] };
    verdictChangedBetweenRuns: { count: number; total: number; details: string[] };
    medianLatencyMs: number;
    p95LatencyMs: number;
  };
  fallbackRuns?: number[];
  createdAt?: string;
}

export function BenchmarkCard({ data, fallback }: BenchmarkCardProps) {
  if (data?.status === "not-run") {
    return fallback;
  }

  if (!data) {
    return fallback;
  }

  const { headSha, summary, createdAt } = data;
  const shortSha = headSha?.slice(0, 7) || "unknown";

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        Benchmark
      </h2>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">HEAD:</span>
          <code className="font-mono bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">{shortSha}</code>
          <span className="text-zinc-500 dark:text-zinc-400">({new Date(createdAt || "").toLocaleString()})</span>
          <a
            href="/benchmark/results.json"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-400"
          >
            raw JSON
          </a>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="False → TRUE"
            value={`${summary?.falseClaimsReturnedTrue.count ?? 0} / ${summary?.falseClaimsReturnedTrue.total ?? 0}`}
            details={summary?.falseClaimsReturnedTrue.details}
            color="red"
          />
          <StatCard
            label="Unverifiable → TRUE"
            value={`${summary?.unverifiableClaimsReturnedTrue.count ?? 0} / ${summary?.unverifiableClaimsReturnedTrue.total ?? 0}`}
            details={summary?.unverifiableClaimsReturnedTrue.details}
            color="amber"
          />
          <StatCard
            label="True → TRUE"
            value={`${summary?.trueClaimsReturnedTrue.count ?? 0} / ${summary?.trueClaimsReturnedTrue.total ?? 0}`}
            details={summary?.trueClaimsReturnedTrue.details}
            color="emerald"
          />
          <StatCard
            label="Verdict Changed"
            value={`${summary?.verdictChangedBetweenRuns.count ?? 0} / ${summary?.verdictChangedBetweenRuns.total ?? 0}`}
            details={summary?.verdictChangedBetweenRuns.details}
            color="blue"
          />
        </div>

        <div className="flex flex-wrap gap-4 text-sm text-zinc-600 dark:text-zinc-400">
          <span>Median latency: <span className="font-mono font-semibold">{summary?.medianLatencyMs ?? 0}ms</span></span>
          <span>P95 latency: <span className="font-mono font-semibold">{summary?.p95LatencyMs ?? 0}ms</span></span>
        </div>

        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          benchmark/ and devpost/ are excluded from evidence.
        </p>
      </div>
    </section>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  details: string[] | undefined;
  color: "red" | "amber" | "emerald" | "blue";
}

function StatCard({ label, value, details, color }: StatCardProps) {
  const [expanded, setExpanded] = useState(false);
  const colorClasses = {
    red: "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400",
    amber: "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400",
    emerald: "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400",
    blue: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400",
  };

  return (
    <div className={`rounded-lg border p-3 ${colorClasses[color]}`}>
      <p className="text-xs uppercase tracking-wider font-semibold">{label}</p>
      <p className="mt-1 text-lg font-mono font-semibold">{value}</p>
      {details && details.length > 0 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 text-xs underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
          aria-expanded={expanded}
        >
          {expanded ? "Hide details" : `Show ${details.length} detail(s)`}
        </button>
      )}
      {expanded && details && (
        <ul className="mt-2 space-y-1 text-[11px] font-mono">
          {details.map((d, i) => (
            <li key={i} className="break-all">{d}</li>
          ))}
        </ul>
      )}
    </div>
  );
}