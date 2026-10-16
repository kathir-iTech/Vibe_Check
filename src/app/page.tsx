"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ScenarioPresetGrid } from "@/components/ClaimInput";
import { ResultsPanel, type ModelInfo, type ResultModels } from "@/components/ResultsPanel";
import { ReportExport } from "@/components/ReportExport";
import { DemoMode } from "@/components/DemoMode";
import { SelfAudit } from "@/components/SelfAudit";
import { BenchmarkCard } from "@/components/BenchmarkCard";
import { ShieldIcon, SpinnerIcon } from "@/components/icons";
import {
  demoClaims,
  demoEvidence,
  demoHeadSha,
  demoRepoUrl,
  demoVerdicts,
  SCENARIO_PRESETS,
  type ScenarioPreset,
} from "@/lib/demo-data";
import { cacheKey, formatStamp, readCached, writeCached } from "@/lib/result-cache";
import { fetchWithTimeout } from "@/lib/http";
import benchmarkResults from "benchmark/results.json";

interface CheckResult {
  claimSource: string;
  auditedRepoUrl: string;
  auditedHeadSha: string;
  claims: any[];
  evidence: Record<string, any>;
  driftFlags: any[];
  models?: ResultModels;
  timings?: { evidenceMs?: number; driftMs?: number; totalMs?: number };
}

type PipelineStage = "idle" | "source" | "extract" | "evidence" | "drift" | "done" | "error";
type VerificationTab = "self-audit" | "benchmark" | "demo";

function toModelInfo(data: any): ModelInfo | undefined {
  return data && data.model
    ? { model: String(data.model), modelFallback: Boolean(data.modelFallback) }
    : undefined;
}

const PIPELINE_STEPS: { id: PipelineStage; step: string; title: string; detail: string }[] = [
  {
    id: "source",
    step: "01",
    title: "Claim Source",
    detail: "Agent message or GitHub PR/commit",
  },
  {
    id: "extract",
    step: "02",
    title: "Claim Extractor",
    detail: "Atomic Claims + Injection Guard",
  },
  {
    id: "evidence",
    step: "03",
    title: "Repo & Diff Check",
    detail: "Tree + 60-File Content + Commit Diffs",
  },
  {
    id: "drift",
    step: "04",
    title: "Spec-Drift & Line Gate",
    detail: "Verbatim Line + Code/Negation Guards",
  },
];

const STAGE_ORDER: Record<PipelineStage, number> = {
  idle: 0,
  source: 1,
  extract: 2,
  evidence: 3,
  drift: 4,
  done: 5,
  error: -1,
};

