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