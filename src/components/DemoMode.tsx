"use client";
import { ResultsPanel } from "./ResultsPanel";
import {
  demoClaims,
  demoEvidence,
  demoVerdicts,
  demoRepoUrl,
} from "@/lib/demo-data";

interface Props {
  onLoadIntoInspector?: () => void;
}

export function DemoMode({ onLoadIntoInspector }: Props) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
          Pre-verified three-verdict sample (<code className="font-mono">TRUE</code>,{" "}
          <code className="font-mono">UNVERIFIED</code>,{" "}
          <code className="font-mono">SPEC-DRIFT</code>) against{" "}
          <span className="font-mono text-zinc-700 dark:text-zinc-300">
            kathir-iTech/Vibe_Check
          </span>{" "}
          &mdash; runs with zero network or API calls.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {onLoadIntoInspector ? (
            <button
              onClick={onLoadIntoInspector}
              className="rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
            >
              Load Into Main Inspector &uarr;
            </button>
          ) : null}
          <a
            href="/demo"
            className="rounded-lg border border-zinc-300 bg-zinc-50 px-3.5 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800/70 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            Open Standalone /demo Page &rarr;
          </a>
        </div>
      </div>

      <ResultsPanel
        claims={demoClaims}
        evidence={demoEvidence}
        driftFlags={demoVerdicts}
        repoUrl={demoRepoUrl}
      />
    </div>
  );
}
