import Link from "next/link";
import observation from "benchmark/v2/public-browser-observation.json";

export default function RecordedProofPage() {
  const audit = observation.result;
  const receipt = Buffer.from(JSON.stringify(audit), "utf8").toString(
    "base64url",
  );
  const href = `https://vibe-check-dev.vercel.app/report/view#${receipt}`;
  return (
    <main className="workspace-shell" id="inspector">
      <section className="verified-report">
        <p className="eyebrow">RECORDED LIVE AUDIT</p>
        <h1>A real run. Kept for inspection.</h1>
        <p className="panel-note">
          Actual GitHub and Gemini responses, captured{" "}
          {new Date(audit.generatedAt)
            .toISOString()
            .replace("T", " ")
            .replace(".000Z", " UTC")}
          .
        </p>
        <p>
          Express source: <code>{audit.headSha.slice(0, 12)}</code>. The agent
          message claimed an MIT license and passing tests.
        </p>
        <p className="example-notice">
          The builder supplied “MIT licensing is forbidden” to exercise conflict
          detection. This test requirement is not the Express project’s policy.
        </p>
        <a
          className="primary-button"
          style={{
            display: "inline-flex",
            textDecoration: "none",
            marginBlock: 20,
          }}
          href={href}
        >
          Verify and open the recorded report <span>↗</span>
        </a>
        <p className="panel-note">
          No new model call. The public service verifies the original report’s
          complete signature before displaying it. This selected run is not a
          reliability or accuracy estimate.
        </p>
        <Link className="text-button" href="/">
          ← Run your own check
        </Link>
      </section>
    </main>
  );
}
