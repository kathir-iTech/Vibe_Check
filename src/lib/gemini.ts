import { GoogleGenAI } from "@google/genai";

const PRIMARY_MODEL = "gemini-3-flash-preview";
const FALLBACK_MODEL = "gemini-3.1-flash-lite";

export interface GeminiAnswer<T> {
  data: T;
  model: string | null;
  modelFallback: boolean;
}

function getClient(apiKey: string): GoogleGenAI {
  return new GoogleGenAI({ apiKey });
}

function httpStatusOf(error: unknown): number | null {
  const direct = (error as { status?: unknown } | null | undefined)?.status;
  if (typeof direct === "number") return direct;
  if (typeof direct === "string" && /^\d{3}$/.test(direct)) return Number(direct);
  const message = error instanceof Error ? error.message : "";
  const match = message.match(/(?:\bstatus[:\s]+|"code"\s*:\s*)(\d{3})\b/);
  return match ? Number(match[1]) : null;
}

function isFallbackWorthy(error: unknown): boolean {
  const status = httpStatusOf(error);
  return status === 429 || status === 503 || status === 404;
}

async function generateText(
  ai: GoogleGenAI,
  prompt: string,
  temperature: number
): Promise<{ text: string; model: string; modelFallback: boolean }> {
  try {
    const response = await ai.models.generateContent({
      model: PRIMARY_MODEL,
      contents: prompt,
      config: { temperature },
    });
    const text = response.text;
    if (!text) {
      throw new Error("Gemini returned an empty response");
    }
    return { text, model: PRIMARY_MODEL, modelFallback: false };
  } catch (error) {
    if (!isFallbackWorthy(error)) {
      throw error;
    }
    const response = await ai.models.generateContent({
      model: FALLBACK_MODEL,
      contents: prompt,
      config: { temperature },
    });
    const text = response.text;
    if (!text) {
      throw new Error("Gemini returned an empty response");
    }
    return { text, model: FALLBACK_MODEL, modelFallback: true };
  }
}

interface ParsedClaim {
  id: string;
  text: string;
  evidenceType: string[];
}

function validateClaims(data: unknown): ParsedClaim[] {
  if (!Array.isArray(data)) {
    throw new Error("Gemini returned a non-array response");
  }
  return data.map((item: any, index: number) => {
    if (!item || typeof item !== "object" || typeof item.text !== "string") {
      throw new Error(`Claim at index ${index} is missing a valid "text" field`);
    }
    return {
      id: typeof item.id === "string" ? item.id : `claim-${index + 1}`,
      text: item.text,
      evidenceType: Array.isArray(item.evidenceType) ? item.evidenceType : ["file", "commit"],
    };
  });
}

function extractJson(text: string): unknown {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("[");
    const end = cleaned.lastIndexOf("]");
    if (start !== -1 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error("Gemini returned unparseable JSON");
  }
}

export async function extractClaimsViaGemini(
  message: string,
  apiKey: string
): Promise<GeminiAnswer<ParsedClaim[]>> {
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not set");
  }

  const prompt = `Extract discrete checkable claims from this AI coding agent message. Return only a JSON array of claim objects, each with "id", "text", and "evidenceType" fields. Be precise and specific. Message: "${message}"`;

  const ai = getClient(apiKey);
  const { text, model, modelFallback } = await generateText(ai, prompt, 0.1);

  const parsed = extractJson(text);
  return { data: validateClaims(parsed), model, modelFallback };
}

export interface SpecDoc {
  file: string;
  text: string;
}

export interface SpecAssessment {
  claimId: string;
  contradicts: boolean;
  sourceDoc: string;
  lineNumber: number;
  contradictingLine: string;
  reason: string;
  supported: boolean;
  supportingFile: string;
  supportingQuote: string;
  supportingLine: number;
  quoteRejected: boolean;
}

const normalize = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

function findLineNumber(docText: string, quote: string): number {
  const lines = docText.split("\n");
  const nQuote = normalize(quote);
  if (!nQuote) return -1;
  for (let i = 0; i < lines.length; i++) {
    if (normalize(lines[i]).includes(nQuote)) return i + 1;
  }
  return -1;
}

