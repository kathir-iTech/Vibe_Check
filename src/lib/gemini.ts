import { GoogleGenAI } from "@google/genai";

const MODEL = "gemini-3-flash-preview";

function getClient(apiKey: string): GoogleGenAI {
  return new GoogleGenAI({ apiKey });
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

export async function extractClaimsViaGemini(message: string, apiKey: string): Promise<ParsedClaim[]> {
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not set");
  }

  const prompt = `Extract discrete checkable claims from this AI coding agent message. Return only a JSON array of claim objects, each with "id", "text", and "evidenceType" fields. Be precise and specific. Message: "${message}"`;

  const ai = getClient(apiKey);
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: { temperature: 0.1 },
  });

  const text = response.text;
  if (!text) {
    throw new Error("Gemini returned an empty response");
  }

  const parsed = extractJson(text);
  return validateClaims(parsed);
}
