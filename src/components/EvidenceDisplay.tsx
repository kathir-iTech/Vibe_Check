export function EvidenceDisplay({ evidence }: { evidence: any }) {
  if (!evidence || !evidence.commits?.length) {
    return (
      <p className="text-xs text-zinc-500 dark:text-zinc-400">No evidence yet.</p>
    );
  }
  return (
    <div className="space-y-1 text-xs text-zinc-600 dark:text-zinc-300">
      {evidence.commits.map((c: any, i: number) => (
        <div key={i}>
          <code className="font-mono">{c.sha?.slice(0, 7)}</code>: {c.message}
        </div>
      ))}
      {evidence.files?.length ? (
        <p className="break-all">
          <strong className="font-semibold">Files:</strong> {evidence.files.join(", ")}
        </p>
      ) : null}
    </div>
  );
}
