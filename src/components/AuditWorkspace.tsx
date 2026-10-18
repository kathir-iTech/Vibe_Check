"use client";
import { useEffect, useRef, useState } from "react";
import type { Audit } from "@/types/audit";
import { AuditResults } from "./AuditResults";
import { EXAMPLE_AUDIT } from "@/lib/example-audit";
import {
  auditMarkdown,
  downloadFile,
  verifyDownloadedReport,
} from "@/lib/report-client";
import adversarial from "benchmark/v2/adversarial.json";
import liveEvaluation from "benchmark/v2/live-evaluation.json";

const defaultMessage =
  "Configured Next.js and Tailwind CSS. All tests passed. Added Google OAuth login.";
const stages = [
  ["source", "Resolve revision"],
  ["claims", "Extract claims"],
  ["evidence", "Inspect source"],
  ["assessment", "Assess evidence"],
  ["report", "Issue report"],
];
const presets = [
  ["Mixed handoff", defaultMessage],
  [
    "Execution overclaim",
    "All tests passed and the application is deployed to production.",
  ],
  [
    "Inspect source",
    "Next.js is a dependency. The project uses sessionStorage for result caching.",
  ],
];
const STORE = "vibecheck-workspace-v2";
export default function AuditWorkspace({
  startWithExample = false,
}: {
  startWithExample?: boolean;
}) {
  const [mode, setMode] = useState("message");
  const [message, setMessage] = useState(defaultMessage);
  const [repoUrl, setRepoUrl] = useState(
    "https://github.com/kathir-iTech/Vibe_Check",
  );
  const [sourceUrl, setSourceUrl] = useState("");
  const [headSha, setHeadSha] = useState("");
  const [baseSha, setBaseSha] = useState("");
  const [requirements, setRequirements] = useState("");
  const [token, setToken] = useState("");
  const [audit, setAudit] = useState<Audit | null>(null);
  const [previous, setPrevious] = useState<Audit | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [restored, setRestored] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (
      startWithExample ||
      new URLSearchParams(location.search).get("demo") === "1"
    ) {
      setAudit(EXAMPLE_AUDIT);
      setStorageReady(true);
      return;
    }
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORE) || "null");
      if (saved?.audit) {
        setAudit(saved.audit);
        setReceipt(saved.receipt || null);
        setRestored(true);
      }
      if (saved?.message) setMessage(saved.message);
      if (saved?.repoUrl) setRepoUrl(saved.repoUrl);
      if (saved?.mode) setMode(saved.mode);
      if (saved?.sourceUrl) setSourceUrl(saved.sourceUrl);
      if (saved?.headSha) setHeadSha(saved.headSha);
      if (saved?.baseSha) setBaseSha(saved.baseSha);
      if (saved?.requirements) setRequirements(saved.requirements);
    } catch {
      /* storage is optional */
    }
    setStorageReady(true);
    return () => abortRef.current?.abort();
  }, [startWithExample]);
  useEffect(() => {
    if (!storageReady || busy) return;
    const timer = setTimeout(() => {
      try {
        sessionStorage.setItem(
          STORE,
          JSON.stringify({
            audit,
            receipt,
            message,
            repoUrl,
            mode,
            sourceUrl,
            headSha,
            baseSha,
            requirements,
          }),
        );
      } catch {
        /* storage is optional */
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [
    storageReady,
    busy,
    audit,
    receipt,
    message,
    repoUrl,
    mode,
    sourceUrl,
    headSha,
    baseSha,
    requirements,
  ]);
  function remember(next: Audit, nextReceipt: string | null) {
    try {
      sessionStorage.setItem(
        STORE,
        JSON.stringify({ audit: next, receipt: nextReceipt, message, repoUrl }),
      );
    } catch {
      /* quotas do not prevent auditing */
    }
  }
  async function run(editedClaims?: string[], latest = false) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    setRestored(false);
    setStage("source");
    const controller = new AbortController();
    abortRef.current = controller;
    const timer = setTimeout(() => controller.abort(), 190000);
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "application/x-ndjson",
      };
      if (token.trim()) headers["x-github-token"] = token.trim();
      const claims =
        editedClaims ||
        (mode === "claims"
          ? message
              .split("\n")
              .map((s) => s.trim())
              .filter(Boolean)
          : null);
      const response = await fetch("/api/audit", {
        method: "POST",
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          repoUrl,
          message: claims ? undefined : message,
          claims: claims?.map((text, i) => ({ id: `claim-${i + 1}`, text })),
          sourceUrl: mode === "source" ? sourceUrl : undefined,
          headSha: latest ? "" : headSha,
          baseSha: latest && audit ? audit.headSha : baseSha,
          requirements,
        }),
      });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error || "Audit request failed");
      }
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No audit response received");
      const decoder = new TextDecoder();
      let buffer = "";
      let completed = false;
      while (true) {
        const chunk = await reader.read();
        buffer += decoder.decode(chunk.value || new Uint8Array(), {
          stream: !chunk.done,
        });
        let split;
        while ((split = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, split);
          buffer = buffer.slice(split + 1);
          if (!line.trim()) continue;
          const event = JSON.parse(line);
          if (event.type === "stage") setStage(event.stage);
          if (event.type === "error") throw new Error(event.error);
          if (event.type === "result") {
            if (audit) setPrevious(audit);
            setAudit(event.audit);
            setReceipt(event.auditReceipt);
            remember(event.audit, event.auditReceipt);
            setNotice(event.signingWarning || "");
            setStage("done");
            completed = true;
          }
        }
        if (chunk.done) break;
      }
      if (!completed)
        throw new Error(
          "The connection ended before a complete assessment arrived. Your input is preserved; retry when ready.",
        );
    } catch (err) {
      setError(
        controller.signal.aborted
          ? "Audit stopped. Your input and earlier result are preserved."
          : err instanceof Error
            ? /DEADLINE_EXCEEDED|Deadline expired|timed out/i.test(err.message)
              ? "The AI provider timed out. Your input is saved; please retry."
              : /RESOURCE_EXHAUSTED|\"code\":429/i.test(err.message)
                ? "The AI provider is at capacity. Your input is saved; try again shortly."
                : err.message
            : "Audit failed",
      );
      setStage("error");
    } finally {
      clearTimeout(timer);
      setBusy(false);
      abortRef.current = null;
    }
  }
  function example() {
    if (audit) setPrevious(audit);
    setAudit(EXAMPLE_AUDIT);
    setReceipt(null);
    setRestored(false);
    setError("");
    setNotice("");
    setStage("");
  }
  async function importFile(file: File) {
    try {
      if (file.size > 200000)
        throw new Error("Report exceeds the 200KB import limit");
      const result = await verifyDownloadedReport(
        JSON.parse(await file.text()),
      );
      if (audit) setPrevious(audit);
      setAudit(result.audit);
      setReceipt(null);
      setNotice(
        result.verified
          ? "Report signature verified against this service’s public key."
          : "Imported unsigned file. Its assessments are user-supplied and are not authenticated.",
      );
      setRestored(false);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    }
  }
  async function share() {
    try {
      const response = await fetch("/api/generate-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auditReceipt: receipt }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      await navigator.clipboard.writeText(body.permalink);
      setNotice(
        "Verified report link copied. Anyone with the link can read its included evidence.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create report");
    }
  }
  async function copy() {
    if (!audit) return;
    try {
      await navigator.clipboard.writeText(auditMarkdown(audit));
      setNotice("Audit Markdown copied.");
    } catch {
      downloadFile("vibecheck-audit.md", auditMarkdown(audit), "text/markdown");
    }
  }
  const live = audit?.source.kind === "live";
  return (
    <main className="workspace-shell" id="inspector">
      <section className="workspace-intro">
        <div>
          <p className="eyebrow">AI HANDOFFS. REAL EVIDENCE.</p>
          <h1>
            AI says done.
            <br />
            <span>Check the proof.</span>
          </h1>
          <p className="intro-copy">
            Match your agent’s claims to the code. Know what still needs proof.
          </p>
        </div>
        <div className="intro-aside">
          <button
            className="example-button"
            onClick={example}
            disabled={!storageReady}
          >
            <span className="play-icon" aria-hidden="true">
              ▶
            </span>
            Try an example <span aria-hidden="true">↗</span>
          </button>
          <span className="example-caption">No setup. No API call.</span>
        </div>
      </section>
      <div className="workspace-grid">
        <aside className="input-panel">
          <div className="panel-heading">
            <span className="eyebrow">01 / INPUT</span>
            <span className="small-tag">Read-only</span>
          </div>
          <h2>What did your agent say?</h2>
          <div
            className="input-tabs"
            role="group"
            aria-label="Claim input format"
          >
            {[
              ["message", "Message"],
              ["claims", "Claim list"],
              ["source", "PR / commit"],
            ].map(([id, label]) => (
              <button
                key={id}
                aria-pressed={mode === id}
                disabled={busy}
                onClick={() => setMode(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run();
            }}
          >
            {mode === "source" ? (
              <>
                <label htmlFor="source-url">GitHub PR or commit URL</label>
                <input
                  id="source-url"
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  disabled={busy}
                  placeholder="https://github.com/owner/repo/pull/123"
                  required
                />
                <p className="field-help">
                  The source revision is resolved from the URL. Clear the target
                  below to use its repository automatically.
                </p>
              </>
            ) : (
              <>
                <label htmlFor="agent-message">
                  {mode === "claims"
                    ? "One atomic claim per line"
                    : "Agent completion message"}
                </label>
                <textarea
                  ref={inputRef}
                  id="agent-message"
                  rows={4}
                  maxLength={8192}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  disabled={busy}
                  required
                />
                <div className="field-meta">
                  <span>
                    {mode === "claims"
                      ? "Up to 15 claims · 300 characters each"
                      : "We’ll check each claim"}
                  </span>
                  <span>{message.length}/8192</span>
                </div>
              </>
            )}
            <label htmlFor="repository">GitHub repository</label>
            <input
              id="repository"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              disabled={busy}
              placeholder="https://github.com/owner/repo"
              required={mode !== "source"}
            />
            <details className="advanced-options">
              <summary>
                Add requirements <span>+</span>
              </summary>
              <label htmlFor="review-requirements">
                Optional requirements · one per line
              </label>
              <textarea
                id="review-requirements"
                rows={4}
                maxLength={3000}
                value={requirements}
                onChange={(e) => setRequirements(e.target.value)}
                disabled={busy}
                placeholder="Must preserve the existing API.&#10;Redis caching is forbidden."
              />
              <p className="field-help">
                Your review requirements are labeled separately from the
                repository’s own plan.
              </p>
            </details>
            <details className="advanced-options">
              <summary>
                Advanced options <span>+</span>
              </summary>
              <label htmlFor="revision">
                Inspect a commit <span className="quiet">optional</span>
              </label>
              <input
                id="revision"
                placeholder="Commit SHA · blank uses current default branch"
                value={headSha}
                onChange={(e) => setHeadSha(e.target.value)}
                disabled={busy}
              />
              <label htmlFor="base-revision">
                Compare against <span className="quiet">optional</span>
              </label>
              <input
                id="base-revision"
                placeholder="Full base commit SHA"
                value={baseSha}
                onChange={(e) => setBaseSha(e.target.value)}
                disabled={busy}
              />
              <label htmlFor="read-token">
                Your GitHub read token <span className="quiet">optional</span>
              </label>
              <input
                id="read-token"
                type="password"
                autoComplete="off"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                disabled={busy}
                placeholder="For your private repository or higher API limits"
              />
              <p className="field-help">
                Sent to this service and GitHub for this request. Never stored
                in the browser cache or included in a report.
              </p>
            </details>
            <button
              className="primary-button audit-button"
              disabled={busy || !storageReady}
              type="submit"
            >
              {busy ? "Checking the proof…" : "Check the proof"}
              <span>{busy ? "◌" : "↗"}</span>
            </button>
            {busy && (
              <button
                className="text-button"
                type="button"
                onClick={() => abortRef.current?.abort()}
              >
                Stop this request
              </button>
            )}
          </form>
          <details className="presets">
            <summary>Need a sample message?</summary>
            {presets.map(([label, text]) => (
              <button
                key={label}
                disabled={busy}
                onClick={() => {
                  setMode("message");
                  setMessage(text);
                  inputRef.current?.focus();
                }}
              >
                {label}
                <span>↗</span>
              </button>
            ))}
          </details>
          <p className="input-footnote">
            One fixed commit. Source inspection only; no code execution.
          </p>
        </aside>
        <section className="results-panel" aria-label="Audit results">
          <div className="panel-heading">
            <span className="eyebrow">02 / RESULTS</span>
            {audit && (
              <span className={`source-tag ${live ? "source-live" : ""}`}>
                {restored
                  ? "Restored in this tab"
                  : audit.source.kind === "demo"
                    ? "Example · illustrative"
                    : audit.source.kind === "imported"
                      ? "Imported · unsigned"
                      : "Live server assessment"}
              </span>
            )}
          </div>
          {(busy || stage === "error") && (
            <ol className="audit-progress" aria-label="Audit progress">
              {stages.map(([id, label], i) => {
                const index = stages.findIndex(([s]) => s === stage);
                return (
                  <li
                    key={id}
                    className={
                      id === stage ? "active" : index > i ? "completed" : ""
                    }
                  >
                    <span>{index > i ? "✓" : i + 1}</span>
                    {label}
                  </li>
                );
              })}
            </ol>
          )}
          {error && (
            <div className="error-message" role="alert">
              <strong>The assessment needs attention</strong>
              <p>{error}</p>
            </div>
          )}
          {notice && (
            <p className="notice-message" role="status">
              {notice}
            </p>
          )}
          <div aria-live="polite" className="sr-only">
            {busy
              ? `Current audit stage: ${stage}`
              : audit
                ? `${audit.claims.length} claims assessed`
                : ""}
          </div>
          {busy && audit && (
            <p className="panel-note">
              The earlier assessment remains visible while this request runs.
            </p>
          )}
          {audit ? (
            <>
              <div className="audit-title">
                <h2>
                  {audit.source.kind === "demo"
                    ? "A quick look at the results."
                    : "Here’s what holds up."}
                </h2>
                <p>
                  <a
                    href={`${audit.repoUrl}/commit/${audit.headSha}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {audit.repoUrl.replace("https://github.com/", "")}{" "}
                    <code>@{audit.headSha.slice(0, 8)}</code> ↗
                  </a>
                  {audit.generatedAt && (
                    <span>
                      {" "}
                      · {new Date(audit.generatedAt).toLocaleString()}
                    </span>
                  )}
                </p>
              </div>
              {audit.source.kind === "demo" && (
                <p className="example-notice">
                  Sample results for illustration. No live audit was run.
                </p>
              )}
              <AuditResults
                audit={audit}
                previous={previous}
                onCheckRequirement={(text) => {
                  setMode("claims");
                  setMessage(text.slice(0, 300));
                  inputRef.current?.focus();
                }}
              />
              <div className="report-actions">
                <button
                  onClick={() =>
                    downloadFile(
                      "vibecheck-audit.json",
                      JSON.stringify(audit, null, 2),
                    )
                  }
                >
                  Download JSON ↓
                </button>
                <button onClick={() => void copy()}>Copy PR Markdown</button>
                <button
                  disabled={!receipt || !live}
                  onClick={() => void share()}
                >
                  Copy verified link ↗
                </button>
                <button
                  disabled={busy || !live}
                  onClick={() =>
                    void run(
                      audit.claims.map((c) => c.text),
                      true,
                    )
                  }
                >
                  Recheck latest revision
                </button>
              </div>
              <details className="report-help">
                <summary>About this report</summary>
                <p>
                  {receipt
                    ? "Complete report signed by this service. Source conclusions still require judgment."
                    : "This assessment has no shareable server receipt. Unsigned exports retain their source label."}{" "}
                  Reports include source excerpts; share only material you
                  intend to disclose.
                </p>
              </details>
            </>
          ) : (
            <div className="empty-audit">
              <div className="signal-visual" aria-hidden="true">
                <span />
                <span />
                <span />
                <b>✓</b>
                <span />
                <span />
                <span />
              </div>
              <h2>
                Less guessing.
                <br />
                More evidence.
              </h2>
              <p>Paste a message and add its GitHub repo to start.</p>
              <div
                className="result-preview"
                aria-label="Possible result types, not live results"
              >
                <div>
                  <span className="preview-dot supported" />
                  Source supported<span>Code backs it up</span>
                </div>
                <div>
                  <span className="preview-dot unverified" />
                  Needs evidence<span>Proof is missing</span>
                </div>
                <div>
                  <span className="preview-dot conflict" />
                  Planning conflict<span>Check the requirements</span>
                </div>
              </div>
            </div>
          )}
          <div className="import-bar">
            <span>Already have a report?</span>
            <button
              className="text-button"
              disabled={busy || !storageReady}
              onClick={() => uploadRef.current?.click()}
            >
              Import & verify JSON ↗
            </button>
            <input
              className="sr-only"
              type="file"
              accept="application/json,.json"
              aria-label="Import audit report"
              disabled={busy || !storageReady}
              ref={uploadRef}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void importFile(file);
                e.target.value = "";
              }}
            />
          </div>
        </section>
      </div>
      <section className="method-section" id="method">
        <div>
          <p className="eyebrow">HOW IT WORKS</p>
          <h2>
            From “done”
            <br />
            to documented.
          </h2>
        </div>
        <div className="method-grid">
          <article>
            <span>01</span>
            <h3>Pin the code.</h3>
            <p>
              Check one fixed commit, so every citation points to the same code.
            </p>
          </article>
          <article>
            <span>02</span>
            <h3>Check each claim.</h3>
            <p>
              Read the code and plan. A test script alone doesn’t prove tests
              passed.
            </p>
          </article>
          <article>
            <span>03</span>
            <h3>Keep the evidence.</h3>
            <p>
              Follow the citations, recheck a fix, and share a signed report.
            </p>
          </article>
        </div>
      </section>
      <section className="evaluation-section" id="evaluation">
        <div>
          <p className="eyebrow">CHECK THE CHECKER</p>
          <h2>Proof, including ours.</h2>
          <p>Small, reproducible checks. Open results, including failures.</p>
        </div>
        <div className="historical-metrics">
          <div>
            <strong>
              {adversarial.summary.currentExpectedOutcomes}/
              {adversarial.summary.cases}
            </strong>
            <span>Controlled verification cases passed</span>
          </div>
          <div>
            <strong>
              {adversarial.summary.currentUnsafeAccepted}/
              {adversarial.summary.unsafeCases}
            </strong>
            <span>Unsafe cases accepted in that set</span>
          </div>
          <div>
            <strong>
              {liveEvaluation.summary.matchedOutcomes}/
              {liveEvaluation.summary.labeledClaims}
            </strong>
            <span>Live labeled claims matched · 2 public repos</span>
          </div>
        </div>
        <details className="evaluation-details">
          <summary>What these numbers mean</summary>
          <p className="panel-note">
            The 15 manufactured cases test quote validation and report
            integrity. The 8 live claims concern selected package-manifest facts
            and execution overclaims on Express and Chalk. These builder-run
            checks are not an independent study or a general accuracy estimate.
            Historical results are preserved separately.
          </p>
        </details>
        <a
          className="text-button"
          href="https://github.com/kathir-iTech/Vibe_Check/tree/codex/vibecheck-evidence-workspace/benchmark"
          target="_blank"
          rel="noreferrer"
        >
          Inspect the evaluation records ↗
        </a>
      </section>
      <footer className="workspace-footer">
        <span>VibeCheck / inspect the handoff.</span>
        <span>Built with the Devpost Learn Skill Pack · MIT</span>
        <button
          className="text-button"
          onClick={() => {
            sessionStorage.removeItem(STORE);
            setAudit(null);
            setReceipt(null);
            setPrevious(null);
            setNotice("This tab’s saved assessment was cleared.");
          }}
        >
          Clear this tab’s saved assessment
        </button>
      </footer>
    </main>
  );
}
