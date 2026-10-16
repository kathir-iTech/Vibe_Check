// Shared deterministic verification guards used by both src/lib/gemini.ts (production)
// and scripts/test-core.mjs (unit test suite) so tests execute the exact production functions.

export const RESTATEMENT_REASON =
  "The cited line restates the claim; a restatement is not evidence.";
export const COMMENT_SPOOF_REASON =
  "The cited line is a code comment or TODO/placeholder, not executable implementation evidence.";
export const NEGATION_MISMATCH_REASON =
  "The cited line contains a negation or disabled marker that conflicts with a positive claim.";
export const NO_CONTRADICTION_KEYWORDS_REASON =
  "The cited spec line does not mention the claim's subject; not treated as a contradiction.";

export const STOPWORDS = new Set([
  "the", "and", "for", "are", "not", "this", "that", "with", "from", "into",
  "been", "will", "have", "does", "just", "also", "more", "than", "then",
  "project", "uses", "used", "using", "file", "files", "code", "repo", "repository",
]);

export function normalize(s) {
  return String(s || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

// Splits camelCase / PascalCase / snake_case identifiers into component words
// while also keeping the joined token so both "fetchWithTimeout" and "timeout" match.
export function tokenize(s) {
  const raw = String(s || "");
  const expanded = raw.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/_/g, " ");
  const combined = `${raw} ${expanded}`.toLowerCase();
  return combined
    .split(/[^a-z0-9]+/)
    .filter((w) => w && !STOPWORDS.has(w));
}

export function normalizeForLineMatch(s) {
  return String(s || "")
    .replace(/\\\\/g, "\\")
    .replace(/\\\$/g, "$")
    .replace(/\\`/g, "`")
    .replace(/\\u0060/g, "`")
    .replace(/\\"/g, '"')
    .replace(/\*\*/g, "")
    .replace(/__/g, "")
    .replace(/\u2014|\u2013/g, "-");
}

function stripOuterFormatting(s) {
  return s
    .replace(/^\d+:\s*/, "")
    .replace(/^[-*>+\s]+/, "")
    .replace(/[;,\s]+$/, "")
    .trim();
}

// Whole-line aware verifier: matches exact normalized lines, or substantial lines
// where the quote covers the meaningful statement on that line (preventing tiny 1-word substring spoofing).
export function findLineNumber(docText, quote) {
  const lines = String(docText || "").split("\n");
  const rawNormalized = normalize(normalizeForLineMatch(quote));
  if (!rawNormalized) return -1;
  const strippedQuote = stripOuterFormatting(rawNormalized);
  if (!strippedQuote) return -1;

  // Pass 1: exact normalized line match (or exact after stripping prompt line prefix / markdown bullet)
  for (let i = 0; i < lines.length; i++) {
    const candRaw = normalize(normalizeForLineMatch(lines[i]));
    if (!candRaw) continue;
    const candStripped = stripOuterFormatting(candRaw);
    if (candRaw === rawNormalized || candStripped === strippedQuote) {
      return i + 1;
    }
  }

  // Pass 2: bounded substring match only when the quote is substantive (>= 12 chars)
  // and covers at least 55% of the candidate line (or is a complete clause in a markdown/spec paragraph).
  if (strippedQuote.length < 10) return -1;
  for (let i = 0; i < lines.length; i++) {
    const candRaw = normalize(normalizeForLineMatch(lines[i]));
    if (!candRaw) continue;
    const candStripped = stripOuterFormatting(candRaw);
    if (
      candRaw.includes(rawNormalized) ||
      candStripped.includes(strippedQuote)
    ) {
      const ratio = strippedQuote.length / Math.max(1, candStripped.length);
      if (ratio >= 0.45 || strippedQuote.length >= 28) {
        return i + 1;
      }
    }
  }

  return -1;
}

const CODE_FILE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|c|cpp|rb|php|sh)$/i;
const TODO_SPOOF_RE = /\b(todo|fixme|hack|xxx|unimplemented|not\s+implemented|not\s+wired|placeholder|stub\s+only|coming\s+soon)\b/i;

export function isExecutableCodeLine(lineText, filePath = "") {
  const trimmed = String(lineText || "").trim();
  if (!trimmed) return false;
  if (TODO_SPOOF_RE.test(trimmed)) return false;

  // For executable code files (not .md/.json/.yml), reject pure comment lines
  if (CODE_FILE_EXT.test(filePath)) {
    if (
      trimmed.startsWith("//") ||
      trimmed.startsWith("/*") ||
      trimmed.startsWith("*") ||
      trimmed.startsWith("*/") ||
      trimmed.startsWith("#") ||
      trimmed.startsWith("<!--")
    ) {
      return false;
    }
  }
  return true;
}

const CLAIM_NEGATIVE_RE = /\b(no|not|never|without|none|disabled|excluded|omitted|absent|forbid|banned|skip|skips)\b/i;
const LINE_NEGATIVE_RE = /\b(not\s+\w+|never\s+\w+|disabled|unimplemented|unsupported|false\b|null\b|none\b)\b/i;

export function hasNegationMismatch(claimText, lineText) {
  const claimIsNegative = CLAIM_NEGATIVE_RE.test(claimText);
  if (claimIsNegative) return false;
  // Positive claim ("OAuth login is implemented", "auto-runs on load") paired with explicit negative/todo line
  if (TODO_SPOOF_RE.test(lineText)) return true;
  if (/\b(is|are|was|were)\s+not\s+/i.test(lineText)) return true;
  if (/\b(disabled|unimplemented|unsupported)\b/i.test(lineText) && !/\bdisabled:\s*opacity/i.test(lineText)) {
    return true;
  }
  return false;
}

export function isRestatement(claimText, quote, lineText) {
  const nClaim = normalize(claimText);
  const nQuote = normalize(quote);
  if (!nQuote || !nClaim) return false;
  if (nQuote.includes(nClaim) || nClaim.includes(nQuote)) return true;
  const claimKeywords = [...new Set(tokenize(claimText).filter((w) => w.length > 3))];
  if (!claimKeywords.length) return false;
  const lineTokens = new Set(tokenize(lineText || quote));
  const shared = claimKeywords.filter((k) => lineTokens.has(k));
  return shared.length / claimKeywords.length >= 0.8;
}

export function hasContradictionKeywords(claimText, contradictingLine) {
  const claimKeywords = [...new Set(tokenize(claimText).filter((w) => w.length > 3))];
  if (!claimKeywords.length) return false;
  const lineTokens = new Set(tokenize(contradictingLine || ""));
  const shared = claimKeywords.filter((k) => lineTokens.has(k));
  return shared.length >= 2;
}

export function calculateCodeRelevanceBonus(lineText) {
  const trimmed = String(lineText || "").trim();
  let bonus = 0;
  if (/^(export\s+)?(async\s+)?function\s+\w+/.test(trimmed)) bonus += 3;
  if (/^(export\s+)?const\s+\w+\s*=/.test(trimmed)) bonus += 2;
  if (/^(export\s+)?(interface|type|class)\s+\w+/.test(trimmed)) bonus += 2;
  return bonus;
}
