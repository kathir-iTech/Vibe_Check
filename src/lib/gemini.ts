export async function extractClaimsViaGemini(message: string, apiKey: string) {
  const MODEL = "gemini-3-flash-preview";
  const prompt = `Extract discrete checkable claims from this AI coding agent message. Return only a JSON array of claim objects, each with "id", "text", and "evidenceType" fields. Be precise and specific. Message: "${message}"`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1/models/${MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1 },
      }),
    }
  );

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

  try {
    return JSON.parse(text);
  } catch {
    return [{ id: "raw-1", text: message, evidenceType: ["file", "commit"] }];
  }
}
