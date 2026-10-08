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
  docs: SpecDoc[]
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
    if (!item.contradicts) {
      return {
        claimId: claim.id,
        contradicts: false,
        sourceDoc: "",
        lineNumber: 0,
        contradictingLine: "",
        reason:
          typeof item.reason === "string" && item.reason
            ? item.reason
            : "Nothing in the spec documents contradicts this claim",
      };
    }
    const sourceDoc = typeof item.sourceDoc === "string" ? item.sourceDoc : "";
    const quote = typeof item.contradictingLine === "string" ? item.contradictingLine : "";
    const doc = docs.find((d) => d.file === sourceDoc);
    if (!doc) {
      throw new Error(`Gemini cited unknown document "${sourceDoc}" for ${claim.id}`);
    }
    const lineNumber = findLineNumber(doc.text, quote);
    if (lineNumber === -1) {
      throw new Error(`Gemini quoted text not found in ${sourceDoc} for ${claim.id}: ${quote}`);
    }
    return {
      claimId: claim.id,
      contradicts: true,
      sourceDoc,
      lineNumber,
      contradictingLine: quote,
      reason:
        typeof item.reason === "string" && item.reason
          ? item.reason
          : "Claim contradicts the repo's planning documents",
    };
  });
}

export async function assessClaimsAgainstSpec(
  claims: { id: string; text: string }[],
  docs: SpecDoc[],
  apiKey: string
): Promise<GeminiAnswer<SpecAssessment[]>> {
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not set");
  }
  if (!claims.length || !docs.length) {
    return {
      data: claims.map((c) => ({
        claimId: c.id,
        contradicts: false,
        sourceDoc: "",
        lineNumber: 0,
        contradictingLine: "",
        reason: "",
      })),
      model: null,
      modelFallback: false,
    };
  }

  const docSections = docs
    .map(
      (d) =>
        `=== ${d.file} ===\n` +
        d.text.split("\n").map((line, i) => `${i + 1}: ${line}`).join("\n")
    )
    .join("\n\n");

  const prompt = `You compare an AI coding agent's claims against a project's planning documents.

Documents:
${docSections}

Claims:
${JSON.stringify(claims.map((c) => ({ id: c.id, text: c.text })))}

For each claim, decide whether any document DIRECTLY CONTRADICTS it.
- "contradicts": true ONLY when a specific document line states something factually incompatible with the claim.
- When contradicts is true, "contradictingLine" must be an EXACT verbatim copy of one numbered line above (without the "N: " prefix), "sourceDoc" must be the document file (e.g. "devpost/scope.md"), and "reason" one short sentence naming the conflict.
- When contradicts is false: "contradictingLine" and "sourceDoc" must be "" and "reason" must be one short sentence explaining why nothing conflicts (supportive or silence both count as false).
- Return exactly one object per claim, keyed by claim id.

Return ONLY a JSON array:
[{"claimId":"claim-1","contradicts":false,"sourceDoc":"","contradictingLine":"","reason":"..."}]`;

  const ai = getClient(apiKey);
  const { text, model, modelFallback } = await generateText(ai, prompt, 0);

  const parsed = extractJson(text);
  return { data: validateAssessments(parsed, claims, docs), model, modelFallback };
}
