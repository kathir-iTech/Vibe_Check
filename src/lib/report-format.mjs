export const REPORT_SCHEMA = "vibecheck/audit/v2";
export const VALID_VERDICTS = new Set([
  "TRUE",
  "PARTIAL",
  "UNVERIFIED",
  "SPEC-DRIFT",
]);
export function canonicalJSON(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value))
    return `[${value.map((v) => canonicalJSON(v ?? null)).join(",")}]`;
  return `{${Object.keys(value)
    .filter((k) => value[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonicalJSON(value[k])}`)
    .join(",")}}`;
}
export function unsignedReport(report) {
  const { sig, signatureVerified, ...payload } = report;
  return payload;
}
export function validReportShape(data) {
  if (
    !data ||
    typeof data !== "object" ||
    !Array.isArray(data.claims) ||
    !data.claims.length ||
    data.claims.length > 15 ||
    !Array.isArray(data.verdicts)
  )
    return false;
  if (
    typeof data.repoUrl !== "string" ||
    !/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/.test(data.repoUrl)
  )
    return false;
  if (typeof data.headSha !== "string" || !/^[a-f0-9]{40}$/i.test(data.headSha))
    return false;
  if (
    !data.source ||
    !["live", "demo", "imported"].includes(data.source.kind) ||
    typeof data.source.label !== "string"
  )
    return false;
  if (
    typeof data.verifierVersion !== "string" ||
    typeof data.generatedAt !== "string" ||
    (!Number.isFinite(Date.parse(data.generatedAt)) &&
      !(data.source.kind === "demo" && data.generatedAt === ""))
  )
    return false;
  if (
    data.retrieval?.fileHints != null &&
    (!Array.isArray(data.retrieval.fileHints) ||
      data.retrieval.fileHints.length > 8 ||
      !data.retrieval.fileHints.every((path) => typeof path === "string"))
  )
    return false;
  if (
    !data.retrieval ||
    !["totalFiles", "candidateFiles", "inspectedFiles", "omittedFiles"].every(
      (k) => Number.isInteger(data.retrieval[k]) && data.retrieval[k] >= 0,
    )
  )
    return false;
  if (
    !Array.isArray(data.requirements) ||
    data.requirements.length > 32 ||
    !Array.isArray(data.sourceDocuments) ||
    !Array.isArray(data.warnings) ||
    !data.warnings.every((v) => typeof v === "string")
  )
    return false;
  if (
    !data.models ||
    typeof data.models !== "object" ||
    !data.timings ||
    typeof data.timings !== "object"
  )
    return false;
  if (
    Object.values(data.models).some(
      (v) =>
        !v ||
        typeof v !== "object" ||
        (v.model != null && typeof v.model !== "string") ||
        (v.usage?.promptTokenCount != null &&
          (typeof v.usage.promptTokenCount !== "number" ||
            !Number.isFinite(v.usage.promptTokenCount) ||
            v.usage.promptTokenCount < 0)),
    )
  )
    return false;
  if (
    data.requirements.some(
      (r) =>
        !r ||
        typeof r.text !== "string" ||
        typeof r.file !== "string" ||
        typeof r.status !== "string" ||
        !Array.isArray(r.claimIds) ||
        !r.claimIds.every((id) => typeof id === "string") ||
        (r.strength != null && typeof r.strength !== "string") ||
        (r.line != null && (!Number.isInteger(r.line) || r.line < 1)) ||
        (r.suggestedClaimIds != null &&
          (!Array.isArray(r.suggestedClaimIds) ||
            !r.suggestedClaimIds.every((id) => typeof id === "string"))),
    )
  )
    return false;
  if (
    data.sourceDocuments.some(
      (d) => !d || typeof d.file !== "string" || typeof d.sha256 !== "string",
    )
  )
    return false;
  if (
    data.executionRecords != null &&
    (!Array.isArray(data.executionRecords) ||
      data.executionRecords.length > 100 ||
      data.executionRecords.some(
        (r) =>
          !r ||
          typeof r.name !== "string" ||
          typeof r.status !== "string" ||
          typeof r.conclusion !== "string" ||
          !/^https:\/\/github\.com\//.test(r.url) ||
          (r.headSha != null && r.headSha !== data.headSha),
      ))
  )
    return false;
  const ids = new Set();
  for (const claim of data.claims) {
    if (
      !claim ||
      !/^[\w-]{1,64}$/.test(claim.id) ||
      ids.has(claim.id) ||
      typeof claim.text !== "string" ||
      !claim.text.trim() ||
      claim.text.length > 300
    )
      return false;
    ids.add(claim.id);
  }
  const seen = new Set();
  for (const verdict of data.verdicts) {
    if (
      !verdict ||
      !VALID_VERDICTS.has(verdict.verdict) ||
      !ids.has(verdict.claimId) ||
      seen.has(verdict.claimId)
    )
      return false;
    if (
      [
        "reason",
        "claimText",
        "specReference",
        "nextEvidence",
        "obligation",
        "changeEvidence",
      ].some((k) => verdict[k] != null && typeof verdict[k] !== "string")
    )
      return false;
    if (
      verdict.contract != null &&
      (!verdict.contract ||
        typeof verdict.contract !== "object" ||
        !["checked", "established", "unknown", "resolve"].every(
          (k) =>
            typeof verdict.contract[k] === "string" &&
            verdict.contract[k].length < 4000,
        ))
    )
      return false;
    if (
      verdict.sourceCheck != null &&
      (!verdict.sourceCheck ||
        typeof verdict.sourceCheck !== "object" ||
        !["ceiling", "kind", "note"].every(
          (k) => typeof verdict.sourceCheck[k] === "string",
        ))
    )
      return false;
    for (const field of ["code", "spec"])
      if (
        verdict[field] &&
        (typeof verdict[field].file !== "string" ||
          !Number.isInteger(verdict[field].line) ||
          verdict[field].line < 1 ||
          typeof verdict[field].quote !== "string")
      )
        return false;
    seen.add(verdict.claimId);
  }
  return seen.size === ids.size;
}
