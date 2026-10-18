import test from "node:test";
import assert from "node:assert/strict";
import { loadProduction } from "../scripts/test-support.mjs";

test("a primary provider deadline falls back once and reports the actual answering model", async () => {
  const calls = [];
  const { extractClaimsViaGemini } = loadProduction("src/lib/gemini.ts", {
    "@google/genai": {
      GoogleGenAI: class {
        models = {
          generateContent: async (request) => {
            calls.push(request);
            if (calls.length === 1)
              throw Object.assign(new Error("Deadline exceeded"), {
                status: 504,
              });
            return {
              text: '[{"id":"c1","text":"Next.js is a dependency"}]',
              usageMetadata: { promptTokenCount: 20 },
            };
          },
        };
      },
    },
  });
  const result = await extractClaimsViaGemini(
    "Next.js is a dependency",
    "test-only",
  );
  assert.equal(calls.length, 2);
  assert.notEqual(calls[0].model, calls[1].model);
  assert.equal(result.modelFallback, true);
  assert.equal(result.model, calls[1].model);
  assert.equal(result.usage.promptTokenCount, 20);
  assert.equal(result.data[0].id, "c1");
  assert.equal(calls[1].config.httpOptions.retryOptions.attempts, 1);
});

test("authentication failures do not repeat the same invalid credentials on a fallback", async () => {
  let calls = 0;
  const { extractClaimsViaGemini } = loadProduction("src/lib/gemini.ts", {
    "@google/genai": {
      GoogleGenAI: class {
        models = {
          generateContent: async () => {
            calls++;
            throw Object.assign(new Error("Invalid API key"), { status: 401 });
          },
        };
      },
    },
  });
  await assert.rejects(
    extractClaimsViaGemini("Dependency exists", "test-only"),
    /Invalid API key/,
  );
  assert.equal(calls, 1);
});
