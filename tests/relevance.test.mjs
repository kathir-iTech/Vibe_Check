import test from "node:test";
import assert from "node:assert/strict";
import { hasContradictionKeywords } from "../src/lib/verification-guards.mjs";
import { loadProduction } from "../scripts/test-support.mjs";

test("a specific license acronym and licensing concept survive the relevance guard", () => {
  assert.equal(
    hasContradictionKeywords(
      "This package is MIT licensed.",
      "MIT licensing is forbidden.",
    ),
    true,
  );
  assert.equal(
    hasContradictionKeywords(
      "This package is MIT licensed.",
      "Apache licensing is forbidden.",
    ),
    false,
  );
  assert.equal(
    hasContradictionKeywords(
      "This package is MIT licensed.",
      "MIT caching is forbidden.",
    ),
    false,
  );
  assert.equal(
    hasContradictionKeywords(
      "Added Redis caching.",
      "Redis caches are forbidden.",
    ),
    true,
  );
});

test("the production validator retains exact code and short requirement citations", () => {
  const { validateAssessments } = loadProduction("src/lib/gemini.ts");
  const result = validateAssessments(
    [
      {
        claimId: "license",
        contradicts: true,
        sourceDoc: "provided-requirements.md",
        contradictingLine: "- MIT licensing is forbidden.",
        supported: true,
        supportingFile: "package.json",
        supportingQuote: '"license": "MIT",',
        coverage: "full",
      },
    ],
    [{ id: "license", text: "This package is MIT licensed." }],
    [
      {
        file: "provided-requirements.md",
        text: "- MIT licensing is forbidden.",
      },
    ],
    { license: [{ file: "package.json", text: '{\n  "license": "MIT",\n}' }] },
  );
  assert.equal(result[0].contradicts, true);
  assert.equal(result[0].supported, true);
  assert.equal(result[0].lineNumber, 1);
  assert.equal(result[0].supportingLine, 2);
});
