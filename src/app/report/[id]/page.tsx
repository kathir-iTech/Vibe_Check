import Link from "next/link";
import { ResultsPanel } from "@/components/ResultsPanel";
import { safeDecodeReportId } from "@/lib/report-crypto.mjs";

export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const report = safeDecodeReportId(id);

  if (!report || !report.signatureVerified) {
    return (
      <main className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:py-12">
        <section className="rounded-xl border border-red-200 bg-white p-5 shadow-sm dark:border-red-500/30 dark:bg-zinc-900">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            Invalid or tampered report link
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            This link doesn&rsquo;t contain a valid VibeCheck report payload (or
            contains invalid verdict enums). Generate a new report from the main
            inspector.
          </p>
          <p className="mt-4">
            <Link
              href="/"
              className="text-sm font-medium text-emerald-700 underline underline-offset-2 hover:text-emerald-600 dark:text-emerald-400 dark:hover:text-emerald-300"
            >
              Back to VibeCheck
            </Link>
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              VibeCheck Forensic Audit Report
            </h1>
            {report.signatureVerified ? (
              <span className="rounded-full border border-emerald-500/30 bg-emerald-100 px-2.5 py-0.5 font-mono text-[11px] font-bold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">
                ✓ Complete Ed25519 signature
              </span>
            ) : (
              <span className="rounded-full border border-amber-500/30 bg-amber-100 px-2.5 py-0.5 font-mono text-[11px] font-bold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                ⚠ Unsigned / Legacy Permalink
              </span>
            )}
          </div>
          {report.repoUrl ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Repo:{" "}
              <a
                href={report.repoUrl}
                target="_blank"
                rel="noreferrer"
                className="break-all font-medium text-emerald-700 underline underline-offset-2 hover:text-emerald-600 dark:text-emerald-400 dark:hover:text-emerald-300"
              >
                {report.repoUrl}
              </a>
              {report.headSha ? (
                <span className="ml-2 font-mono text-xs text-zinc-500">
                  @ {report.headSha.slice(0, 7)}
                </span>
              ) : null}
            </p>
          ) : null}
          {report.generatedAt ? (
            <p className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
              Generated: {report.generatedAt}
            </p>
          ) : null}
        </div>
        <Link
          href="/"
          className="rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
        >
          &larr; Run New Check
        </Link>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Results
        </h2>
        <ResultsPanel
          claims={report.claims}
          evidence={report.evidence}
          driftFlags={report.verdicts}
          repoUrl={report.repoUrl}
        />
      </section>
    </main>
  );
}