function validateAssessments(
  data: unknown,
  claims: { id: string; text: string }[],
  docs: SpecDoc[],
  supportByClaim: Record<string, SpecDoc[]>
): SpecAssessment[] {
  if (!Array.isArray(data)) {
    throw new Error("Gemini returned a non-array response");
  }
  const byId = new Map<string, any>();
  for (const item of data) {
    if (!item || typeof item !== "object" || typeof item.claimId !== "string") {
      throw new Error("Gemini assessment missing a claimId");
    }
    byId.set(item.claimId, item);
  }
  return claims.map((claim) => {
    const item = byId.get(claim.id);
    if (!item) {
      throw new Error(`Gemini returned no assessment for ${claim.id}`);
    }
    if (typeof item.contradicts !== "boolean") {
      throw new Error(`Gemini assessment for ${claim.id} has no boolean "contradicts"`);
    }

    let contradicts = item.contradicts;
    let sourceDoc = "";
    let lineNumber = 0;
    let contradictingLine = "";
    let reason = typeof item.reason === "string" ? item.reason : "";

    if (contradicts && docs.length === 0) {
      contradicts = false;
    }

    if (contradicts) {
      sourceDoc = typeof item.sourceDoc === "string" ? item.sourceDoc : "";
      contradictingLine = typeof item.contradictingLine === "string" ? item.contradictingLine : "";
      const doc = docs.find((d) => d.file === sourceDoc);
      if (!doc) {
        throw new Error(`Gemini cited unknown document "${sourceDoc}" for ${claim.id}`);
      }
      lineNumber = findLineNumber(doc.text, contradictingLine);
      if (lineNumber === -1) {
        throw new Error(`Gemini quoted text not found in ${sourceDoc} for ${claim.id}: ${contradictingLine}`);
      }
      if (!reason) {
        reason = "Claim contradicts the repo's planning documents";
      }
    }

    let supported = item.supported === true;
    let supportingFile = typeof item.supportingFile === "string" ? item.supportingFile : "";
    let supportingQuote = typeof item.supportingQuote === "string" ? item.supportingQuote : "";
    let supportingLine = 0;
    let quoteRejected = false;

    if (supported) {
      const allowed = supportByClaim[claim.id] || [];
      const doc = allowed.find((d) => d.file === supportingFile);
      const found = doc && supportingQuote ? findLineNumber(doc.text, supportingQuote) : -1;
      if (found === -1) {
        quoteRejected = Boolean(supportingQuote);
        supported = false;
        supportingLine = 0;
      } else {
        supportingLine = found;
      }
    }

    if (!reason && supported) {
      reason = `Verified supporting line in ${supportingFile}`;
    }

    return {
      claimId: claim.id,
      contradicts,
      sourceDoc,
      lineNumber,
      contradictingLine,
      reason,
      supported,
      supportingFile,
      supportingQuote,
      supportingLine,
      quoteRejected,
    };
  });
}

function emptyAssessments(claims: { id: string; text: string }[]): SpecAssessment[] {
  return claims.map((c) => ({
    claimId: c.id,
    contradicts: false,
    sourceDoc: "",
    lineNumber: 0,
    contradictingLine: "",
    reason: "",
    supported: false,
    supportingFile: "",
    supportingQuote: "",
    supportingLine: 0,
    quoteRejected: false,
  }));
}

const numbered = (text: string) =>
  text.split("\n").map((line, i) => `${i + 1}: ${line}`).join("\n");

export async function assessClaimsAgainstSpec(
  claims: { id: string; text: string }[],
  docs: SpecDoc[],
  supportByClaim: Record<string, SpecDoc[]>,
  apiKey: string
): Promise<GeminiAnswer<SpecAssessment[]>> {
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not set");
  }
  const hasSupport = claims.some((c) => (supportByClaim[c.id] || []).length > 0);
  if (!claims.length || (!docs.length && !hasSupport)) {
    return { data: emptyAssessments(claims), model: null, modelFallback: false };
  }

  const docSections = docs
    .map((d) => `=== ${d.file} ===\n${numbered(d.text)}`)
    .join("\n\n");

  const fileSections = claims
    .map((c) => {
      const files = supportByClaim[c.id] || [];
      const body = files.length
        ? files.map((f) => `=== ${f.file} ===\n${numbered(f.text)}`).join("\n\n")
        : "(no repository files were matched to this claim)";
      return `--- ${c.id}: ${c.text}\n${body}`;
    })
    .join("\n\n");

  const contradictionRules = docs.length
    ? `Planning documents:
${docSections}

Contradiction (checked against the planning documents):
- "contradicts": true ONLY when a specific document line states something factually incompatible with the claim.
- When contradicts is true, "contradictingLine" must be an EXACT verbatim copy of one numbered document line above (without the "N: " prefix), "sourceDoc" must be the document file (e.g. "devpost/scope.md"), and "reason" one short sentence naming the conflict.
- When contradicts is false: "contradictingLine" and "sourceDoc" must be "" and "reason" must be one short sentence explaining why nothing conflicts (supportive or silence both count as false).`
    : `No planning documents were provided for this repo, so the contradiction check is skipped:
- "contradicts" must be false for every claim, and "contradictingLine" and "sourceDoc" must be "".`;

  const prompt = `You verify an AI coding agent's claims against a GitHub repository.

${contradictionRules}

Matched repository files for each claim, every line numbered:
${fileSections}

Claims:
${JSON.stringify(claims.map((c) => ({ id: c.id, text: c.text })))}

Support (checked against the matched repository files):
- "supported": true ONLY when a line in one of that claim's matched repository files directly supports the claim.
- When "supported" is true, "supportingFile" must be the file path exactly as given above, and "supportingQuote" an EXACT verbatim copy of one numbered line from that file (without the "N: " prefix).
- When you are not certain the file supports the claim, return "supported": false with "supportingFile" and "supportingQuote" set to "".
- When "supported" is false, "reason" must say what the matched files did not show.
- Return exactly one object per claim, keyed by claim id.

Return ONLY a JSON array:
[{"claimId":"claim-1","contradicts":false,"sourceDoc":"","contradictingLine":"","reason":"...","supported":false,"supportingFile":"","supportingQuote":""}]`;

  const ai = getClient(apiKey);
  const { text, model, modelFallback } = await generateText(ai, prompt, 0);

  const parsed = extractJson(text);
  return {
    data: validateAssessments(parsed, claims, docs, supportByClaim),
    model,
    modelFallback,
  };
}
