import { Claim } from "@/types";
import { EvidenceDisplay } from "./EvidenceDisplay";
import { CheckIcon, ExternalLinkIcon, QuestionIcon, ShieldIcon, WarningIcon } from "./icons";

interface Props {
  claims: Claim[];
  evidence: Record<string, any>;
  driftFlags: any[];
  loading?: boolean;
  models?: ResultModels;
  repoUrl?: string;
  timings?: { evidenceMs?: number; driftMs?: number; totalMs?: number };
  onLoadSample?: () => void;
}

export interface ModelInfo {
  model: string;
  modelFallback?: boolean;
}

export interface ResultModels {
  extract?: ModelInfo;
  drift?: ModelInfo;
}

function answeredBy(info: ModelInfo): string {
  return `answered by ${info.model}${info.modelFallback ? " (fallback)" : ""}`;
}

function modelLabel(models?: ResultModels): string {
  const extract = models?.extract;
  const drift = models?.drift;
  if (extract && drift) {
    const same = extract.model === drift.model && !!extract.modelFallback === !!drift.modelFallback;
    return same
      ? answeredBy(extract)
      : `claims ${answeredBy(extract)} · drift ${answeredBy(drift)}`;
  }
  if (extract) return answeredBy(extract);
  if (drift) return answeredBy(drift);
  return "";
}

interface VerdictStyle {
  className: string;
  cardBorder: string;
  Icon: (props: { className?: string }) => JSX.Element;
}

const VERDICT_STYLES: Record<string, VerdictStyle> = {
  TRUE: {
    className:
      "bg-emerald-100 text-emerald-800 border border-emerald-300/70 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30",
    cardBorder:
      "border-l-4 border-l-emerald-500 border-zinc-200 dark:border-zinc-800 dark:border-l-emerald-500",
    Icon: CheckIcon,
  },
  UNVERIFIED: {
    className:
      "bg-red-100 text-red-700 border border-red-300/70 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/30",
    cardBorder:
      "border-l-4 border-l-red-500 border-zinc-200 dark:border-zinc-800 dark:border-l-red-500",
    Icon: QuestionIcon,
  },
  "SPEC-DRIFT": {
    className:
      "bg-amber-100 text-amber-800 border border-amber-300/70 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30",
    cardBorder:
      "border-l-4 border-l-amber-500 border-zinc-200 dark:border-zinc-800 dark:border-l-amber-500",
    Icon: WarningIcon,
  },
};

const FALLBACK_STYLE: VerdictStyle = {
  className: "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300",
  cardBorder: "border-zinc-200 dark:border-zinc-800",
  Icon: QuestionIcon,
};

export function VerdictBadge({ verdict }: { verdict: string }) {
  const style = VERDICT_STYLES[verdict] || FALLBACK_STYLE;
  const { Icon } = style;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide ${style.className}`}
    >
      <Icon className="h-3 w-3" />
      {verdict}
    </span>
  );
}

function cleanRepoBaseUrl(repoUrl?: string): string | null {
  if (!repoUrl) return null;
  const m = repoUrl.trim().match(/github\.com\/([^/\s]+)\/([^/\s#?]+)/i);
  if (!m) return null;
  const owner = m[1];
  const repo = m[2].replace(/\.git$/, "");
  return `https://github.com/${owner}/${repo}`;
}

function parseSpecRef(specRef: string): { file: string; line: number | null; quote: string } | null {
  if (!specRef) return null;
  const m = specRef.match(/^([^:\s]+):(\d+):\s*([\s\S]*)$/);
  if (!m) return null;
  return {
    file: m[1],
    line: Number(m[2]) || null,
    quote: m[3],
  };
}

function ResultsSkeleton() {
  return (
    <div role="status" className="space-y-3">
      <div className="flex items-center gap-2 text-xs font-medium text-emerald-700 dark:text-emerald-400">
        <span className="inline-block h-2 w-2 animate-ping rounded-full bg-emerald-500" />
        <span>Checking claims against repo evidence &amp; spec documents&hellip;</span>
      </div>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="animate-pulse space-y-2.5 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-800/50"
        >
          <div className="flex items-center gap-2">
            <div className="h-5 w-24 rounded-full bg-zinc-200 dark:bg-zinc-700" />
            <div className="h-4 flex-1 rounded bg-zinc-200 dark:bg-zinc-700" />
          </div>
          <div className="h-3 w-2/3 rounded bg-zinc-200/70 dark:bg-zinc-700/70" />
          <div className="h-8 w-full rounded bg-zinc-200/50 dark:bg-zinc-700/40" />
        </div>
      ))}
    </div>
  );
}

