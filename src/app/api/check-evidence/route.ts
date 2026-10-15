import { NextRequest, NextResponse } from "next/server";
import {
  fetchCommitDiffDetails,
  fetchRawFileTexts,
  githubApi,
  getDefaultBranch,
  selectContentCandidates,
} from "@/lib/github";
import { createTimings, serverTimingHeader } from "@/lib/timings";

const STOPWORDS = new Set([
  "this", "that", "they", "have", "been", "will", "from", "with", "what",
  "when", "where", "how", "than", "over", "their", "there", "would",
  "could", "should", "about", "into", "more", "some", "such", "the", "has",
]);

const PATH_MATCH_BONUS = 2;
const TOP_FILES_PER_CLAIM = 5;

export const maxDuration = 60;

function tokens(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

function claimKeywords(text: string): string[] {
  return tokens(text).filter((w) => w.length > 3 && !STOPWORDS.has(w));
}

function tokensMatching(candidate: string, keywords: string[]): string[] {
  const cand = tokens(candidate);
  return keywords.filter((k) =>
    cand.some((t) => t.includes(k) || (t.length > 3 && k.includes(t)))
  );
}

function isRelevant(candidate: string, keywords: string[], minMatches: number): boolean {
  return tokensMatching(candidate, keywords).length >= minMatches;
}

function findBestLinePreview(text: string, hits: string[]): { lineNumber?: number; previewLine?: string } {
  if (!text || !hits.length) return {};
  const lines = text.split("\n");
  let bestLine = -1;
  let bestScore = 0;
  for (let i = 0; i < lines.length; i++) {
    const lower = lines[i].toLowerCase();
    const score = hits.filter((h) => lower.includes(h)).length;
    if (score > bestScore && lines[i].trim().length > 2) {
      bestScore = score;
      bestLine = i + 1;
    }
  }
  if (bestLine === -1) return {};
  return {
    lineNumber: bestLine,
    previewLine: lines[bestLine - 1].trim().slice(0, 140),
  };
}

export async function POST(request: NextRequest) {
  const timings = createTimings();
  const body = await request.json();
  const repoUrl = body.repoUrl || "";
  const claims = Array.isArray(body.claims) ? body.claims : [];

  if (!repoUrl) {
    return NextResponse.json({ evidence: {}, error: "repoUrl required" });
  }

  const match = repoUrl.match(/github\.com\/([^/]+)\/([^/\s]+)/);
  if (!match) {
    return NextResponse.json({ evidence: {}, error: "Invalid GitHub URL" });
  }

  const [, owner, repo] = match;
  const cleanRepo = repo.replace(/\.git$/, "");

  let branch: string;
  try {
    branch = await getDefaultBranch(owner, cleanRepo);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { evidence: {}, error: `Could not access repo ${owner}/${cleanRepo}: ${msg}` },
      { status: 404 }
    );
  }
  const base = `https://api.github.com/repos/${owner}/${cleanRepo}`;

  let commits: any;
  let files: any;
  try {
    [commits, files] = await Promise.all([
      githubApi(`${base}/commits?per_page=30`),
      githubApi(`${base}/git/trees/${branch}?recursive=1`),
    ]);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { evidence: {}, error: `Failed to fetch repo data: ${msg}` },
      { status: 502 }
    );
  }
  const fileNames: string[] = (files?.tree || [])
    .filter((t: any) => t.type === "blob" && !t.path.startsWith("devpost/") && !t.path.startsWith("benchmark/"))
    .map((t: any) => t.path);
  const commitList: any[] = Array.isArray(commits) ? commits : [];
  timings.lap("githubTree");

  let contentTexts: { file: string; text: string }[] = [];
  try {
    if (claims.length) {
      contentTexts = await fetchRawFileTexts(owner, cleanRepo, branch, selectContentCandidates(fileNames));
    }
  } catch {
    contentTexts = [];
  }
  const textByFile = new Map<string, string>(contentTexts.map((c) => [c.file, c.text]));
  timings.lap("rawFileFetch");

  // Also inspect commit diffs/patches for the 3 most recent commits + any matched commits
  const candidateShas = commitList.slice(0, 3).map((c: any) => String(c.sha || "")).filter(Boolean);
  const commitDiffMap = await fetchCommitDiffDetails(base, candidateShas, 3);
  timings.lap("commitDiffs");

  const evidence: Record<string, any> = {};

  for (const claim of claims) {
    const claimText = claim.text || claim;
    const claimId = claim.id || claimText;
    const keywords = claimKeywords(claimText);

    const matchedFiles = fileNames.filter((f) => isRelevant(f, keywords, 1));
    const pathMatched = new Set(matchedFiles);
    const matchedCommits = commitList.filter((c) => {
      const msgRelevant = isRelevant(
        c.commit?.message || "",
        keywords,
        Math.min(2, Math.max(1, Math.ceil(keywords.length / 2)))
      );
      if (msgRelevant) return true;
      const diffDetail = commitDiffMap[c.sha];
      if (diffDetail) {
        return (
          diffDetail.filesChanged.some((f) => isRelevant(f, keywords, 1)) ||
          isRelevant(diffDetail.patchPreview, keywords, 2)
        );
      }
      return false;
    });

    const contentHits = new Map<string, string[]>();
    for (const { file, text } of contentTexts) {
      const lower = text.toLowerCase();
      const hits = keywords.filter((k) => lower.includes(k));
      if (hits.length) contentHits.set(file, hits);
    }

    const scored = new Map<
      string,
      {
        file: string;
        hitCount: number;
        matchedTerms: string[];
        pathMatched: boolean;
        lineNumber?: number;
        previewLine?: string;
      }
    >();
    for (const file of matchedFiles) {
      scored.set(file, { file, hitCount: 0, matchedTerms: [], pathMatched: true });
    }
    for (const [file, hits] of contentHits) {
      const existing = scored.get(file);
      const rawText = textByFile.get(file) || "";
      const preview = findBestLinePreview(rawText, hits);
      scored.set(file, {
        file,
        hitCount: hits.length,
        matchedTerms: hits,
        pathMatched: existing ? existing.pathMatched : pathMatched.has(file),
        lineNumber: preview.lineNumber,
        previewLine: preview.previewLine,
      });
    }

    const top = [...scored.values()]
      .sort(
        (a, b) =>
          b.hitCount +
          (b.pathMatched ? PATH_MATCH_BONUS : 0) -
          (a.hitCount + (a.pathMatched ? PATH_MATCH_BONUS : 0)) ||
          b.hitCount - a.hitCount ||
          a.file.length - b.file.length ||
          a.file.localeCompare(b.file)
      )
      .slice(0, TOP_FILES_PER_CLAIM);

    const contentTerms = new Set<string>();
    for (const hits of contentHits.values()) {
      for (const hit of hits) contentTerms.add(hit);
    }

    evidence[claimId] = {
      files: top.map((t) => t.file),
      fileMatches: top.map(({ file, hitCount, matchedTerms, pathMatched: pm, lineNumber, previewLine }) => ({
        file,
        hitCount,
        matchedTerms,
        pathMatched: pm,
        lineNumber,
        previewLine,
      })),
      commits: matchedCommits.slice(0, 5).map((c: any) => {
        const diff = commitDiffMap[c.sha];
        return {
          sha: c.sha,
          message: c.commit?.message,
          date: c.commit?.author?.date,
          author: c.commit?.author?.name,
          filesChanged: diff?.filesChanged,
          additions: diff?.additions,
          deletions: diff?.deletions,
          patchPreview: diff?.patchPreview,
        };
      }),
      matchedTerms: [
        ...new Set([
          ...keywords.filter(
            (k) =>
              matchedFiles.some((f) => tokensMatching(f, [k]).length) ||
              matchedCommits.some((c) => tokensMatching(c.commit?.message || "", [k]).length)
          ),
          ...contentTerms,
        ]),
      ],
      totalFilesInRepo: fileNames.length,
      defaultBranch: branch,
    };
  }

  const finalTimings = timings.finish();
  return NextResponse.json(
    { evidence, timings: finalTimings },
    { headers: { "Server-Timing": serverTimingHeader(finalTimings) } }
  );
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("repoUrl") || "";
  const match = url.match(/github\.com\/([^/]+)\/([^/\s]+)/);
  if (!match) {
    return NextResponse.json({ error: "Invalid GitHub URL" });
  }
  const [, owner, repo] = match;
  const cleanRepo = repo.replace(/\.git$/, "");
  const data = await githubApi(
    `https://api.github.com/repos/${owner}/${cleanRepo}/commits?per_page=5`
  );
  return NextResponse.json({ commits: data });
}
