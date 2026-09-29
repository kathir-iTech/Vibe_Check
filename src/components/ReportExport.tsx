"use client";
export function ReportExport({ report }: { report?: { id?: string; permalink?: string; claims?: any[] } }) {
  if (!report) return null;

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vibecheck-report-${report.id || "unknown"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <button onClick={handleExport}>Export Report (JSON)</button>
      {report.permalink ? (
        <a href={report.permalink} target="_blank" rel="noreferrer">
          View Report
        </a>
      ) : null}
    </div>
  );
}