export function ResultsPanel({
  claims,
  evidence,
  driftFlags,
  loading,
  models,
  repoUrl,
  timings,
  onLoadSample,
}: Props) {
  if (loading) {
    return <ResultsSkeleton />;
  }

  if (!claims.length) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50/60 p-6 text-center dark:border-zinc-800 dark:bg-zinc-900/40">
        <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          Ready to audit your coding agent&rsquo;s claims.
        </p>
        <p className="mx-auto mt-1 max-w-lg text-xs text-zinc-500 dark:text-zinc-400">
          Click <strong>Check Claims</strong> above to run live against GitHub + Gemini, or preview a pre-verified three-verdict audit immediately with zero API calls.
        </p>
        {onLoadSample ? (
          <div className="mt-3">
            <button
              type="button"
              onClick={onLoadSample}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-600/40 bg-emerald-50 px-3.5 py-1.5 text-xs font-semibold text-emerald-900 transition-colors hover:bg-emerald-100 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-200 dark:hover:bg-emerald-500/25"
            >
              <span>⚡ Preview Sample Verdicts Instantly (0 API Calls)</span>
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  const label = modelLabel(models);
  const ghBase = cleanRepoBaseUrl(repoUrl);

  let trueCount = 0;
  let driftCount = 0;
  let unverifiedCount = 0;
  let anyTreeTruncated = false;

  for (const claim of claims) {
    const df = driftFlags.find((d) => d.claimId === (claim.id || claim.text));
    const v = df?.verdict || "UNVERIFIED";
    if (v === "TRUE") trueCount++;
    else if (v === "SPEC-DRIFT") driftCount++;
    else unverifiedCount++;
    const ev = evidence[claim.id || claim.text];
    if (ev?.treeTruncated) anyTreeTruncated = true;
  }

  const totalCount = claims.length;
  const honestyScore = totalCount > 0 ? Math.round((trueCount / totalCount) * 100) : 0;
  const scoreBadgeColor =
    honestyScore >= 80 && driftCount === 0
      ? "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30"
      : driftCount > 0
        ? "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30"
        : "bg-red-100 text-red-800 border-red-300 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/30";

  return (
    <div className="space-y-4">
      {anyTreeTruncated ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
          Note: Target repository exceeds GitHub&rsquo;s single-tree response limit (<code className="font-mono">truncated=true</code>); deep paths outside the first tree page may not be indexed.
        </p>
      ) : null}

      {/* Build Honesty Scorecard */}
      <div className="rounded-xl border border-zinc-200 bg-zinc-50/90 p-4 dark:border-zinc-800 dark:bg-zinc-800/50">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
              <ShieldIcon className="h-4 w-4" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Build Honesty Scorecard
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                  {honestyScore}% Verified Support
                </span>
                <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${scoreBadgeColor}`}>
                  {trueCount}/{totalCount} TRUE
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
            <span className="rounded-md bg-emerald-100/80 px-2.5 py-1 font-semibold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">
              ✓ {trueCount} TRUE
            </span>
            <span className="rounded-md bg-amber-100/80 px-2.5 py-1 font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
              ⚠ {driftCount} SPEC-DRIFT
            </span>
            <span className="rounded-md bg-red-100/80 px-2.5 py-1 font-semibold text-red-700 dark:bg-red-500/15 dark:text-red-300">
              ? {unverifiedCount} UNVERIFIED
            </span>
          </div>
        </div>

        {(label || timings?.totalMs) ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-200/80 pt-2.5 font-mono text-[11px] text-zinc-500 dark:border-zinc-700/70 dark:text-zinc-400">
            {label ? <span>{label}</span> : <span />}
            {timings?.totalMs ? (
              <span>
                pipeline: {timings.evidenceMs ? `evidence ${timings.evidenceMs}ms · ` : ""}
                {timings.driftMs ? `drift ${timings.driftMs}ms · ` : ""}
                total {timings.totalMs}ms
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Claim-by-claim verdict list */}
      <ul className="space-y-3">
        {claims.map((claim, idx) => {
          const claimEvidence = evidence[claim.id || claim.text];
          const driftFlag = driftFlags.find(
            (d) => d.claimId === (claim.id || claim.text)
          );
          const verdict = driftFlag?.verdict || "UNVERIFIED";
          const vStyle = VERDICT_STYLES[verdict] || FALLBACK_STYLE;
          const branch = claimEvidence?.defaultBranch || "main";
          const parsedRef = parseSpecRef(driftFlag?.specReference || "");

          return (
            <li
              key={claim.id || claim.text}
              className={`space-y-2.5 rounded-xl border bg-white p-4 shadow-sm transition-colors dark:bg-zinc-900 ${vStyle.cardBorder}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2.5">
                  <VerdictBadge verdict={verdict} />
                  <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[11px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                    #{idx + 1}
                  </span>
                  <p className="min-w-0 flex-1 break-words text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {claim.text}
                  </p>
                </div>
              </div>

              {driftFlag?.reason ? (
                <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
                  {driftFlag.reason}
                </p>
              ) : null}

              {/* Verified Citation Block with Deep Link */}
              {driftFlag?.specReference ? (
                <div
                  className={`rounded-lg border p-2.5 font-mono text-xs leading-relaxed ${
                    verdict === "TRUE"
                      ? "border-emerald-200 bg-emerald-50/70 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-950/30 dark:text-emerald-300"
                      : "border-amber-200 bg-amber-50/70 text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-300"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider opacity-80">
                      {verdict === "TRUE"
                        ? "Verified Source Citation"
                        : "Verified Spec Contradiction"}
                    </span>
                    {ghBase && parsedRef ? (
                      <a
                        href={`${ghBase}/blob/${branch}/${parsedRef.file}${
                          parsedRef.line ? `#L${parsedRef.line}` : ""
                        }`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-semibold underline underline-offset-2 hover:opacity-80"
                      >
                        <span>
                          {parsedRef.file}
                          {parsedRef.line ? `:${parsedRef.line}` : ""}
                        </span>
                        <ExternalLinkIcon className="h-3 w-3" />
                      </a>
                    ) : null}
                  </div>
                  <p className="mt-1 break-all">
                    &rarr; {driftFlag.specReference}
                  </p>
                </div>
              ) : null}

              <EvidenceDisplay evidence={claimEvidence} ghBase={ghBase} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
