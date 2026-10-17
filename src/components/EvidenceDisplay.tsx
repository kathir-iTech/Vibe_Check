import { ExternalLinkIcon } from "./icons";

interface EvidenceDisplayProps {
  evidence: any;
  ghBase?: string | null;
}

export function EvidenceDisplay({ evidence, ghBase }: EvidenceDisplayProps) {
  const files: string[] = Array.isArray(evidence?.files) ? evidence.files : [];
  const commits: any[] = Array.isArray(evidence?.commits) ? evidence.commits : [];

  if (!files.length && !commits.length) {
    return null;
  }

  const branch = evidence?.defaultBranch || "main";
  const fileMatches: any[] = Array.isArray(evidence?.fileMatches)
    ? evidence.fileMatches
    : [];

  return (
    <div className="flex flex-wrap items-center gap-1.5 pt-1 font-mono text-[11px]">
      {files.slice(0, 4).map((f: string) => {
        const matchInfo = fileMatches.find((m) => m.file === f);
        const lineSuffix = matchInfo?.lineNumber ? `#L${matchInfo.lineNumber}` : "";
        return ghBase ? (
          <a
            key={f}
            href={`${ghBase}/blob/${branch}/${f}${lineSuffix}`}
            target="_blank"
            rel="noreferrer"
            title={matchInfo?.previewLine || f}
            className="inline-flex items-center gap-1 rounded-md border border-zinc-200/80 bg-zinc-50 px-2 py-0.5 text-zinc-700 transition-colors hover:border-emerald-500/50 hover:text-emerald-700 dark:border-zinc-800 dark:bg-zinc-800/70 dark:text-zinc-300 dark:hover:border-emerald-500/50 dark:hover:text-emerald-300"
          >
            <span>📄 {f}</span>
            {matchInfo?.lineNumber ? (
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400">
                :{matchInfo.lineNumber}
              </span>
            ) : null}
            <ExternalLinkIcon className="h-2.5 w-2.5 opacity-50" />
          </a>
        ) : (
          <span
            key={f}
            className="rounded-md border border-zinc-200/80 bg-zinc-50 px-2 py-0.5 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-800/70 dark:text-zinc-300"
          >
            📄 {f}
          </span>
        );
      })}

      {commits.slice(0, 2).map((c: any, cIdx: number) => {
        const sha = typeof c === "string" ? c : c.sha || "";
        const shortSha = sha.slice(0, 7);
        const msg =
          typeof c === "object" && c.message
            ? String(c.message).split("\n")[0]
            : "";
        const diffBadge =
          typeof c === "object" &&
          (typeof c.additions === "number" || typeof c.deletions === "number")
            ? ` +${c.additions || 0}/-${c.deletions || 0}`
            : "";
        return ghBase && sha ? (
          <a
            key={sha || cIdx}
            href={`${ghBase}/commit/${sha}`}
            target="_blank"
            rel="noreferrer"
            title={msg}
            className="inline-flex items-center gap-1 rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-emerald-700 hover:underline dark:text-emerald-300"
          >
            <span>🔨 {shortSha}</span>
            {diffBadge ? (
              <span className="text-[10px] opacity-80">{diffBadge}</span>
            ) : null}
          </a>
        ) : null;
      })}
    </div>
  );
}
