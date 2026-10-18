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

test("malformed, empty and invalid claim output get one schema-bound fallback", async () => {
  for (const invalid of [
    '[{"text":"broken\nJSON"}]',
    "",
    '[{"id":"c1"}]',
    "[]",
  ]) {
    const calls = [];
    const { extractClaimsViaGemini } = loadProduction("src/lib/gemini.ts", {
      "@google/genai": {
        GoogleGenAI: class {
          models = {
            generateContent: async (request) => {
              calls.push(request);
              return {
                text:
                  calls.length === 1
                    ? invalid
                    : '[{"id":"c1","text":"A function exists","evidenceType":["file"]}]',
              };
            },
          };
        },
      },
    });
    const result = await extractClaimsViaGemini(
      "A function exists",
      "test-only",
    );
    assert.equal(calls.length, 2);
    assert.equal(result.modelFallback, true);
    assert.equal(result.model, calls[1].model);
    assert.equal(calls[0].config.responseJsonSchema.type, "array");
    assert.deepEqual(
      calls[0].config.responseJsonSchema,
      calls[1].config.responseJsonSchema,
    );
    assert.equal(result.data[0].text, "A function exists");
  }
});

test("two malformed responses stop without inventing a claim or leaking parser details", async () => {
  let calls = 0;
  const { extractClaimsViaGemini } = loadProduction("src/lib/gemini.ts", {
    "@google/genai": {
      GoogleGenAI: class {
        models = {
          generateContent: async () => {
            calls++;
            return { text: '[{"text":"broken\nJSON"}]' };
          },
        };
      },
    },
  });
  await assert.rejects(
    extractClaimsViaGemini("A function exists", "test-only"),
    /invalid response format/,
  );
  assert.equal(calls, 2);
});

test("fallback assessment still rejects fabricated quotations without retrying for a positive result", async () => {
  const calls = [];
  const { assessClaimsAgainstSpec } = loadProduction("src/lib/gemini.ts", {
    "@google/genai": {
      GoogleGenAI: class {
        models = {
          generateContent: async (request) => {
            calls.push(request);
            return {
              text:
                calls.length === 1
                  ? '{"broken":'
                  : JSON.stringify([
                      {
                        claimId: "c1",
                        contradicts: false,
                        supported: true,
                        coverage: "full",
                        supportingFile: "auth.ts",
                        supportingQuote: "invented quotation",
                      },
                    ]),
            };
          },
        };
      },
    },
  });
  const result = await assessClaimsAgainstSpec(
    [{ id: "c1", text: "An authenticate function is defined" }],
    [],
    {
      c1: [
        {
          file: "auth.ts",
          text: "export function authenticate() { return true; }",
        },
      ],
    },
    "test-only",
  );
  assert.equal(calls.length, 2);
  assert.equal(result.modelFallback, true);
  assert.equal(result.data[0].supported, false);
  assert.equal(result.data[0].quoteRejected, true);
  assert.deepEqual(
    calls[0].config.responseJsonSchema.items.properties.claimId.enum,
    ["c1"],
  );
});
