"use client";
import { useState } from "react";
import { RETROACTIVE_AUDIT_CASEBOOK } from "@/lib/demo-data";
import { VerdictBadge } from "./ResultsPanel";

interface Props {
  onSelectCase?: (agentClaim: string) => void;
}

export function RetroactiveCasebook({ onSelectCase }: Props) {
  const [expanded, setExpanded] = useState(false);

  const totalBuilds = RETROACTIVE_AUDIT_CASEBOOK.length;
  const caughtCount = RETROACTIVE_AUDIT_CASEBOOK.filter(
    (c) => c.vibeCheckVerdict !== "TRUE"
  ).length;
  const visibleCases = expanded
    ? RETROACTIVE_AUDIT_CASEBOOK
    : RETROACTIVE_AUDIT_CASEBOOK.slice(0, 3);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 font-mono text-xs font-bold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
              {caughtCount} / {totalBuilds} Historical Overclaims Caught
            </span>
            <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
              scope.md &gt; The Unique Kernel (&ldquo;2am Discovery Prevention&rdquo;)
            </span>
          </div>
          <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
            Retroactive audit across 8 real solo hackathon builds where coding agents reported &ldquo;100% complete / deployed / tested&rdquo; before failure was discovered at 2am.
          </p>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
        >
          {expanded ? "Show Top 3 Cases" : `Show All ${totalBuilds} Historical Builds`}
        </button>
      </div>

      <div className="grid gap-2.5">
        {visibleCases.map((entry) => (
          <div
            key={entry.id}
            className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-3.5 dark:border-zinc-800 dark:bg-zinc-800/40"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-zinc-200/80 px-1.5 py-0.5 font-mono text-[11px] font-bold text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">
                  Build #{entry.buildNumber}
                </span>
                <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {entry.projectName}
                </span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  ({entry.event} &middot; {entry. failureModeCode})
                </span>
              </div>
              <VerdictBadge verdict={entry.vibeCheckVerdict} />
            </div>

            <p className="mt-2 rounded border border-zinc-200/80 bg-white px-2.5 py-1.5 font-mono text-xs text-zinc-800 dark:border-zinc-700/80 dark:bg-zinc-900 dark:text-zinc-200">
              <span className="font-semibold text-zinc-500">Agent claimed:</span> &ldquo;{entry.agentClaim}&rdquo;
            </p>

            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-600 dark:text-zinc-300">
              <p className="flex-1">
                <strong className="font-semibold text-zinc-800 dark:text-zinc-200">
                  Forensic Reality:
                </strong>{" "}
                {entry.caughtEvidence} &mdash;{" "}
                <span className="text-zinc-500 dark:text-zinc-400">{entry.impactSummary}</span>
              </p>
              {onSelectCase ? (
                <button
                  onClick={() => onSelectCase(entry.agentClaim)}
                  className="shrink-0 font-mono text-[11px] font-semibold text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-400"
                >
                  Test Claim in Inspector &uarr;
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
