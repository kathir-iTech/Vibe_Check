import { splitClaimText } from "./evidence-depth.mjs";
export const VERIFIER_VERSION = "2.1.0";
export const RUNTIME_EVIDENCE_REASON =
  "This claim needs an execution or deployment record for the inspected commit. Source code alone cannot establish the outcome.";

export function evidenceObligation(text) {
  const value = String(text || "").toLowerCase();
  if (
    /\b(?:tests?|test suite|build|lint|checks?)\b.{0,30}\b(?:pass(?:ed|ing)?|succeed(?:ed)?|green)\b|\b(?:pass(?:ed|ing)?)\b.{0,20}\btests?\b/.test(
      value,
    )
  )
    return "execution";
  if (
    /\b(?:is|was|successfully|now|already|has been)\s+(?:live|deployed)|\bdeploy(?:ed|ment succeeded)\b|\b(?:wcag|performance score|zero vulnerabilities|production.ready)\b/.test(
      value,
    )
  )
    return "runtime";
  if (
    /\b(?:dependency|dependencies|licensed?|configuration|configured|version)\b/.test(
      value,
    )
  )
    return "configuration";
  if (
    /\b(?:scope|specification|design boundary|deliberately|excluded|forbidden)\b/.test(
      value,
    )
  )
    return "planning";
  return "implementation";
}

export function validateAuditClaims(claims) {
  if (!Array.isArray(claims) || !claims.length || claims.length > 15)
    throw new Error("Provide between 1 and 15 claims");
  const ids = new Set();
  const validated = claims.map((claim, i) => {
    const text =
      typeof claim === "string"
        ? claim.trim()
        : String(claim?.text || "").trim();
    const id = typeof claim?.id === "string" ? claim.id : `claim-${i + 1}`;
    if (
      !text ||
      text.length > 300 ||
      !/^[a-zA-Z0-9_-]{1,64}$/.test(id) ||
      ids.has(id)
    )
      throw new Error("Claims must have unique IDs and 1–300 characters");
    ids.add(id);
    return { id, text, evidenceType: ["file", "commit"] };
  });
  const atomic = validated.flatMap((claim) => {
    const parts = splitClaimText(claim.text);
    return parts.map((text, index) => ({
      ...claim,
      id:
        parts.length > 1 ? `${claim.id.slice(0, 58)}-p${index + 1}` : claim.id,
      text,
    }));
  });
  if (atomic.length > 15)
    throw new Error(
      "Splitting independent obligations exceeds 15 claims. Narrow the message.",
    );
  if (new Set(atomic.map((c) => c.id)).size !== atomic.length)
    throw new Error("Split claims need unique IDs");
  return atomic;
}

export function nextEvidence(text, verdict) {
  const type = evidenceObligation(text);
  if (type === "execution")
    return "Attach a completed CI check for this commit, including its name and result.";
  if (type === "runtime")
    return "Provide a deployment or runtime observation bound to this commit.";
  if (verdict === "SPEC-DRIFT")
    return "Resolve the cited requirement conflict or obtain an explicit scope change, then recheck.";
  if (verdict === "TRUE")
    return "Inspect the cited implementation; use an execution check before relying on runtime behavior.";
  return "Identify the implementation file or narrow the claim, then recheck the same revision.";
}

