import Link from "next/link";
import type { Metadata } from "next";
import adversarial from "benchmark/v2/adversarial.json";
import evaluation from "benchmark/v3/summary.json";

export const metadata: Metadata = {
  title: "Evaluation & limits · VibeCheck",
  description:
    "Inspect VibeCheck’s recorded source audits, controlled checks and known limits.",
};

export default function EvaluationPage() {
  const latest = evaluation.runs[evaluation.runs.length - 1];
  return (
    <main className="workspace-shell" id="inspector">
      <section className="verified-report evaluation-page">
        <p className="eyebrow">CHECK THE CHECKER</p>
        <h1>Results. With their limits.</h1>
        <p>
          These are selected engineering observations, not a general accuracy
          score.
        </p>
        <div className="historical-metrics">
          <div>
            <strong>
              {latest.expectedOutcomes}/{latest.plannedClaims}
            </strong>
            <span>
              Live expectations matched · {latest.planned} public repos
            </span>
          </div>
          <div>
            <strong>
              {adversarial.summary.currentExpectedOutcomes}/
              {adversarial.summary.cases}
            </strong>
            <span>Manufactured regression cases passed</span>
          </div>
          <div>
            <strong>
              {adversarial.summary.currentUnsafeAccepted}/
              {adversarial.summary.unsafeCases}
            </strong>
            <span>Unsafe outcomes accepted in that controlled set</span>
          </div>
        </div>
        <Link className="recorded-audit-link" href="/proof">
          Open a recorded real audit ↗
        </Link>
        <h2>What was measured</h2>
        <p>
          A frozen plan assessed 33 builder-labeled claims across Express,
          Chalk, Flask, Requests, Hono and Zod. Each repository used a fixed
          commit and explicit file hints. The later run completed six requests
          and matched 32 expectations. This measures selected assessment cases,
          with discovery guided by the builder.
        </p>
        <details className="evaluation-details">
          <summary>Failures, baseline and replay</summary>
          <p>
            The earlier attempt completed 4/6 requests and matched 19/33 planned
            expectations. On the later run, raw model answers matched 33/33; the
            validated pipeline matched 32/33. A narrow declaration check
            addressed the lost case. Replaying the recorded answers through the
            corrected validator matched 33/33, with no new model calls. The
            original live result remains 32/33.
          </p>
          <p>
            A subsequent fresh browser request failed at provider capacity.
            Recorded reports remain inspectable without another AI request; a
            new assessment still needs the provider to respond.
          </p>
        </details>
        <h2>What remains unknown</h2>
        <p>
          There are no independent testers yet. These observations do not
          establish broad semantic accuracy, reliable provider availability,
          time saved, adoption or an advantage over competing tools.
        </p>
        <p>
          Source inspection cannot certify that tests ran, a deployment works or
          a feature behaves correctly. A report signature authenticates this
          service’s assessment; it does not make the conclusion correct.
        </p>
        <div className="report-actions">
          <a
            className="text-button"
            href="https://github.com/kathir-iTech/Vibe_Check/tree/main/benchmark/v3"
            target="_blank"
            rel="noreferrer"
          >
            Raw observations & reproduction ↗
          </a>
          <a
            className="text-button"
            href="https://github.com/kathir-iTech/Vibe_Check/blob/main/benchmark/v2/adversarial.json"
            target="_blank"
            rel="noreferrer"
          >
            Controlled regression record ↗
          </a>
        </div>
        <Link className="text-button" href="/">
          ← Back to workspace
        </Link>
      </section>
    </main>
  );
}
