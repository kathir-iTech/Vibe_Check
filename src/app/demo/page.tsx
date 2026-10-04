import { ResultsPanel } from "@/components/ResultsPanel";
import {
  demoClaims,
  demoEvidence,
  demoVerdicts,
  demoRepoUrl,
} from "@/lib/demo-data";

export default function DemoPage() {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
      <h1>Demo Mode</h1>
      <p style={{ color: "#f59e0b", fontWeight: "bold" }}>
        Sample data — no live API calls.
      </p>
      <p style={{ fontSize: 14, color: "#888" }}>
        Sample claims against{" "}
        <a href={demoRepoUrl} target="_blank" rel="noreferrer">
          {demoRepoUrl}
        </a>
      </p>

      <div style={{ border: "1px solid #333", borderRadius: 8, padding: 16, margin: 16 }}>
        <h2>Results</h2>
        <ResultsPanel
          claims={demoClaims}
          evidence={demoEvidence}
          driftFlags={demoVerdicts}
        />
      </div>
    </main>
  );
}
