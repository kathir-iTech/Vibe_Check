export const VERIFIER_VERSION = "2.0.0";
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
  return claims.map((claim, i) => {
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
    doc.text.split("\n").forEach((line, i) => {
      if (/^#{1,6}\s/.test(line)) section = line.replace(/^#+\s*/, "");
      if (rows.length >= 12 || line.length > 500) return;
      if (
        /^\s*(?:[-*]|\d+[.)])\s/.test(line) &&
        /\b(?:must|shall|required|never|no |only|should|acceptance|excluded?|forbid(?:den)?)\b/i.test(
          line,
        )
      ) {
        rows.push({
          id: `requirement-${rows.length + 1}`,
          text: line.replace(/^\s*(?:[-*]|\d+[.)])\s*/, "").trim(),
          file: doc.file,
          line: i + 1,
          quote: line.trim(),
          section,
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
    const related = claims.filter(
      (c) =>
        conflicts.some((v) => v.claimId === c.id) ||
        [...new Set(tokenize(c.text))].filter((w) => words.has(w)).length >= 2,
    );
    return {
      ...row,
      claimIds: related.map((c) => c.id),
      status: conflicts.length
        ? "conflict"
        : related.length
          ? "mentioned"
          : "not-mentioned",
      note: "Keyword association for review; requirement fulfillment is not certified.",
    };
  });
}

export function compareAudits(previous, current) {
  const normalize = (s) =>
    String(s || "")
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();
  return current.claims.map((claim) => {
    const oldClaim = previous.claims.find(
      (c) => normalize(c.text) === normalize(claim.text),
    );
    const before =
      oldClaim && previous.verdicts.find((v) => v.claimId === oldClaim.id);
    const after = current.verdicts.find((v) => v.claimId === claim.id);
    return {
      text: claim.text,
      before: before?.verdict || "NOT CHECKED",
      after: after?.verdict || "UNVERIFIED",
      changed: before?.verdict !== after?.verdict,
    };
  });
}
