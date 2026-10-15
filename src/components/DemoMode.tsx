"use client";
import { useState } from "react";
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
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
          Preloaded three-verdict sample (<code className="font-mono">TRUE</code>,{" "}
          <code className="font-mono">UNVERIFIED</code>,{" "}
          <code className="font-mono">SPEC-DRIFT</code>) against{" "}
          <span className="font-mono text-zinc-700 dark:text-zinc-300">
            kathir-iTech/Vibe_Check
          </span>{" "}
          &mdash; runs with zero network or API calls when GitHub or Gemini is rate-limited.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {onLoadIntoInspector ? (
            <button
              onClick={onLoadIntoInspector}
              className="rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
            >
              Load Demo into Main Inspector
            </button>
          ) : null}
          <button
            onClick={() => setLoaded(!loaded)}
            className="rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            {loaded ? "Hide Inline Preview" : "Preview Demo Cards Here"}
          </button>
          <a
            href="/demo"
            className="rounded-lg border border-zinc-300 bg-zinc-50 px-3.5 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800/70 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            Open /demo Page &rarr;
          </a>
        </div>
      </div>

      {loaded ? (
        <div className="space-y-3 pt-2">
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">
            Sample data &mdash; zero live API calls. All citations point to real lines in{" "}
            <span className="font-mono">{demoRepoUrl}</span>.
          </p>
          <ResultsPanel
            claims={demoClaims}
            evidence={demoEvidence}
            driftFlags={demoVerdicts}
            repoUrl={demoRepoUrl}
          />
        </div>
      ) : null}
    </div>
  );
}
