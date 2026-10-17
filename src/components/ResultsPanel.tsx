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
      "bg-emerald-500/15 text-emerald-700 border border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30",
    cardBorder:
      "border-l-4 border-l-emerald-500 border-zinc-200/90 dark:border-zinc-800 dark:border-l-emerald-500",
    Icon: CheckIcon,
  },
  UNVERIFIED: {
    className:
      "bg-red-500/15 text-red-700 border border-red-500/30 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/30",
    cardBorder:
      "border-l-4 border-l-red-500 border-zinc-200/90 dark:border-zinc-800 dark:border-l-red-500",
    Icon: QuestionIcon,
  },
  "SPEC-DRIFT": {
    className:
      "bg-amber-500/15 text-amber-800 border border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30",
    cardBorder:
      "border-l-4 border-l-amber-500 border-zinc-200/90 dark:border-zinc-800 dark:border-l-amber-500",
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
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${style.className}`}
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
    <div role="status" className="space-y-2.5">
      <div className="flex items-center gap-2 text-xs font-medium text-emerald-700 dark:text-emerald-400">
        <span className="inline-block h-2 w-2 animate-ping rounded-full bg-emerald-500" />
        <span>Verifying claims against repository files, diffs &amp; specs&hellip;</span>
      </div>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="animate-pulse space-y-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3.5 dark:border-zinc-800 dark:bg-zinc-800/50"
        >
          <div className="flex items-center gap-2">
            <div className="h-5 w-20 rounded-full bg-zinc-200 dark:bg-zinc-700" />
            <div className="h-4 flex-1 rounded bg-zinc-200 dark:bg-zinc-700" />
          </div>
          <div className="h-3 w-2/3 rounded bg-zinc-200/70 dark:bg-zinc-700/70" />
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
          Ready to audit your coding agent&rsquo;s claims
        </p>
        {onLoadSample ? (
          <div className="mt-3">
            <button
              type="button"
              onClick={onLoadSample}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
            >
              <span>⚡ Load 3-Verdict Sample</span>
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

  return (
    <div className="space-y-3">
      {anyTreeTruncated ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
          Note: Repository tree exceeds single-page limit (<code className="font-mono">truncated=true</code>).
        </p>
      ) : null}

      {/* Compact Build Honesty Scorecard */}
      <div className="rounded-xl border border-zinc-200/90 bg-zinc-50/90 p-3.5 dark:border-zinc-800 dark:bg-zinc-800/40">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <ShieldIcon className="h-4 w-4" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                  {honestyScore}% Verified Support
                </span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  Build Honesty Score
                </span>
              </div>
              {(label || timings?.totalMs) ? (
                <p className="font-mono text-[10px] text-zinc-500 dark:text-zinc-400">
                  {label ? `${label} · ` : ""}
                  {timings?.totalMs ? `${timings.totalMs}ms` : ""}
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 font-mono text-xs">
            <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-semibold text-emerald-700 dark:text-emerald-300">
              ✓ {trueCount} TRUE
            </span>
            <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 font-semibold text-amber-700 dark:text-amber-300">
              ⚠ {driftCount} DRIFT
            </span>
            <span className="rounded-md border border-red-500/30 bg-red-500/10 px-2 py-0.5 font-semibold text-red-700 dark:text-red-300">
              ? {unverifiedCount} UNVERIFIED
            </span>
          </div>
        </div>
      </div>

      {/* Scannable Claim Verdict Cards */}
      <ul className="space-y-2.5">
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
              className={`space-y-2 rounded-xl border bg-white p-3.5 shadow-sm transition-colors dark:bg-zinc-900/90 ${vStyle.cardBorder}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <VerdictBadge verdict={verdict} />
                  <p className="min-w-0 flex-1 break-words text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {claim.text}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-[10px] text-zinc-400">
                  #{idx + 1}
                </span>
              </div>

              {driftFlag?.reason ? (
                <p className="text-xs text-zinc-600 dark:text-zinc-400">
                  {driftFlag.reason}
                </p>
              ) : null}

              {/* Compact Clickable Citation Box */}
              {driftFlag?.specReference ? (
                <div
                  className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 font-mono text-[11px] ${
                    verdict === "TRUE"
                      ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200"
                      : "border-amber-500/25 bg-amber-500/10 text-amber-900 dark:text-amber-200"
                  }`}
                >
                  <span className="line-clamp-1 flex-1 break-all">
                    &rarr; { parsedRef ? parsedRef.quote : driftFlag.specReference }
                  </span>
                  {ghBase && parsedRef ? (
                    <a
                      href={`${ghBase}/blob/${branch}/${parsedRef.file}${
                        parsedRef.line ? `#L${parsedRef.line}` : ""
                      }`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex shrink-0 items-center gap-1 rounded bg-black/10 px-1.5 py-0.5 text-[10px] font-bold underline-offset-2 hover:underline dark:bg-white/10"
                    >
                      <span>
                        {parsedRef.file}
                        {parsedRef.line ? `:${parsedRef.line}` : ""}
                      </span>
                      <ExternalLinkIcon className="h-2.5 w-2.5" />
                    </a>
                  ) : null}
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
