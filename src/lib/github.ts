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