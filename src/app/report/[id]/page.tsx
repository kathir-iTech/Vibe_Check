import { ResultsPanel } from "@/components/ResultsPanel";

interface ReportData {
  repoUrl: string;
  claims: any[];
  evidence: Record<string, any>;
  verdicts: any[];
  generatedAt: string;
}

function decodeReport(id: string): ReportData | null {
  try {
    const json = Buffer.from(id, "base64url").toString("utf8");
    const data = JSON.parse(json);
    if (!data || !Array.isArray(data.claims)) return null;
    return {
      repoUrl: typeof data.repoUrl === "string" ? data.repoUrl : "",
      claims: data.claims,
      evidence:
        data.evidence && typeof data.evidence === "object" ? data.evidence : {},
      verdicts: Array.isArray(data.verdicts) ? data.verdicts : [],
      generatedAt: typeof data.generatedAt === "string" ? data.generatedAt : "",
    };
  } catch {
    return null;
  }
}

export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const report = decodeReport(id);

  if (!report) {
    return (
      <main className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:py-12">
        <section className="rounded-xl border border-red-200 bg-white p-5 shadow-sm dark:border-red-500/30 dark:bg-zinc-900">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            Invalid report link
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            This link doesn&rsquo;t contain a valid report. Generate a new one from the main
            page.
          </p>
          <p className="mt-4">
            <a
              href="/"
              className="text-sm font-medium text-emerald-700 underline underline-offset-2 hover:text-emerald-600 dark:text-emerald-400 dark:hover:text-emerald-300"
            >
              Back to VibeCheck
            </a>
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1.5">
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            VibeCheck Forensic Audit Report
          </h1>
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
            </p>
          ) : null}
          {report.generatedAt ? (
            <p className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
              Generated: {report.generatedAt}
            </p>
          ) : null}
        </div>
        <a
          href="/"
          className="rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
        >
          &larr; Run New Check
        </a>
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
