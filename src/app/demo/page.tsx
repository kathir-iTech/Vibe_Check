import { ResultsPanel } from "@/components/ResultsPanel";
import { ReportExport } from "@/components/ReportExport";
import {
  demoClaims,
  demoEvidence,
  demoVerdicts,
  demoRepoUrl,
} from "@/lib/demo-data";

export default function DemoPage() {
  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1.5">
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Fallback Demo Mode (/demo &amp; ?demo=1)
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Pre-verified sample claims against{" "}
            <a
              href={demoRepoUrl}
              target="_blank"
              rel="noreferrer"
              className="break-all font-medium text-emerald-700 underline underline-offset-2 hover:text-emerald-600 dark:text-emerald-400 dark:hover:text-emerald-300"
            >
              {demoRepoUrl}
            </a>
          </p>
        </div>
        <a
          href="/"
          className="rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
        >
          &larr; Back to Live Inspector
        </a>
      </div>

      <p className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm font-medium text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">
        Sample data &mdash; no live API calls. Demonstrates all three reachable verdict states (<code className="font-mono">TRUE</code>, <code className="font-mono">UNVERIFIED</code>, <code className="font-mono">SPEC-DRIFT</code>) with real repository citations.
      </p>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Results
        </h2>
        <ResultsPanel
          claims={demoClaims}
          evidence={demoEvidence}
          driftFlags={demoVerdicts}
          repoUrl={demoRepoUrl}
        />
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Export Demo Report
        </h2>
        <ReportExport
          repoUrl={demoRepoUrl}
          claims={demoClaims}
          evidence={demoEvidence}
          verdicts={demoVerdicts}
        />
      </section>
    </main>
  );
}