export function extractRequirements(docs) {
  const rows = [];
  for (const doc of docs) {
    let section = "";
    let fenced = false;
    doc.text.split("\n").forEach((line, i) => {
      if (/^\s*```|^\s*~~~/.test(line)) {
        fenced = !fenced;
        return;
      }
      if (fenced) return;
      if (/^#{1,6}\s/.test(line)) section = line.replace(/^#+\s*/, "");
      if (rows.length >= 32 || line.length > 500 || /^\s*(?:#|>|\|)/.test(line))
        return;
      const normative =
        /\b(?:must|shall|required|never|forbid(?:den)?|mustn't|cannot)\b/i.test(
          line,
        );
      const bullet = /^\s*(?:[-*]|\d+[.)])\s/.test(line);
      const acceptance =
        /\b(?:acceptance|non.goals?|constraints?|requirements?)\b/i.test(
          section,
        );
      if (
        line.trim().length >= 8 &&
        (normative ||
          (bullet &&
            (acceptance || /\b(?:no |only|should|excluded?)\b/i.test(line))))
      ) {
        rows.push({
          id: `requirement-${rows.length + 1}`,
          text: line
            .replace(/^\s*(?:[-*]|\d+[.)])\s*(?:\[[ xX]\]\s*)?/, "")
            .trim(),
          file: doc.file,
          line: i + 1,
          quote: line.trim(),
          section,
          strength:
            /\bshould\b/i.test(line) && !normative
              ? "advisory"
              : normative
                ? "explicit"
                : "acceptance-item",
          status: "needs-review",
          claimIds: [],
        });
      }
    });
  }
  return rows;
}

export function mapRequirements(requirements, claims, verdicts, tokenize) {
  return requirements.map((row) => {
    const conflicts = verdicts.filter(
      (v) =>
        v.verdict === "SPEC-DRIFT" &&
        v.spec?.file === row.file &&
        v.spec?.line === row.line &&
        claims.some((claim) => claim.id === v.claimId),
    );
    const words = new Set(tokenize(row.text).filter((w) => w.length > 3));
    const canonical = (value) => {
      const aliases = {
        auth: "authentication",
        login: "authentication",
        signin: "authentication",
        authenticate: "authentication",
        authorization: "authorization",
        caching: "cache",
        cached: "cache",
        licensing: "license",
        licensed: "license",
        licence: "license",
      };
      return new Set(
        tokenize(value)
          .map((w) => aliases[w] || w)
          .filter((w) => w.length > 3),
      );
    };
    const related = claims.filter(
      (c) =>
        conflicts.some((v) => v.claimId === c.id) ||
        [...new Set(tokenize(c.text))].filter((w) => words.has(w)).length >= 2,
    );
    const concepts = canonical(row.text);
    const possible = claims.filter(
      (c) => [...canonical(c.text)].filter((w) => concepts.has(w)).length >= 2,
    );
    return {
      ...row,
      claimIds: related.map((c) => c.id),
      status: conflicts.length
        ? "conflict"
        : related.length
          ? "mentioned"
          : possible.length
            ? "possible-match"
            : "not-mentioned",
      suggestedClaimIds: possible
        .filter((c) => !related.some((r) => r.id === c.id))
        .map((c) => c.id),
      note: "Lexical/alias association for review; requirement fulfillment is not certified. Possible matches need confirmation.",
    };
  });
}

export function compareAudits(previous, current, confirmedMatches = {}) {
  const normalize = (s) =>
    String(s || "")
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();
  const repo = (value) =>
    String(value || "")
      .replace(/\.git\/?$/, "")
      .replace(/\/$/, "")
      .toLowerCase();
  const comparable = repo(previous.repoUrl) === repo(current.repoUrl);
  const contextChanged = previous.reviewContext !== current.reviewContext;
  const assessmentChanged =
    previous.verifierVersion !== current.verifierVersion ||
    previous.headSha === current.headSha;
  return current.claims.map((claim) => {
    const manual = confirmedMatches[claim.id];
    const oldClaim =
      comparable &&
      previous.claims.find((c) =>
        manual ? c.id === manual : normalize(c.text) === normalize(claim.text),
      );
    const before =
      oldClaim && previous.verdicts.find((v) => v.claimId === oldClaim.id);
    const after = current.verdicts.find((v) => v.claimId === claim.id);
    return {
      claimId: claim.id,
      text: claim.text,
      before: comparable
        ? before?.verdict || "NOT CHECKED"
        : "DIFFERENT REPOSITORY",
      after: after?.verdict || "UNVERIFIED",
      changed: Boolean(
        before &&
        after &&
        before.verdict !== after.verdict &&
        !contextChanged &&
        !assessmentChanged,
      ),
      matchedBy: oldClaim ? (manual ? "user-confirmed" : "exact-text") : "none",
      contextChanged,
      comparable,
      assessmentChanged,
    };
  });
}