function InspectorWorkspace() {
  const searchParams = useSearchParams();
  const demoParamActive = searchParams?.get("demo") === "1";

  const [message, setMessage] = useState(SCENARIO_PRESETS[0].message);
  const [prUrl, setPrUrl] = useState("");
  const [claimSource, setClaimSource] = useState("");
  const [repoUrl, setRepoUrl] = useState(SCENARIO_PRESETS[0].repoUrl);
  const [auditedRepoUrl, setAuditedRepoUrl] = useState(demoRepoUrl);
  const [auditedHeadSha, setAuditedHeadSha] = useState(demoHeadSha);
  const [githubToken, setGithubToken] = useState("");
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [activeTab, setActiveTab] = useState<VerificationTab>("self-audit");

  const [claims, setClaims] = useState<any[]>(() => (demoParamActive ? demoClaims : []));
  const [evidence, setEvidence] = useState<Record<string, any>>(() =>
    demoParamActive ? demoEvidence : {}
  );
  const [driftFlags, setDriftFlags] = useState<any[]>(() =>
    demoParamActive ? demoVerdicts : []
  );
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState<PipelineStage>(() =>
    demoParamActive ? "done" : "idle"
  );
  const [error, setError] = useState("");
  const [resultSource, setResultSource] = useState<{
    kind: "live" | "cached" | "demo";
    at: string;
  } | null>(() =>
    demoParamActive ? { kind: "demo", at: "2026-10-16T00:00:00.000Z" } : null
  );
  const [models, setModels] = useState<ResultModels>({});
  const [timings, setTimings] = useState<{
    evidenceMs?: number;
    driftMs?: number;
    totalMs?: number;
  }>(() => (demoParamActive ? { evidenceMs: 410, driftMs: 0, totalMs: 410 } : {}));
  const [editingClaims, setEditingClaims] = useState(false);
  const [draftClaimsText, setDraftClaimsText] = useState("");

  const activeClaims = claims.length > 0 ? claims : demoParamActive ? demoClaims : [];
  const activeEvidence =
    Object.keys(evidence).length > 0 ? evidence : demoParamActive ? demoEvidence : {};
  const activeDriftFlags =
    driftFlags.length > 0 ? driftFlags : demoParamActive ? demoVerdicts : [];
  const activeResultSource =
    resultSource || (demoParamActive ? { kind: "demo", at: "2026-10-16T00:00:00.000Z" } : null);

  function buildAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (githubToken.trim()) {
      headers["x-github-token"] = githubToken.trim();
    }
    return headers;
  }

  function applyPreset(preset: ScenarioPreset) {
    if (loading) return;
    setMessage(preset.message);
    setPrUrl(preset.prUrl);
    setRepoUrl(preset.repoUrl);
    setClaimSource("");
    setError("");
  }

  function loadDemoIntoInspector() {
    if (loading) return;
    setMessage(SCENARIO_PRESETS[0].message);
    setPrUrl("");
    setRepoUrl(demoRepoUrl);
    setAuditedRepoUrl(demoRepoUrl);
    setAuditedHeadSha(demoHeadSha);
    setClaimSource("");
    setClaims(demoClaims);
    setEvidence(demoEvidence);
    setDriftFlags(demoVerdicts);
    setModels({});
    setTimings({ evidenceMs: 410, driftMs: 0, totalMs: 410 });
    setStage("done");
    setResultSource({ kind: "demo", at: new Date().toISOString() });
    setError("");
    setEditingClaims(false);
  }

  function openClaimEditor() {
    const lines = activeClaims.map((c) => c.text).join("\n");
    setDraftClaimsText(lines);
    setEditingClaims(true);
  }

  async function handleVerifyEditedClaims() {
    const editedLines = draftClaimsText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!editedLines.length) {
      setError("Enter at least one claim line to verify.");
      return;
    }
    const targetRepo = repoUrl.trim();
    if (!targetRepo) {
      setError("Enter a GitHub repo URL.");
      return;
    }

    const customClaims = editedLines.slice(0, 15).map((text, idx) => ({
      id: `claim-${idx + 1}`,
      text,
      evidenceType: ["file", "commit"],
    }));

    setEditingClaims(false);
    setLoading(true);
    setError("");
    setStage("evidence");
    setAuditedRepoUrl(targetRepo);
    setClaims(customClaims);
    setEvidence({});
    setDriftFlags([]);

    const startedAt = performance.now();
    try {
      const evStart = performance.now();
      const evidenceRes = await fetchWithTimeout("/api/check-evidence", {
        method: "POST",
        headers: buildAuthHeaders(),
        body: JSON.stringify({ repoUrl: targetRepo, claims: customClaims }),
      });
      const evidenceData = await evidenceRes.json();
      if (!evidenceRes.ok || evidenceData.error) {
        throw new Error(evidenceData.error || `check-evidence failed (${evidenceRes.status})`);
      }
      const evidenceMs = Math.round(performance.now() - evStart);
      setEvidence(evidenceData.evidence || {});
      if (typeof evidenceData.headSha === "string") {
        setAuditedHeadSha(evidenceData.headSha);
      }

      setStage("drift");
      const drStart = performance.now();
      const driftRes = await fetchWithTimeout("/api/check-spec-drift", {
        method: "POST",
        headers: buildAuthHeaders(),
        body: JSON.stringify({
          repoUrl: targetRepo,
          claims: customClaims,
          evidence: evidenceData.evidence || {},
        }),
      });
      const driftData = await driftRes.json();
      if (!driftRes.ok || driftData.error) {
        throw new Error(driftData.error || `check-spec-drift failed (${driftRes.status})`);
      }
      const driftMs = Math.round(performance.now() - drStart);
      const totalMs = Math.round(performance.now() - startedAt);

      setDriftFlags(driftData.drift || []);
      const usedModels: ResultModels = {
        ...models,
        drift: toModelInfo(driftData),
      };
      setModels(usedModels);
      setTimings({ evidenceMs, driftMs, totalMs });
      setResultSource({ kind: "live", at: new Date().toISOString() });
      setStage("done");
    } catch (err) {
      setStage("error");
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleCheck(forceLive = false) {
    const sourceUrl = prUrl.trim();
    const targetRepo = repoUrl.trim();
    if (!sourceUrl && !message.trim()) {
      setError("Paste an agent message first, or a PR/commit URL below.");
      return;
    }
    if (!targetRepo) {
      setError("Enter a GitHub repo URL.");
      return;
    }

    const key = cacheKey([sourceUrl || message, targetRepo]);

    if (!forceLive) {
      const cached = readCached<CheckResult>(key);
      if (cached) {
        setClaimSource(cached.data.claimSource);
        setAuditedRepoUrl(cached.data.auditedRepoUrl || targetRepo);
        setAuditedHeadSha(cached.data.auditedHeadSha || "");
        setClaims(cached.data.claims);
        setEvidence(cached.data.evidence);
        setDriftFlags(cached.data.driftFlags);
        setModels(cached.data.models || {});
        setTimings(cached.data.timings || {});
        setResultSource({ kind: "cached", at: cached.savedAt });
        setStage("done");
        setError("");
        return;
      }
    }

    setLoading(true);
    setError("");
    setResultSource(null);
    setClaimSource("");
    setAuditedRepoUrl(targetRepo);
    setAuditedHeadSha("");
    setClaims([]);
    setEvidence({});
    setDriftFlags([]);
    setModels({});
    setTimings({});
    setEditingClaims(false);

    const usedModels: ResultModels = {};
    const startedAt = performance.now();

    try {
      let claimText = message;
      if (sourceUrl) {
        setStage("source");
        const sourceRes = await fetchWithTimeout("/api/claim-source", {
          method: "POST",
          headers: buildAuthHeaders(),
          body: JSON.stringify({ url: sourceUrl }),
        });
        const sourceData = await sourceRes.json();
        if (!sourceRes.ok || sourceData.error) {
          throw new Error(sourceData.error || `claim-source failed (${sourceRes.status})`);
        }
        if (!sourceData.text) {
          throw new Error("GitHub returned no text for that URL.");
        }
        claimText = sourceData.text;
        setClaimSource(sourceData.text);
      }

      setStage("extract");
      const extractRes = await fetchWithTimeout("/api/extract-claims", {
        method: "POST",
        headers: buildAuthHeaders(),
        body: JSON.stringify({ message: claimText, repoUrl: targetRepo }),
      });
      const extractData = await extractRes.json();
      if (!extractRes.ok || extractData.error) {
        throw new Error(extractData.error || `extract-claims failed (${extractRes.status})`);
      }
      const extractedClaims = extractData.claims;
      if (!Array.isArray(extractedClaims) || !extractedClaims.length) {
        throw new Error("No claims were extracted from the message.");
      }
      setClaims(extractedClaims);
      usedModels.extract = toModelInfo(extractData);
      setModels({ ...usedModels });

      setStage("evidence");
      const evStart = performance.now();
      const evidenceRes = await fetchWithTimeout("/api/check-evidence", {
        method: "POST",
        headers: buildAuthHeaders(),
        body: JSON.stringify({ repoUrl: targetRepo, claims: extractedClaims }),
      });
      const evidenceData = await evidenceRes.json();
      if (!evidenceRes.ok || evidenceData.error) {
        throw new Error(evidenceData.error || `check-evidence failed (${evidenceRes.status})`);
      }
      const evidenceMs = Math.round(performance.now() - evStart);
      const resolvedSha = typeof evidenceData.headSha === "string" ? evidenceData.headSha : "";
      setEvidence(evidenceData.evidence || {});
      setAuditedHeadSha(resolvedSha);

      setStage("drift");
      const drStart = performance.now();
      const driftRes = await fetchWithTimeout("/api/check-spec-drift", {
        method: "POST",
        headers: buildAuthHeaders(),
        body: JSON.stringify({
          repoUrl: targetRepo,
          claims: extractedClaims,
          evidence: evidenceData.evidence || {},
        }),
      });
      const driftData = await driftRes.json();
      if (!driftRes.ok || driftData.error) {
        throw new Error(driftData.error || `check-spec-drift failed (${driftRes.status})`);
      }
      const driftMs = Math.round(performance.now() - drStart);
      const totalMs = Math.round(performance.now() - startedAt);

      setDriftFlags(driftData.drift || []);
      usedModels.drift = toModelInfo(driftData);
      setModels({ ...usedModels });
      const runTimings = { evidenceMs, driftMs, totalMs };
      setTimings(runTimings);

      const entry = writeCached<CheckResult>(key, {
        claimSource: sourceUrl ? claimText : "",
        auditedRepoUrl: targetRepo,
        auditedHeadSha: resolvedSha,
        claims: extractedClaims,
        evidence: evidenceData.evidence || {},
        driftFlags: driftData.drift || [],
        models: usedModels,
        timings: runTimings,
      });
      setResultSource({ kind: "live", at: entry.savedAt });
      setStage("done");
    } catch (err) {
      setStage("error");
      const errMsg = err instanceof Error ? err.message : String(err);
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  }

  const currentStageNum = STAGE_ORDER[stage] ?? 0;

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:py-10">
      {/* Forensic Hero Banner */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl space-y-1.5">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-50 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">
              <ShieldIcon className="h-3.5 w-3.5" />
              <span>2am Discovery Prevention &middot; Build-Honesty &amp; Spec-Drift Auditor</span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 sm:text-2xl dark:text-zinc-100">
              Did your AI coding agent actually build what it claimed?
            </h1>
            <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              Paste your coding agent&rsquo;s completion message (or a GitHub PR/commit URL) and repository URL. VibeCheck extracts discrete claims, cross-checks real repo files, commit diffs, and <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-xs dark:bg-zinc-800">devpost/</code> specs, and verifies every cited line server-side.
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
            <button
              type="button"
              onClick={loadDemoIntoInspector}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-600/40 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-900 transition-colors hover:bg-emerald-100 disabled:opacity-60 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-200 dark:hover:bg-emerald-500/25"
            >
              <span>⚡ Instant 3-Verdict Sample (0 API Calls)</span>
            </button>
          </div>
        </div>

        {/* 4-Stage Pipeline Stepper */}
        <div className="mt-4 grid gap-2 border-t border-zinc-100 pt-4 sm:grid-cols-4 dark:border-zinc-800">
          {PIPELINE_STEPS.map((s, index) => {
            const stepNum = index + 1;
            const isActive = loading && currentStageNum === stepNum;
            const isDone =
              stage === "done" ||
              (!loading && activeClaims.length > 0) ||
              (loading && currentStageNum > stepNum);
            const stateClass = isActive
              ? "border-emerald-500 bg-emerald-50/70 text-emerald-900 dark:border-emerald-500 dark:bg-emerald-950/30 dark:text-emerald-200"
              : isDone
                ? "border-emerald-200 bg-emerald-50/30 text-zinc-800 dark:border-emerald-900/50 dark:bg-emerald-950/10 dark:text-zinc-200"
                : "border-zinc-200 bg-zinc-50/70 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-800/40 dark:text-zinc-400";
            return (
              <div
                key={s.id}
                className={`rounded-lg border px-3 py-2 transition-colors ${stateClass}`}
              >
                <div className="flex items-center justify-between font-mono text-[10px] font-bold uppercase tracking-wider">
                  <span>Stage {s.step}</span>
                  <span>{isActive ? "RUNNING…" : isDone ? "✓ READY" : "STANDBY"}</span>
                </div>
                <p className="mt-0.5 text-xs font-semibold">{s.title}</p>
                <p className="text-[11px] opacity-80">{s.detail}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Main Input Panel */}
      <section
        id="inspector"
        className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      >
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          1. Audit Input
        </h2>

        <ScenarioPresetGrid disabled={loading} onSelectPreset={applyPreset} />

        <div className="space-y-3">
          {!prUrl.trim() ? (
            <div>
              <label
                htmlFor="agentMessage"
                className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400"
              >
                Agent Completion Message / Claim Text
              </label>
              <textarea
                id="agentMessage"
                rows={4}
                disabled={loading}
                placeholder="Paste agent message here..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="block min-h-[7rem] w-full resize-y rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2.5 font-mono text-sm text-zinc-900 placeholder-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
              />
            </div>
          ) : null}

          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" aria-hidden="true" />
            <span className="text-xs uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              or paste a GitHub PR / commit URL
            </span>
            <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" aria-hidden="true" />
          </div>

          <input
            type="text"
            id="prUrl"
            disabled={loading}
            placeholder="https://github.com/{owner}/{repo}/pull/123 or .../commit/abc1234"
            value={prUrl}
            onChange={(e) => {
              setPrUrl(e.target.value);
              setClaimSource("");
            }}
            className="block w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2.5 font-mono text-sm text-zinc-900 placeholder-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
          />

          {claimSource ? (
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800">
              <p className="mb-1 text-xs uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                Fetched PR / Commit Claim Source
              </p>
              <p className="max-h-28 overflow-y-auto whitespace-pre-wrap break-words font-mono text-xs text-zinc-700 dark:text-zinc-300">
                {claimSource}
              </p>
            </div>
          ) : null}

          <div>
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <label
                htmlFor="repoUrl"
                className="block text-xs font-medium text-zinc-600 dark:text-zinc-400"
              >
                Target GitHub Repository URL
              </label>
              <button
                type="button"
                onClick={() => setShowTokenInput(!showTokenInput)}
                className="font-mono text-[11px] font-medium text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-400"
              >
                {showTokenInput
                  ? "Hide GitHub Token"
                  : "+ Optional GitHub Token (5,000 req/hr)"}
              </button>
            </div>
            <input
              type="text"
              id="repoUrl"
              disabled={loading}
              placeholder="https://github.com/{owner}/{repo}"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              className="block w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2.5 font-mono text-sm text-zinc-900 placeholder-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
            />
          </div>

          {showTokenInput ? (
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-800/60">
              <label
                htmlFor="githubToken"
                className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300"
              >
                Optional GitHub Personal Access Token (Passed only in request header for high-volume repos)
              </label>
              <input
                type="password"
                id="githubToken"
                disabled={loading}
                placeholder="ghp_... or github_pat_... (leave blank to use server token)"
                value={githubToken}
                onChange={(e) => setGithubToken(e.target.value)}
                className="block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-xs text-zinc-900 placeholder-zinc-400 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={() => handleCheck(false)}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? <SpinnerIcon className="h-4 w-4" /> : null}
                {loading ? "Checking..." : "Check Claims"}
              </button>
              <button
                type="button"
                onClick={loadDemoIntoInspector}
                disabled={loading}
                className="rounded-lg border border-zinc-300 bg-white px-3.5 py-2.5 text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                Load Sample Data (?demo=1)
              </button>
            </div>
          </div>

          {error ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50/80 px-3.5 py-2.5 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-950/30 dark:text-red-300">
              <p className="font-medium">{error}</p>
              <button
                type="button"
                onClick={loadDemoIntoInspector}
                className="shrink-0 rounded-md border border-red-300 bg-white px-2.5 py-1 text-xs font-semibold text-red-800 hover:bg-red-50 dark:border-red-500/40 dark:bg-zinc-900 dark:text-red-300"
              >
                Load Sample Fallback &rarr;
              </button>
            </div>
          ) : null}
        </div>
      </section>

      {/* Results Section + Interactive Claim Editor */}
      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              2. Verification Results
            </h2>
            {activeClaims.length > 0 && auditedRepoUrl ? (
              <span className="rounded bg-zinc-100 px-2 py-0.5 font-mono text-[11px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                {auditedRepoUrl.replace(/^https?:\/\/github\.com\//i, "")}
                {auditedHeadSha ? ` @ ${auditedHeadSha.slice(0, 7)}` : ""}
              </span>
            ) : null}
          </div>
          {activeClaims.length > 0 && !loading ? (
            <button
              type="button"
              onClick={() => (editingClaims ? setEditingClaims(false) : openClaimEditor())}
              className="rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-1 text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              {editingClaims ? "Close Claim Editor" : "✎ Edit / Refine Claims"}
            </button>
          ) : null}
        </div>

        {editingClaims ? (
          <div className="mb-4 space-y-2.5 rounded-xl border border-emerald-300/70 bg-emerald-50/40 p-4 dark:border-emerald-500/30 dark:bg-emerald-950/20">
            <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
              Edit Extracted Claims (one claim per line &mdash; re-verifies directly against repo evidence)
            </p>
            <textarea
              rows={4}
              value={draftClaimsText}
              onChange={(e) => setDraftClaimsText(e.target.value)}
              className="block w-full rounded-lg border border-zinc-300 bg-white p-2.5 font-mono text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleVerifyEditedClaims}
                className="rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
              >
                Re-Verify Claims
              </button>
              <button
                type="button"
                onClick={() => setEditingClaims(false)}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        {activeResultSource ? (
          <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            {activeResultSource.kind === "cached" ? (
              <>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 font-bold uppercase tracking-wide text-amber-800 dark:bg-amber-500/15 dark:text-amber-400">
                  cached
                </span>
                <span className="text-zinc-500 dark:text-zinc-400">
                  saved {formatStamp(activeResultSource.at)} &mdash;
                </span>
                <button
                  onClick={() => handleCheck(true)}
                  disabled={loading}
                  className="font-semibold text-emerald-700 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 disabled:cursor-not-allowed disabled:opacity-60 dark:text-emerald-400"
                >
                  Re-run live
                </button>
              </>
            ) : activeResultSource.kind === "demo" ? (
              <>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 font-bold uppercase tracking-wide text-amber-800 dark:bg-amber-500/15 dark:text-amber-400">
                  sample data (?demo=1 &middot; 0 API calls)
                </span>
                <span className="text-zinc-500 dark:text-zinc-400">
                  against <code className="font-mono">{demoRepoUrl}</code> &mdash;
                </span>
                <button
                  onClick={() => handleCheck(true)}
                  disabled={loading}
                  className="font-semibold text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-400"
                >
                  Run live via API
                </button>
              </>
            ) : (
              <>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-bold uppercase tracking-wide text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400">
                  live
                </span>
                <span className="text-zinc-500 dark:text-zinc-400">
                  checked {formatStamp(activeResultSource.at)}
                </span>
              </>
            )}
          </div>
        ) : null}

        <ResultsPanel
          claims={activeClaims}
          evidence={activeEvidence}
          driftFlags={activeDriftFlags}
          loading={loading}
          models={models}
          repoUrl={auditedRepoUrl}
          timings={timings}
          onLoadSample={loadDemoIntoInspector}
        />
      </section>

      {/* Report Exporter */}
      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          3. Shareable Verdict Report &amp; PR Export
        </h2>
        <ReportExport
          repoUrl={auditedRepoUrl}
          headSha={auditedHeadSha}
          claims={activeClaims}
          evidence={activeEvidence}
          verdicts={activeDriftFlags}
        />
      </section>

      {/* Compact 3-Tab Verification Suite (Self-Audit, QA Benchmark, Fallback Demo) */}
      <section
        id="self-audit"
        className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 pb-3 dark:border-zinc-800">
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setActiveTab("self-audit")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                activeTab === "self-audit"
                  ? "bg-emerald-600 text-white"
                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              }`}
            >
              Self-Audit (3/3 Verified)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("benchmark")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                activeTab === "benchmark"
                  ? "bg-emerald-600 text-white"
                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              }`}
            >
              QA Accuracy Benchmark (72/72)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("demo")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                activeTab === "demo"
                  ? "bg-emerald-600 text-white"
                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              }`}
            >
              Fallback Demo Mode (?demo=1)
            </button>
          </div>
        </div>

        {activeTab === "self-audit" ? (
          <SelfAudit />
        ) : activeTab === "benchmark" ? (
          <BenchmarkCard
            data={benchmarkResults as any}
            fallback={
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Benchmark not yet run.
              </p>
            }
          />
        ) : (
          <DemoMode onLoadIntoInspector={loadDemoIntoInspector} />
        )}
      </section>
    </main>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-4xl px-4 py-12 text-sm text-zinc-500">
          Loading VibeCheck Inspector&hellip;
        </main>
      }
    >
      <InspectorWorkspace />
    </Suspense>
  );
}