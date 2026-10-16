import { ExternalLinkIcon } from "./icons";

interface EvidenceDisplayProps {
  evidence: any;
  ghBase?: string | null;
}

export function EvidenceDisplay({ evidence, ghBase }: EvidenceDisplayProps) {
  const hasFiles = Boolean(evidence?.files?.length);
  const hasCommits = Boolean(evidence?.commits?.length);

  if (!hasFiles && !hasCommits) {
    return null;
  }

  const branch = evidence?.defaultBranch || "main";
  const fileMatches: any[] = Array.isArray(evidence?.fileMatches)
    ? evidence.fileMatches
    : [];

  return (
    <div className="space-y-1.5 rounded-lg border border-zinc-100 bg-zinc-50 p-2.5 font-mono text-[11px] text-zinc-600 dark:border-zinc-800 dark:bg-zinc-800/60 dark:text-zinc-400">
      {hasFiles ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-semibold text-zinc-700 dark:text-zinc-300">
            Matched Files:
          </span>
          {evidence.files.map((f: string) => {
            const matchInfo = fileMatches.find((m) => m.file === f);
            const lineSuffix = matchInfo?.lineNumber ? `#L${matchInfo.lineNumber}` : "";
            return ghBase ? (
              <a
                key={f}
                href={`${ghBase}/blob/${branch}/${f}${lineSuffix}`}
                target="_blank"
                rel="noreferrer"
                title={matchInfo?.previewLine || f}
                className="inline-flex items-center gap-1 rounded border border-zinc-200 bg-white px-1.5 py-0.5 text-zinc-700 hover:border-emerald-400 hover:text-emerald-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-emerald-500/50 dark:hover:text-emerald-400"
              >
                <span>{f}</span>
                {matchInfo?.lineNumber ? (
                  <span className="text-[10px] text-emerald-700 dark:text-emerald-400">
                    :{matchInfo.lineNumber}
                  </span>
                ) : null}
                {matchInfo?.hitCount ? (
                  <span className="rounded bg-zinc-100 px-1 text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                    {matchInfo.hitCount}d
                  </span>
                ) : null}
                <ExternalLinkIcon className="h-2.5 w-2.5 opacity-60" />
              </a>
            ) : (
              <span
                key={f}
                className="rounded border border-zinc-200 bg-white px-1.5 py-0.5 dark:border-zinc-700 dark:bg-zinc-900"
              >
                {f}
              </span>
            );
          })}
        </div>
      ) : null}

      {hasCommits ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-semibold text-zinc-700 dark:text-zinc-300">
            Commits &amp; Diffs:
          </span>
          {evidence.commits.map((c: any, cIdx: number) => {
            const sha = typeof c === "string" ? c : c.sha || "";
            const shortSha = sha.slice(0, 7);
            const msg =
              typeof c === "object" && c.message
                ? String(c.message).split("\n")[0]
                : "";
            const diffBadge =
              typeof c === "object" &&
              (typeof c.additions === "number" || typeof c.deletions === "number")
                ? ` (+${c.additions || 0}/-${c.deletions || 0})`
                : "";
            return ghBase && sha ? (
              <a
                key={sha || cIdx}
                href={`${ghBase}/commit/${sha}`}
                target="_blank"
                rel="noreferrer"
                title={msg}
                className="inline-flex items-center gap-1 rounded border border-zinc-200 bg-white px-1.5 py-0.5 text-emerald-700 hover:underline dark:border-zinc-700 dark:bg-zinc-900 dark:text-emerald-400"
              >
                <span>{shortSha}</span>
                {diffBadge ? (
                  <span className="text-[10px] text-zinc-500">{diffBadge}</span>
                ) : null}
              </a>
            ) : (
              <span
                key={sha || cIdx}
                className="rounded bg-zinc-200/70 px-1.5 py-0.5 dark:bg-zinc-700"
              >
                {shortSha}
              </span>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
