"use client";
import { useState } from "react";
import { ResultsPanel } from "@/components/ResultsPanel";
import { ReportExport } from "@/components/ReportExport";
import { DemoMode } from "@/components/DemoMode";

export default function Home() {
  const [claims, setClaims] = useState([]);
  const [evidence, setEvidence] = useState({});
  const [driftFlags, setDriftFlags] = useState([]);

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
      <h1>VibeCheck</h1>
      <p>Paste your agent&rsquo;s last claim + a GitHub repo URL. Get verdicts with evidence.</p>

      <div style={{ border: "1px solid #333", borderRadius: 8, padding: 16, margin: 16 }}>
        <h2>Input Panel</h2>
        <textarea id="agentMessage" placeholder="Paste agent message here..." style={{ width: "100%", minHeight: 80, background: "#1a1a1a", color: "#e5e5e5", border: "1px solid #444", borderRadius: 4, padding: 8, fontFamily: "inherit" }} />
        <input type="text" id="repoUrl" placeholder="GitHub repo URL..." style={{ width: "100%", padding: 8, marginTop: 8, background: "#1a1a1a", color: "#e5e5e5", border: "1px solid #444", borderRadius: 4, fontFamily: "inherit" }} />
        <button onClick={() => {}} style={{ padding: "8px 16px", background: "#22c55e", color: "#000", border: "none", borderRadius: 4, cursor: "pointer", fontWeight: "bold", marginTop: 8 }}>Check Claims</button>
      </div>

      <div style={{ border: "1px solid #333", borderRadius: 8, padding: 16, margin: 16 }}>
        <h2>Results</h2>
        <ResultsPanel claims={claims} evidence={evidence} driftFlags={driftFlags} />
      </div>

      <div style={{ border: "1px solid #333", borderRadius: 8, padding: 16, margin: 16 }}>
        <h2>Report</h2>
        <ReportExport />
      </div>

      <div style={{ border: "1px solid #333", borderRadius: 8, padding: 16, margin: 16 }}>
        <h2>Demo Mode</h2>
        <DemoMode />
      </div>
    </main>
  );
}
