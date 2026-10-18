import { NextRequest, NextResponse } from "next/server";
import {
  fetchCommitDiffDetails,
  fetchRawFileTexts,
  githubApi,
  isExcludedEvidencePath,
  parseGitHubRepoUrl,
  selectContentCandidates,
  resolveSnapshot,
} from "@/lib/github";
import {
  calculateCodeRelevanceBonus,
  isExecutableCodeLine,
  tokenize,
} from "@/lib/verification-guards.mjs";
import { createTimings, serverTimingHeader } from "@/lib/timings";

const PATH_MATCH_BONUS = 2;
const TOP_FILES_PER_CLAIM = 5;
const MAX_CLAIMS = 15;
const MAX_CLAIM_CHARS = 300;

export const maxDuration = 60;

function claimKeywords(text: string): string[] {
  return [...new Set(tokenize(text).filter((w) => w.length > 3))];
}

function tokensMatching(candidate: string, keywords: string[]): string[] {
  const cand = tokenize(candidate);
  return keywords.filter((k) =>
    cand.some((t) => t.includes(k) || (t.length > 3 && k.includes(t)))
  );
}

function isRelevant(candidate: string, keywords: string[], minMatches: number): boolean {
  return tokensMatching(candidate, keywords).length >= minMatches;
}

function findBestLinePreview(
  text: string,
  hits: string[],
  filePath: string
): { lineNumber?: number; previewLine?: string; codeBonus: number } {
  if (!text || !hits.length) return { codeBonus: 0 };
  const lines = text.split("\n");
  let bestLine = -1;
  let bestScore = 0;
  let bestBonus = 0;
  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    if (!isExecutableCodeLine(rawLine, filePath)) continue;
    const lower = rawLine.toLowerCase();
    const hitScore = hits.filter((h) => lower.includes(h)).length;
    if (hitScore === 0) continue;
    const declBonus = calculateCodeRelevanceBonus(rawLine);
    const totalScore = hitScore * 2 + declBonus;
    if (totalScore > bestScore && rawLine.trim().length > 2) {
      bestScore = totalScore;
      bestLine = i + 1;
      bestBonus = declBonus;
    }
  }
  if (bestLine === -1) return { codeBonus: 0 };
  return {
    lineNumber: bestLine,
    previewLine: lines[bestLine - 1].trim().slice(0, 140),
    codeBonus: bestBonus,
  };
}

