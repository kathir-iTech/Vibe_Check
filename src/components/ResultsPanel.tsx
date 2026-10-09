import { Claim } from "@/types";
import { CheckIcon, QuestionIcon, WarningIcon } from "./icons";

interface Props {
  claims: Claim[];
  evidence: Record<string, any>;
  driftFlags: any[];
  loading?: boolean;
  models?: ResultModels;
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
  Icon: (props: { className?: string }) => JSX.Element;
}

const VERDICT_STYLES: Record<string, VerdictStyle> = {
  TRUE: {
    className:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400",
    Icon: CheckIcon,
  },
  UNVERIFIED: {
    className: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
    Icon: QuestionIcon,
  },
  "SPEC-DRIFT": {
    className: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400",
    Icon: WarningIcon,
  },
};

const FALLBACK_STYLE: VerdictStyle = {
  className: "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300",
  Icon: QuestionIcon,
};

export function VerdictBadge({ verdict }: { verdict: string }) {
  const style = VERDICT_STYLES[verdict] || FALLBACK_STYLE;
  const { Icon } = style;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold uppercase tracking-wide ${style.className}`}
    >
      <Icon className="h-3 w-3" />
      {verdict}
    </span>
  );
}

function ResultsSkeleton() {
  return (
    <div role="status" className="space-y-3">
      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
        Checking claims against repo evidence&hellip;
      </p>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="animate-pulse space-y-2 rounded-lg border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-800/50"
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

export function ResultsPanel({ claims, evidence, driftFlags, loading, models }: Props) {
  if (loading) {
    return <ResultsSkeleton />;
  }

  if (!claims.length) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Submit a claim to see verdicts.
      </p>
    );
  }

  const label = modelLabel(models);

  return (
    <div className="space-y-3">
      {label ? (
        <p className="font-mono text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
          {label}
        </p>
      ) : null}
      <ul className="space-y-3">
        {claims.map((claim) => {
          const claimEvidence = evidence[claim.id || claim.text];
          const driftFlag = driftFlags.find(
            (d) => d.claimId === (claim.id || claim.text)
          );
          const verdict = driftFlag?.verdict || "UNVERIFIED";
          const hasFiles = Boolean(claimEvidence?.files?.length);
          const hasCommits = Boolean(claimEvidence?.commits?.length);

          return (
            <li
              key={claim.id || claim.text}
              className="space-y-2 rounded-lg border border-zinc-100 bg-zinc-50 p-3.5 dark:border-zinc-800 dark:bg-zinc-800/50"
            >
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <VerdictBadge verdict={verdict} />
                <p className="min-w-0 flex-1 break-words text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {claim.text}
                </p>
              </div>
              {hasFiles || hasCommits ? (
                <p className="break-all font-mono text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                  {hasFiles ? `Files: ${claimEvidence.files.join(", ")}` : ""}
                  {hasCommits
                    ? `${hasFiles ? " | " : ""}Commits: ${claimEvidence.commits
                        .map((c: any) => c.sha?.slice(0, 7))
                        .join(", ")}`
                    : ""}
                </p>
              ) : null}
              {driftFlag?.reason ? (
                <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
                  {driftFlag.reason}
                </p>
              ) : null}
              {driftFlag?.specReference ? (
                <p
                  className={`break-all font-mono text-xs leading-relaxed ${
                    verdict === "TRUE"
                      ? "text-emerald-700 dark:text-emerald-400"
                      : "text-amber-700 dark:text-amber-400"
                  }`}
                >
                  &rarr; {driftFlag.specReference}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
