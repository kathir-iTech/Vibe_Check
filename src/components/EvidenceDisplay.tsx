export function EvidenceDisplay({ evidence }: { evidence: any }) {
  if (!evidence || !evidence.commits?.length) {
    return <p className="placeholder">No evidence yet.</p>;
  }
  return (
    <div style={{ fontSize: 12 }}>
      {evidence.commits.map((c: any, i: number) => (
        <div key={i}>
          <code>{c.sha?.slice(0, 7)}</code>: {c.message}
        </div>
      ))}
      {evidence.files?.length ? (
        <div style={{ marginTop: 4 }}>
          <strong>Files:</strong> {evidence.files.join(", ")}
        </div>
      ) : null}
    </div>
  );
}
