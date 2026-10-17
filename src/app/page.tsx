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
type InputMode = "message" | "pr";

function toModelInfo(data: any): ModelInfo | undefined {
  return data && data.model
    ? { model: String(data.model), modelFallback: Boolean(data.modelFallback) }
    : undefined;
}

const PIPELINE_STEPS: { id: PipelineStage; step: string; title: string }[] = [
  { id: "source", step: "01", title: "Claim Source" },
  { id: "extract", step: "02", title: "Gemini Extractor" },
  { id: "evidence", step: "03", title: "GitHub Tree & Diffs" },
  { id: "drift", step: "04", title: "Spec-Drift & Line Gate" },
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

  const [selectedPresetId, setSelectedPresetId] = useState<string>("mixed-3-verdict");
  const [inputMode, setInputMode] = useState<InputMode>("message");
  const [message, setMessage] = useState(SCENARIO_PRESETS[0].message);
  const [prUrl, setPrUrl] = useState("");
  const [claimSource, setClaimSource] = useState("");
  const [repoUrl, setRepoUrl] = useState(SCENARIO_PRESETS[0].repoUrl);
  const [auditedRepoUrl, setAuditedRepoUrl] = useState(demoRepoUrl);
  const [auditedHeadSha, setAuditedHeadSha] = useState(demoHeadSha);
  const [githubToken, setGithubToken] = useState("");
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [activeTab, setActiveTab] = useState<VerificationTab>("self-audit");

  // Initialize with the 3-verdict sample preview so the right-hand Results studio is
  // immediately visual and populated on first open (no empty gray box!), and updates live on Check Claims
  const [claims, setClaims] = useState<any[]>(() => demoClaims);
  const [evidence, setEvidence] = useState<Record<string, any>>(() => demoEvidence);
  const [driftFlags, setDriftFlags] = useState<any[]>(() => demoVerdicts);
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState<PipelineStage>("done");
  const [error, setError] = useState("");
  const [resultSource, setResultSource] = useState<{
    kind: "live" | "cached" | "demo";
    at: string;
  } | null>(() => ({
    kind: "demo",
    at: demoParamActive ? "2026-10-17T00:00:00.000Z" : "2026-10-17T00:00:00.000Z",
  }));
  const [models, setModels] = useState<ResultModels>({});
  const [timings, setTimings] = useState<{
    evidenceMs?: number;
    driftMs?: number;
    totalMs?: number;
  }>({ evidenceMs: 410, driftMs: 0, totalMs: 410 });
  const [editingClaims, setEditingClaims] = useState(false);
  const [draftClaimsText, setDraftClaimsText] = useState("");

  function buildAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (githubToken.trim()) {
      headers["x-github-token"] = githubToken.trim();
    }
    return headers;
  }

  function applyPreset(preset: ScenarioPreset) {
    if (loading) return;
    setSelectedPresetId(preset.id);
    setMessage(preset.message);
    setPrUrl(preset.prUrl);
    setInputMode(preset.prUrl ? "pr" : "message");
    setRepoUrl(preset.repoUrl);
    setClaimSource("");
    setError("");
  }

  function loadDemoIntoInspector() {
    if (loading) return;
    setSelectedPresetId("mixed-3-verdict");
    setInputMode("message");
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
    const lines = claims.map((c) => c.text).join("\n");
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
    const sourceUrl = inputMode === "pr" ? prUrl.trim() : "";
    const targetRepo = repoUrl.trim();
    if (!sourceUrl && !message.trim()) {
      setError("Paste an agent message first, or switch to the PR/Commit URL tab.");
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
    <main className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6">
      {/* Compact Studio Header + 4-Stage Pipeline Bar */}
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-zinc-200/90 bg-white px-5 py-4 shadow-sm dark:border-zinc-800/90 dark:bg-zinc-900/90">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
              <ShieldIcon className="h-3.5 w-3.5" />
              <span>2am Discovery Prevention</span>
            </span>
            <h1 className="text-lg font-bold tracking-tight text-zinc-900 sm:text-xl dark:text-zinc-100">
              Did your AI coding agent actually build what it claimed?
            </h1>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Cross-checks AI completion claims against real GitHub files, commit diffs, and <code className="font-mono">devpost/</code> specs with verbatim line verification.
          </p>
        </div>

        {/* Compact Horizontal 4-Stage Pipeline Strip */}
        <div className="flex flex-wrap items-center gap-1.5">
          {PIPELINE_STEPS.map((s, index) => {
            const stepNum = index + 1;
            const isActive = loading && currentStageNum === stepNum;
            const isDone =
              stage === "done" ||
              (!loading && claims.length > 0) ||
              (loading && currentStageNum > stepNum);
            return (
              <div
                key={s.id}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-mono text-[11px] transition-colors ${
                  isActive
                    ? "border-emerald-500 bg-emerald-500/15 font-bold text-emerald-700 dark:text-emerald-300"
                    : isDone
                      ? "border-emerald-500/25 bg-emerald-500/5 text-zinc-800 dark:text-zinc-200"
                      : "border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-800/40 dark:text-zinc-400"
                }`}
              >
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                  {isActive ? "●" : isDone ? "✓" : s.step}
                </span>
                <span>{s.title}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Split-Screen 2-Column Workspace: Left = Audit Input | Right = Results & Export */}
      <div id="inspector" className="grid items-start gap-5 lg:grid-cols-12">
        {/* LEFT COLUMN (5 cols): 1. Audit Input */}
        <section className="space-y-4 rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm lg:col-span-5 dark:border-zinc-800/90 dark:bg-zinc-900">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              1. Audit Input
            </h2>
            <div className="inline-flex rounded-lg border border-zinc-200 bg-zinc-100 p-0.5 text-[11px] font-semibold dark:border-zinc-800 dark:bg-zinc-800">
              <button
                type="button"
                onClick={() => {
                  setInputMode("message");
                  setPrUrl("");
                }}
                className={`rounded-md px-2.5 py-1 transition-colors ${
                  inputMode === "message"
                    ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-100"
                    : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400"
                }`}
              >
                Agent Message
              </button>
              <button
                type="button"
                onClick={() => setInputMode("pr")}
                className={`rounded-md px-2.5 py-1 transition-colors ${
                  inputMode === "pr"
                    ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-100"
                    : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400"
                }`}
              >
                PR / Commit URL
              </button>
            </div>
          </div>

          <ScenarioPresetGrid
            disabled={loading}
            activeId={selectedPresetId}
            onSelectPreset={applyPreset}
          />

          <div className="space-y-3">
            {inputMode === "message" ? (
              <div>
                <label
                  htmlFor="agentMessage"
                  className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400"
                >
                  Agent Completion Claims
                </label>
                <textarea
                  id="agentMessage"
                  rows={4}
                  disabled={loading}
                  placeholder="Paste what your coding agent claimed it finished..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="block w-full resize-y rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-2.5 font-mono text-xs leading-relaxed text-zinc-900 placeholder-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-100 dark:placeholder-zinc-500"
                />
              </div>
            ) : (
              <div>
                <label
                  htmlFor="prUrl"
                  className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400"
                >
                  GitHub Pull Request or Commit URL
                </label>
                <input
                  type="text"
                  id="prUrl"
                  disabled={loading}
                  placeholder="https://github.com/{owner}/{repo}/pull/123"
                  value={prUrl}
                  onChange={(e) => {
                    setPrUrl(e.target.value);
                    setClaimSource("");
                  }}
                  className="block w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-2.5 font-mono text-xs text-zinc-900 placeholder-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-100 dark:placeholder-zinc-500"
                />
              </div>
            )}

            {claimSource ? (
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-2.5 dark:border-zinc-700 dark:bg-zinc-800">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                  Fetched PR / Commit Text
                </p>
                <p className="max-h-20 overflow-y-auto whitespace-pre-wrap break-words font-mono text-[11px] text-zinc-700 dark:text-zinc-300">
                  {claimSource}
                </p>
              </div>
            ) : null}

            <div>
              <div className="mb-1 flex items-center justify-between gap-2">
                <label
                  htmlFor="repoUrl"
                  className="block text-xs font-medium text-zinc-600 dark:text-zinc-400"
                >
                  Target GitHub Repository
                </label>
                <button
                  type="button"
                  onClick={() => setShowTokenInput(!showTokenInput)}
                  className="font-mono text-[11px] font-medium text-emerald-700 hover:underline dark:text-emerald-400"
                >
                  {showTokenInput ? "Hide Token" : "+ Optional GitHub Token (5,000 req/hr)"}
                </button>
              </div>
              <input
                type="text"
                id="repoUrl"
                disabled={loading}
                placeholder="https://github.com/{owner}/{repo}"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                className="block w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-2 font-mono text-xs text-zinc-900 placeholder-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-100 dark:placeholder-zinc-500"
              />
            </div>

            {showTokenInput ? (
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-2.5 dark:border-zinc-800 dark:bg-zinc-800/60">
                <input
                  type="password"
                  id="githubToken"
                  disabled={loading}
                  placeholder="ghp_... or github_pat_... (5,000 req/hr rate-limit shield)"
                  value={githubToken}
                  onChange={(e) => setGithubToken(e.target.value)}
                  className="block w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 font-mono text-xs text-zinc-900 placeholder-zinc-400 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                />
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                onClick={() => handleCheck(false)}
                disabled={loading}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-emerald-600/20 transition-all hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? <SpinnerIcon className="h-4 w-4" /> : null}
                {loading ? "Checking Repo..." : "Check Claims"}
              </button>
              <button
                type="button"
                onClick={loadDemoIntoInspector}
                disabled={loading}
                className="rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-2.5 text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                Load Sample (?demo=1)
              </button>
            </div>

            {error ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-red-200 bg-red-50/80 px-3 py-2 text-xs text-red-800 dark:border-red-500/30 dark:bg-red-950/30 dark:text-red-300">
                <p className="font-medium">{error}</p>
                <button
                  type="button"
                  onClick={loadDemoIntoInspector}
                  className="shrink-0 rounded border border-red-300 bg-white px-2 py-0.5 font-semibold text-red-800 dark:border-red-500/40 dark:bg-zinc-900 dark:text-red-300"
                >
                  Use Sample &rarr;
                </button>
              </div>
            ) : null}
          </div>
        </section>

        {/* RIGHT COLUMN (7 cols): 2. Verification Results + 3. Shareable Verdict Report */}
        <div className="space-y-4 lg:col-span-7">
          <section className="rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm dark:border-zinc-800/90 dark:bg-zinc-900">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  2. Verification Results
                </h2>
                {claims.length > 0 && auditedRepoUrl ? (
                  <span className="rounded-md bg-zinc-100 px-2 py-0.5 font-mono text-[11px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                    {auditedRepoUrl.replace(/^https?:\/\/github\.com\//i, "")}
                    {auditedHeadSha ? ` @ ${auditedHeadSha.slice(0, 7)}` : ""}
                  </span>
                ) : null}
                {resultSource ? (
                  <span
                    className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${
                      resultSource.kind === "live"
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                        : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                    }`}
                  >
                    {resultSource.kind === "live"
                      ? "● Live API Run"
                      : resultSource.kind === "cached"
                        ? "Cached Run"
                        : "Sample Preview (?demo=1)"}
                  </span>
                ) : null}
              </div>

              <div className="flex items-center gap-2">
                {resultSource && resultSource.kind !== "live" && !loading ? (
                  <button
                    type="button"
                    onClick={() => handleCheck(true)}
                    className="font-mono text-[11px] font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
                  >
                    Run Live via API &rarr;
                  </button>
                ) : null}
                {claims.length > 0 && !loading ? (
                  <button
                    type="button"
                    onClick={() => (editingClaims ? setEditingClaims(false) : openClaimEditor())}
                    className="rounded-lg border border-zinc-300 bg-zinc-50 px-2.5 py-1 text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                  >
                    {editingClaims ? "Close Editor" : "✎ Edit / Refine Claims"}
                  </button>
                ) : null}
              </div>
            </div>

            {editingClaims ? (
              <div className="mb-3 space-y-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3.5">
                <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                  Edit Extracted Claims (one claim per line)
                </p>
                <textarea
                  rows={3}
                  value={draftClaimsText}
                  onChange={(e) => setDraftClaimsText(e.target.value)}
                  className="block w-full rounded-lg border border-zinc-300 bg-white p-2 font-mono text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleVerifyEditedClaims}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
                  >
                    Re-Verify Claims
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingClaims(false)}
                    className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}

            <ResultsPanel
              claims={claims}
              evidence={evidence}
              driftFlags={driftFlags}
              loading={loading}
              models={models}
              repoUrl={auditedRepoUrl}
              timings={timings}
              onLoadSample={loadDemoIntoInspector}
            />
          </section>

          <section className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm dark:border-zinc-800/90 dark:bg-zinc-900">
            <h2 className="mb-2.5 text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              3. Shareable Verdict Report &amp; PR Export
            </h2>
            <ReportExport
              repoUrl={auditedRepoUrl}
              headSha={auditedHeadSha}
              claims={claims}
              evidence={evidence}
              verdicts={driftFlags}
            />
          </section>
        </div>
      </div>

      {/* Compact Bottom Verification Suite (3-Column Self-Audit + 72/72 Benchmark + Demo Mode) */}
      <section
        id="self-audit"
        className="rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm dark:border-zinc-800/90 dark:bg-zinc-900"
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 pb-2.5 dark:border-zinc-800">
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
          <span className="font-mono text-[11px] text-zinc-400">
            Zero-Config Static Verification Suite
          </span>
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
        <main className="mx-auto max-w-6xl px-4 py-12 text-sm text-zinc-500">
          Loading VibeCheck Inspector&hellip;
        </main>
      }
    >
      <InspectorWorkspace />
    </Suspense>
  );
}