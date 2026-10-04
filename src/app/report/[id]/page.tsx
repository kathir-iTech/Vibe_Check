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
      <main style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
        <h1>Invalid report link</h1>
        <p>
          This link doesn&rsquo;t contain a valid report. Generate a new one from
          the main page.
        </p>
        <p>
          <a href="/">Back to VibeCheck</a>
        </p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
      <h1>VibeCheck Report</h1>
      {report.repoUrl ? (
        <p style={{ fontSize: 14 }}>
          Repo:{" "}
          <a href={report.repoUrl} target="_blank" rel="noreferrer">
            {report.repoUrl}
          </a>
        </p>
      ) : null}
      {report.generatedAt ? (
        <p style={{ fontSize: 14, color: "#888" }}>
          Generated: {report.generatedAt}
        </p>
      ) : null}

      <div style={{ border: "1px solid #333", borderRadius: 8, padding: 16, margin: 16 }}>
        <h2>Results</h2>
        <ResultsPanel
          claims={report.claims}
          evidence={report.evidence}
          driftFlags={report.verdicts}
        />
      </div>
    </main>
  );
}
