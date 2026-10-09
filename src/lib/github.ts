export async function getDefaultBranch(owner: string, repo: string): Promise<string> {
  const url = `https://api.github.com/repos/${owner}/${repo}`;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "VibeCheck",
  };
  if (process.env.GITHUB_TOKEN) {
    headers["Authorization"] = `token ${process.env.GITHUB_TOKEN}`;
  }
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`);
  }
  const data = await response.json();
  return data.default_branch || "main";
}

export async function githubApi(url: string): Promise<any> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "VibeCheck",
  };
  if (process.env.GITHUB_TOKEN) {
    headers["Authorization"] = `token ${process.env.GITHUB_TOKEN}`;
  }
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`);
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

export async function fetchClaimTextFromUrl(raw: string): Promise<string> {
  const parsed = parseClaimSourceUrl(raw);
  const apiBase = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}`;
  try {
    if (parsed.kind === "pull") {
      const data = await githubApi(`${apiBase}/pulls/${parsed.ref}`);
      const title = String(data.title || "").trim();
      const body = String(data.body || "").trim();
      if (!title) {
        throw new Error("Pull request has an empty title.");
      }
      return body ? `${title}\n\n${body}` : title;
    }
    const data = await githubApi(`${apiBase}/commits/${parsed.ref}`);
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

export interface RepoFileContent {
  file: string;
  text: string;
  truncated: boolean;
}

function isSkippableFile(path: string): boolean {
  const lower = path.toLowerCase();
  if (SKIP_DIR_PARTS.some((part) => lower.includes(part))) return true;
  if (lower.startsWith(".env") || lower.endsWith(".pem") || lower.endsWith(".key") || lower.endsWith(".p12")) {
    return true;
  }
  const base = lower.split("/").pop() || lower;
  if (SKIP_NAMES.has(base) || base.endsWith(".lock")) return true;
  const dot = base.lastIndexOf(".");
  if (dot !== -1 && SKIP_EXTENSIONS.has(base.slice(dot))) return true;
  return false;
}

async function fetchRepoFile(base: string, path: string): Promise<RepoFileContent | null> {
  try {
    const data = await githubApi(`${base}/contents/${path}`);
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
  ".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs", ".java", ".json", ".md",
  ".css", ".html", ".yml", ".yaml",
]);

const CONTENT_EXCLUDED_DIRS = [".agents/", ".claude/", "devpost/"];

const MAX_CONTENT_CANDIDATES = 60;
const RAW_FETCH_CONCURRENCY = 10;
const RAW_FETCH_BUDGET_MS = 10_000;
const MAX_RAW_CHARS = 20 * 1024;

export interface ContentFileText {
  file: string;
  text: string;
}

function isContentCandidate(path: string): boolean {
  const lower = path.toLowerCase();
  if (CONTENT_EXCLUDED_DIRS.some((d) => lower.startsWith(d) || lower.includes(`/${d}`))) return false;
  if (isSkippableFile(path)) return false;
  const base = lower.split("/").pop() || lower;
  const dot = base.lastIndexOf(".");
  if (dot === -1) return false;
  return CONTENT_EXTENSIONS.has(base.slice(dot));
}

function isPreferredContentPath(path: string): boolean {
  const lower = path.toLowerCase();
  return lower.startsWith("src/") || lower.startsWith("app/") || lower.startsWith("lib/") || !path.includes("/");
}

export function selectContentCandidates(paths: string[]): string[] {
  const candidates = paths.filter(isContentCandidate);
  if (candidates.length <= MAX_CONTENT_CANDIDATES) return candidates;
  return [...candidates]
    .sort(
      (a, b) =>
        Number(!isPreferredContentPath(a)) - Number(!isPreferredContentPath(b)) ||
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
  deadline: number
): Promise<ContentFileText | null> {
  const remaining = deadline - Date.now();
  if (remaining <= 0) return null;
  try {
    const encoded = path.split("/").map(encodeURIComponent).join("/");
    const headers: Record<string, string> = {
      Accept: "text/plain",
      "User-Agent": "VibeCheck",
    };
    if (process.env.GITHUB_TOKEN) {
      headers["Authorization"] = `token ${process.env.GITHUB_TOKEN}`;
    }
    const response = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${encoded}`, {
      headers,
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
  paths: string[]
): Promise<ContentFileText[]> {
  const deadline = Date.now() + RAW_FETCH_BUDGET_MS;
  const out: ContentFileText[] = [];
  for (let i = 0; i < paths.length; i += RAW_FETCH_CONCURRENCY) {
    if (Date.now() >= deadline) break;
    const chunk = paths.slice(i, i + RAW_FETCH_CONCURRENCY);
    const results = await Promise.all(chunk.map((p) => fetchRawFile(owner, repo, branch, p, deadline)));
    for (const result of results) {
      if (result) out.push(result);
    }
  }
  return out;
}

export async function fetchFileContentsForClaims(
  base: string,
  filesByClaim: Record<string, string[]>
): Promise<Record<string, RepoFileContent[]>> {
  const cache = new Map<string, Promise<RepoFileContent | null>>();
  const load = (path: string): Promise<RepoFileContent | null> => {
    let pending = cache.get(path);
    if (!pending) {
      pending = fetchRepoFile(base, path);
      cache.set(path, pending);
    }
    return pending;
  };

  const entries = Object.entries(filesByClaim);
  const results = await Promise.all(
    entries.map(async ([claimId, files]) => {
      const eligible = (files || []).filter((f) => !isSkippableFile(f)).slice(0, MAX_FILES_PER_CLAIM);
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