import { parseGitHubRepoUrl } from "./report-crypto.mjs";

export { parseGitHubRepoUrl };

export function getGitHubHeaders(userToken?: string, accept = "application/vnd.github.v3+json"): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: accept,
    "User-Agent": "VibeCheck",
  };
  const token = (userToken && userToken.trim()) || process.env.GITHUB_TOKEN;
  if (token) {
    headers["Authorization"] = token.startsWith("ghp_") || token.startsWith("github_pat_")
      ? `Bearer ${token}`
      : `token ${token}`;
  }
  return headers;
}

export async function getDefaultBranch(owner: string, repo: string, userToken?: string): Promise<string> {
  const url = `https://api.github.com/repos/${owner}/${repo}`;
  const response = await fetch(url, {
    headers: getGitHubHeaders(userToken),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`);
  }
  const data = await response.json();
  if (data.private && !userToken?.trim()) throw new Error("Private repositories require your own GitHub token");
  return data.default_branch || "main";
}

export interface RepoSnapshot {
  repoUrl: string;
  owner: string;
  repo: string;
  headSha: string;
  defaultBranch: string;
  baseSha?: string;
}

export async function resolveSnapshot(repoUrl: string, requestedRef = "", userToken?: string): Promise<RepoSnapshot> {
  const { owner, repo, canonicalUrl } = parseGitHubRepoUrl(repoUrl);
  if (requestedRef && !/^[a-f0-9]{7,40}$/i.test(requestedRef)) throw new Error("Revision must be a Git commit SHA");
  const defaultBranch = await getDefaultBranch(owner, repo, userToken);
  const commit = await githubApi(`https://api.github.com/repos/${owner}/${repo}/commits/${encodeURIComponent(requestedRef || defaultBranch)}`, 8000, userToken);
  if (!/^[a-f0-9]{40}$/i.test(commit.sha)) throw new Error("GitHub did not return an immutable commit");
  return { repoUrl: canonicalUrl, owner, repo, headSha: commit.sha, defaultBranch };
}

export function safeRepoPath(path: string): string {
  if (typeof path !== "string" || path.length > 300 || path.startsWith("/") || path.includes("\\") || path.split("/").some(p => !p || p === "." || p === "..")) {
    throw new Error("Invalid repository file path");
  }
  return path.split("/").map(encodeURIComponent).join("/");
}

export async function readSnapshotFile(snapshot: RepoSnapshot, path: string, userToken?: string): Promise<RepoFileContent | null> {
  const encoded = safeRepoPath(path);
  try {
    const data = await githubApi(`https://api.github.com/repos/${snapshot.owner}/${snapshot.repo}/contents/${encoded}?ref=${snapshot.headSha}`, 8000, userToken);
    if (data?.encoding !== "base64" || typeof data.content !== "string") return null;
    const text = Buffer.from(data.content, "base64").toString("utf8");
    if (text.includes("\u0000")) return null;
    return { file: path, text: text.slice(0, MAX_FILE_CHARS), truncated: text.length > MAX_FILE_CHARS };
  } catch (error) {
    if (String(error).includes("404")) return null;
    throw error;
  }
}

export async function fetchClaimSource(raw: string, userToken?: string) {
  const source = parseClaimSourceUrl(raw);
  await getDefaultBranch(source.owner, source.repo, userToken);
  const base = `https://api.github.com/repos/${source.owner}/${source.repo}`;
  const data = await githubApi(`${base}/${source.kind === "pull" ? "pulls" : "commits"}/${source.ref}`, 8000, userToken);
  const repoUrl = source.kind === "pull" ? data.head?.repo?.html_url : `https://github.com/${source.owner}/${source.repo}`;
  const headSha = source.kind === "pull" ? data.head?.sha : data.sha;
  const text = source.kind === "pull" ? `${data.title || ""}\n\n${data.body || ""}`.trim() : String(data.commit?.message || "").trim();
  if (!repoUrl || !text || !/^[a-f0-9]{40}$/i.test(headSha)) throw new Error("Source has no readable repository, revision or claim text");
  const snapshot = await resolveSnapshot(repoUrl, headSha, userToken);
  return { text, snapshot, baseSha: source.kind === "pull" ? data.base?.sha : data.parents?.[0]?.sha, targetRepoUrl: `https://github.com/${source.owner}/${source.repo}`, kind: source.kind };
}

export async function githubApi(url: string, timeoutMs = 8000, userToken?: string): Promise<any> {
  const response = await fetch(url, {
    headers: getGitHubHeaders(userToken),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    const detail = response.status === 403 || response.status === 429 ? " — access denied or rate limit reached; retry later or use your own read token" : "";
    throw new Error(`GitHub API error: ${response.status}${detail}`);
  }
  return response.json();
}

const PR_URL = /^https?:\/\/(?:www\.)?github\.com\/([^/\s]+)\/([^/\s]+)\/pull\/(\d+)\/?$/i;
const COMMIT_URL = /^https?:\/\/(?:www\.)?github\.com\/([^/\s]+)\/([^/\s]+)\/commit\/([0-9a-f]{7,64})\/?$/i;

export function parseClaimSourceUrl(raw: string): { kind: "pull" | "commit"; owner: string; repo: string; ref: string } {
  const cleaned = raw.trim().split(/[?#]/)[0];
  const pr = cleaned.match(PR_URL);
  if (pr) {
    return { kind: "pull", owner: pr[1], repo: pr[2], ref: pr[3] };
  }
  const commit = cleaned.match(COMMIT_URL);
  if (commit) {
    return { kind: "commit", owner: commit[1], repo: commit[2], ref: commit[3] };
  }
  throw new Error(
    "Not a valid GitHub PR/commit URL. Expected github.com/{owner}/{repo}/pull/{n} or github.com/{owner}/{repo}/commit/{sha}."
  );
}

export async function fetchClaimTextFromUrl(raw: string, userToken?: string): Promise<string> {
  const parsed = parseClaimSourceUrl(raw);
  const apiBase = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}`;
  try {
    if (parsed.kind === "pull") {
      const data = await githubApi(`${apiBase}/pulls/${parsed.ref}`, 8000, userToken);
      const title = String(data.title || "").trim();
      const body = String(data.body || "").trim();
      if (!title) {
        throw new Error("Pull request has an empty title.");
      }
      return body ? `${title}\n\n${body}` : title;
    }
    const data = await githubApi(`${apiBase}/commits/${parsed.ref}`, 8000, userToken);
    const message = String(data.commit?.message || "").trim();
    if (!message) {
      throw new Error("Commit has an empty message.");
    }
    return message;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const statusMatch = msg.match(/GitHub API error: (\d+)/);
    if (statusMatch && (statusMatch[1] === "404" || statusMatch[1] === "422")) {
      throw new Error("GitHub API error: not found — that PR/commit does not exist (private repo or wrong URL).");
    }
    if (statusMatch) {
      throw new Error(`${msg} — could not fetch from GitHub. Try again shortly or use demo mode (?demo=1).`);
    }
    throw err;
  }
}

export interface CommitPatchSummary {
  sha: string;
  filesChanged: string[];
  additions: number;
  deletions: number;
  patchPreview: string;
}

export async function fetchCommitDiffDetails(
  base: string,
  shas: string[],
  maxCommits = 4,
  userToken?: string
): Promise<Record<string, CommitPatchSummary>> {
  const uniqueShas = [...new Set(shas.filter(Boolean))].slice(0, maxCommits);
  const out: Record<string, CommitPatchSummary> = {};
  if (!uniqueShas.length) return out;

  await Promise.all(
    uniqueShas.map(async (sha) => {
      try {
        const detail = await githubApi(`${base}/commits/${sha}`, 4000, userToken);
        const files = Array.isArray(detail?.files) ? detail.files : [];
        const eligibleFiles = files.filter(
          (f: any) =>
            f &&
            typeof f.filename === "string" &&
            !isExcludedEvidencePath(f.filename) &&
            !isSkippableFile(f.filename)
        );
        const filesChanged = eligibleFiles.map((f: any) => String(f.filename)).slice(0, 8);
        const additions = typeof detail?.stats?.additions === "number" ? detail.stats.additions : 0;
        const deletions = typeof detail?.stats?.deletions === "number" ? detail.stats.deletions : 0;
        const firstWithPatch = eligibleFiles.find(
          (f: any) => typeof f.patch === "string" && f.patch.trim().length > 0
        );
        const rawPatch = firstWithPatch ? String(firstWithPatch.patch) : "";
        const addedLines = rawPatch
          .split("\n")
          .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
          .slice(0, 3)
          .join(" ");
        const patchPreview = (addedLines || rawPatch.split("\n").slice(0, 2).join(" ")).slice(0, 220);

        out[sha] = {
          sha,
          filesChanged,
          additions,
          deletions,
          patchPreview,
        };
      } catch {
        // Fail open if rate-limited or timed out
      }
    })
  );

  return out;
}

const MAX_FILES_PER_CLAIM = 5;
const MAX_FILE_CHARS = 20 * 1024;
const TRUNCATION_MARKER = "\n[VibeCheck truncated this file: over 20KB]";

const SKIP_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".bmp", ".svg", ".psd",
  ".pdf", ".zip", ".gz", ".tar", ".rar", ".7z", ".jar", ".exe", ".dll", ".bin",
  ".so", ".dylib", ".class", ".o", ".a", ".woff", ".woff2", ".ttf", ".otf", ".eot",
  ".mp3", ".mp4", ".mov", ".avi", ".wav", ".sqlite", ".db", ".wasm", ".pb",
  ".lockb", ".map",
]);

const SKIP_NAMES = new Set([
  "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "pnpm-lock.json",
  "npm-shrinkwrap.json", "cargo.lock", "go.sum", "gemfile.lock", "composer.lock",
  "poetry.lock", "uv.lock", "pipfile.lock", "flake.lock", ".ds_store",
]);

const SKIP_DIR_PARTS = ["node_modules/", ".next/", "dist/", "build/", "coverage/", ".git/"];
export const CONTENT_EXCLUDED_DIRS = [".agents/", ".claude/", "devpost/", "benchmark/"];

export function isExcludedEvidencePath(path: string): boolean {
  const lower = String(path || "").toLowerCase();
  return CONTENT_EXCLUDED_DIRS.some((d) => lower.startsWith(d) || lower.includes(`/${d}`));
}

export interface RepoFileContent {
  file: string;
  text: string;
  truncated: boolean;
}

export function isSkippableFile(path: string): boolean {
  const lower = path.toLowerCase();
  if (isExcludedEvidencePath(lower)) return true;
  if (SKIP_DIR_PARTS.some((part) => lower.includes(part))) return true;
  if (lower.startsWith(".env") || lower.endsWith(".pem") || lower.endsWith(".key") || lower.endsWith(".p12")) {
    return true;
  }
  const base = lower.split("/").pop() || lower;
  if (base.startsWith(".env") || /(?:secret|credential|private[-_]key)/.test(base) || lower.split("/").some(p => p === ".." || p === ".git")) return true;
  if (SKIP_NAMES.has(base) || base.endsWith(".lock")) return true;
  const dot = base.lastIndexOf(".");
  if (dot !== -1 && SKIP_EXTENSIONS.has(base.slice(dot))) return true;
  return false;
}

async function fetchRepoFile(base: string, path: string, userToken?: string, ref?: string): Promise<RepoFileContent | null> {
  if (isSkippableFile(path)) return null;
  try {
    const data = await githubApi(`${base}/contents/${safeRepoPath(path)}${ref ? `?ref=${encodeURIComponent(ref)}` : ""}`, 8000, userToken);
    if (!data || !data.content || data.encoding !== "base64") return null;
    let text = Buffer.from(data.content, "base64").toString("utf8");
    if (text.includes("\u0000")) return null;
    let truncated = false;
    if (text.length > MAX_FILE_CHARS) {
      text = text.slice(0, MAX_FILE_CHARS) + TRUNCATION_MARKER;
      truncated = true;
    }
    return { file: path, text, truncated };
  } catch {
    return null;
  }
}

const CONTENT_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py", ".go", ".rs", ".java",
  ".json", ".md", ".css", ".html", ".yml", ".yaml", ".sh", ".sql", ".c", ".cpp",
  ".php", ".rb", ".toml", ".xml", ".prisma", ".graphql",
]);

const WELL_KNOWN_EXTENSIONLESS = new Set(["license", "licence", "copying", "readme", "dockerfile", "makefile"]);

const MAX_CONTENT_CANDIDATES = 60;
const RAW_FETCH_CONCURRENCY = 8;
const RAW_FETCH_BUDGET_MS = 10_000;
const MAX_RAW_CHARS = 20 * 1024;

export interface ContentFileText {
  file: string;
  text: string;
}

export function isContentCandidate(path: string): boolean {
  if (isExcludedEvidencePath(path) || isSkippableFile(path)) return false;
  const lower = path.toLowerCase();
  const base = lower.split("/").pop() || lower;
  const dot = base.lastIndexOf(".");
  if (dot === -1) {
    return WELL_KNOWN_EXTENSIONLESS.has(base);
  }
  return CONTENT_EXTENSIONS.has(base.slice(dot));
}

function isPreferredContentPath(path: string): boolean {
  const lower = path.toLowerCase();
  return lower.startsWith("src/") || lower.startsWith("app/") || lower.startsWith("lib/") || !path.includes("/");
}

export function selectContentCandidates(paths: string[], claimKeywords: string[] = []): string[] {
  const candidates = paths.filter(isContentCandidate);
  const kwSet = [...new Set(claimKeywords.map((k) => k.toLowerCase()).filter((k) => k.length > 2))];

  const scorePath = (p: string): number => {
    const lower = p.toLowerCase();
    let score = isPreferredContentPath(p) ? 2 : 0;
    for (const kw of kwSet) {
      if (lower.includes(kw)) score += 5;
    }
    return score;
  };

  return [...candidates]
    .sort(
      (a, b) =>
        scorePath(b) - scorePath(a) ||
        a.length - b.length ||
        a.localeCompare(b)
    )
    .slice(0, MAX_CONTENT_CANDIDATES);
}

async function fetchRawFile(
  owner: string,
  repo: string,
  branch: string,
  path: string,
  deadline: number,
  userToken?: string
): Promise<ContentFileText | null> {
  const remaining = deadline - Date.now();
  if (remaining <= 0) return null;
  try {
    const encoded = path.split("/").map(encodeURIComponent).join("/");
    const response = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${encoded}`, {
      headers: getGitHubHeaders(userToken, "text/plain"),
      signal: AbortSignal.timeout(Math.min(remaining, RAW_FETCH_BUDGET_MS)),
    });
    if (!response.ok) return null;
    let text = await response.text();
    if (text.includes("\u0000")) return null;
    if (text.length > MAX_RAW_CHARS) text = text.slice(0, MAX_RAW_CHARS);
    return { file: path, text };
  } catch {
    return null;
  }
}

export async function fetchRawFileTexts(
  owner: string,
  repo: string,
  branch: string,
  paths: string[],
  userToken?: string
): Promise<ContentFileText[]> {
  const deadline = Date.now() + RAW_FETCH_BUDGET_MS;
  const out: ContentFileText[] = [];
  for (let i = 0; i < paths.length; i += RAW_FETCH_CONCURRENCY) {
    if (Date.now() >= deadline) break;
    const chunk = paths.slice(i, i + RAW_FETCH_CONCURRENCY);
    const results = await Promise.all(
      chunk.map((p) => fetchRawFile(owner, repo, branch, p, deadline, userToken))
    );
    for (const result of results) {
      if (result) out.push(result);
    }
  }
  return out;
}

export async function fetchFileContentsForClaims(
  base: string,
  filesByClaim: Record<string, string[]>,
  userToken?: string,
  ref?: string
): Promise<Record<string, RepoFileContent[]>> {
  const cache = new Map<string, Promise<RepoFileContent | null>>();
  const load = (path: string): Promise<RepoFileContent | null> => {
    let pending = cache.get(path);
    if (!pending) {
      pending = fetchRepoFile(base, path, userToken, ref);
      cache.set(path, pending);
    }
    return pending;
  };

  const entries = Object.entries(filesByClaim).slice(0, 15);
  const results = await Promise.all(
    entries.map(async ([claimId, files]) => {
      const eligible = (files || [])
        .filter((f) => typeof f === "string" && !isSkippableFile(f))
        .slice(0, MAX_FILES_PER_CLAIM);
      const loaded = await Promise.all(eligible.map(load));
      return [claimId, loaded.filter((f): f is RepoFileContent => f !== null)] as const;
    })
  );

  const out: Record<string, RepoFileContent[]> = {};
  for (const [claimId, files] of results) {
    out[claimId] = files;
  }
  return out;
}