export async function POST(request: NextRequest) {
  const timings = createTimings();
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ evidence: {}, error: "Invalid JSON body" }, { status: 400 });
  }

  const repoUrl = typeof body?.repoUrl === "string" ? body.repoUrl.trim() : "";
  const rawClaims = Array.isArray(body?.claims) ? body.claims.slice(0, MAX_CLAIMS) : [];
  const userToken = request.headers?.get?.("x-github-token") || undefined;

  if (!repoUrl) {
    return NextResponse.json({ evidence: {}, error: "repoUrl required" }, { status: 400 });
  }

  let parsedRepo: { owner: string; repo: string; canonicalUrl: string };
  try {
    parsedRepo = parseGitHubRepoUrl(repoUrl);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Invalid GitHub URL";
    return NextResponse.json({ evidence: {}, error: msg }, { status: 400 });
  }

  const { owner, repo: cleanRepo } = parsedRepo;

  let branch: string;
  let headSha: string;
  try {
    const snapshot = await resolveSnapshot(repoUrl, typeof body.headSha === "string" ? body.headSha : "", userToken);
    branch = snapshot.defaultBranch;
    headSha = snapshot.headSha;
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
      githubApi(`${base}/commits?sha=${headSha}&per_page=30`, 8000, userToken),
      githubApi(`${base}/git/trees/${headSha}?recursive=1`, 8000, userToken),
    ]);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { evidence: {}, error: `Failed to fetch repo data: ${msg}` },
      { status: 502 }
    );
  }

  const treeTruncated = Boolean(files?.truncated);
  // Apply .agents/, .claude/, devpost/, and benchmark/ exclusions consistently across ALL retrieval stages
  const fileNames: string[] = (files?.tree || [])
    .filter((t: any) => t && t.type === "blob" && typeof t.path === "string" && !isExcludedEvidencePath(t.path))
    .map((t: any) => t.path);
  const commitList: any[] = Array.isArray(commits) ? commits : [];
  timings.lap("githubTree");

  // Collect all claim keywords so candidate selection ranks files by claim relevance before applying the 60-file cap
  const allClaimKeywords = rawClaims.flatMap((c: any) =>
    claimKeywords(String(c?.text || c || "").slice(0, MAX_CLAIM_CHARS))
  );

  let contentTexts: { file: string; text: string }[] = [];
  const candidates = selectContentCandidates(fileNames, allClaimKeywords);
  try {
    if (rawClaims.length) {
      contentTexts = await fetchRawFileTexts(owner, cleanRepo, headSha, candidates, userToken);
    }
  } catch {
    contentTexts = [];
  }
  const textByFile = new Map<string, string>(contentTexts.map((c) => [c.file, c.text]));
  timings.lap("rawFileFetch");

  // Identify commits matching any claim (plus the 2 latest commits) to fetch diffs/patches
  const matchedCommitShaSet = new Set<string>();
  for (const c of commitList.slice(0, 2)) {
    if (c?.sha) matchedCommitShaSet.add(String(c.sha));
  }
  for (const claim of rawClaims) {
    const kw = claimKeywords(String(claim?.text || claim || "").slice(0, MAX_CLAIM_CHARS));
    for (const c of commitList) {
      if (
        c?.sha &&
        isRelevant(c.commit?.message || "", kw, Math.min(2, Math.max(1, Math.ceil(kw.length / 2))))
      ) {
        matchedCommitShaSet.add(String(c.sha));
      }
    }
  }
  const commitDiffMap = await fetchCommitDiffDetails(
    base,
    [...matchedCommitShaSet],
    4,
    userToken
  );
  timings.lap("commitDiffs");

  const evidence: Record<string, any> = {};

  for (const claim of rawClaims) {
    const claimText = String(claim?.text || claim || "").slice(0, MAX_CLAIM_CHARS);
    const claimId = String(claim?.id || claimText);
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
      const fileTokens = new Set(tokenize(text));
      const lower = text.toLowerCase();
      const hits = keywords.filter((k) => fileTokens.has(k) || lower.includes(k));
      if (hits.length) contentHits.set(file, hits);
    }

    const scored = new Map<
      string,
      {
        file: string;
        hitCount: number;
        codeBonus: number;
        matchedTerms: string[];
        pathMatched: boolean;
        lineNumber?: number;
        previewLine?: string;
      }
    >();
    for (const file of matchedFiles) {
      scored.set(file, {
        file,
        hitCount: 0,
        codeBonus: 0,
        matchedTerms: [],
        pathMatched: true,
      });
    }
    for (const [file, hits] of contentHits) {
      const existing = scored.get(file);
      const rawText = textByFile.get(file) || "";
      const preview = findBestLinePreview(rawText, hits, file);
      scored.set(file, {
        file,
        hitCount: hits.length,
        codeBonus: preview.codeBonus,
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
          (b.pathMatched ? PATH_MATCH_BONUS : 0) +
          (b.codeBonus > 0 ? 1 : 0) -
          (a.hitCount + (a.pathMatched ? PATH_MATCH_BONUS : 0) + (a.codeBonus > 0 ? 1 : 0)) ||
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
      headSha,
      treeTruncated,
    };
  }

  const finalTimings = timings.finish();
  return NextResponse.json(
    { evidence, headSha, treeTruncated, planningFiles: (files?.tree || []).filter((f: any) => f.type === "blob" && /^(?:devpost\/|docs\/)?(?:scope|prd|spec)\.md$/i.test(f.path)).map((f: any) => f.path).slice(0, 6), retrieval: { totalFiles: fileNames.length, candidateFiles: candidates.length, inspectedFiles: contentTexts.length, omittedFiles: Math.max(0, fileNames.length - contentTexts.length), treeTruncated, bounded: true }, timings: finalTimings },
    { headers: { "Server-Timing": serverTimingHeader(finalTimings) } }
  );
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("repoUrl") || "";
  try {
    const { owner, repo } = parseGitHubRepoUrl(url);
    const data = await githubApi(
      `https://api.github.com/repos/${owner}/${repo}/commits?per_page=5`
    );
    return NextResponse.json({ commits: data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Invalid GitHub URL";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
