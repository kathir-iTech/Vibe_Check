import { NextRequest, NextResponse } from "next/server";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";

async function githubApi(url: string) {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "VibeCheck",
  };
  if (GITHUB_TOKEN) {
    headers["Authorization"] = `token ${GITHUB_TOKEN}`;
  }
  const response = await fetch(url, { headers });
  return response.json();
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const repoUrl = body.repoUrl || "";
  const claims = body.claims || [];

  if (!repoUrl) {
    return NextResponse.json({ evidence: {}, error: "repoUrl required" });
  }

  const match = repoUrl.match(/github\.com\/([^/]+)\/([^/\s]+)/);
  if (!match) {
    return NextResponse.json({ evidence: {}, error: "Invalid GitHub URL" });
  }

  const [, owner, repo] = match;
  const cleanRepo = repo.replace(/\.git$/, "");
  const base = `https://api.github.com/repos/${owner}/${cleanRepo}`;

  const evidence: Record<string, any> = {};

  for (const claim of claims) {
    const claimText = claim.text || claim;
    const claimId = claim.id || claimText;

    try {
      const [commits, files] = await Promise.all([
        githubApi(`${base}/commits?per_page=30`),
        githubApi(`/repos/${owner}/${cleanRepo}/git/trees/master?recursive=1`),
      ]);

      const fileNames = files?.tree?.map((t: any) => t.path) || [];
      const relevantFiles = fileNames.filter((f: string) =>
        claimText.toLowerCase().split(/\s+/).some((w: string) =>
          f.toLowerCase().includes(w.toLowerCase().slice(0, 15))
        )
      );

      const relevantCommits = commits.filter((c: any) =>
        c.commit?.message?.toLowerCase().includes(claimText.toLowerCase().slice(0, 20))
      );

      evidence[claimId] = {
        files: relevantFiles.slice(0, 10),
        commits: relevantCommits.slice(0, 5).map((c: any) => ({
          sha: c.sha,
          message: c.commit?.message,
          date: c.commit?.author?.date,
        })),
        totalFilesInRepo: fileNames.length,
      };
    } catch {
      evidence[claimId] = { error: "Failed to fetch evidence" };
    }
  }

  return NextResponse.json({ evidence });
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("repoUrl") || "";
  const match = url.match(/github\.com\/([^/]+)\/([^/\s]+)/);
  if (!match) {
    return NextResponse.json({ error: "Invalid GitHub URL" });
  }
  const [, owner, repo] = match;
  const cleanRepo = repo.replace(/\.git$/, "");
  const data = await githubApi(`https://api.github.com/repos/${owner}/${cleanRepo}/commits?per_page=5`);
  return NextResponse.json({ commits: data });
}
