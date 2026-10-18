import test from "node:test";
import assert from "node:assert/strict";
import { loadProduction } from "../scripts/test-support.mjs";
import {
  evidenceObligation,
  validateAuditClaims,
  extractRequirements,
  mapRequirements,
} from "../src/lib/audit-policy.mjs";
import { tokenize } from "../src/lib/verification-guards.mjs";

const sha = "a".repeat(40);
test("actual evidence route pins tree, history and content to one resolved commit", async () => {
  const previous = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (input) => {
    const url = String(input);
    calls.push(url);
    if (url.endsWith("/repos/acme/app"))
      return Response.json({ default_branch: "main", private: false });
    if (url.endsWith("/commits/main")) return Response.json({ sha });
    if (url.includes("/commits?"))
      return Response.json([
        {
          sha,
          commit: {
            message: "Add authentication",
            author: { date: "2026-10-18" },
          },
        },
      ]);
    if (url.includes("/git/trees/"))
      return Response.json({ tree: [{ type: "blob", path: "src/auth.ts" }] });
    if (url.startsWith("https://raw.githubusercontent.com/"))
      return new Response("export function authenticate() { return true; }");
    if (url.endsWith(`/commits/${sha}`))
      return Response.json({ sha, files: [], stats: {} });
    throw new Error(`Unexpected fetch: ${url}`);
  };
  try {
    const route = loadProduction("src/app/api/check-evidence/route.ts");
    const response = await route.POST({
      json: async () => ({
        repoUrl: "https://github.com/acme/app",
        claims: [{ id: "c1", text: "Authentication function exists" }],
      }),
      headers: new Headers(),
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.headSha, sha);
    assert.ok(calls.some((u) => u.includes(`/git/trees/${sha}?`)));
    assert.ok(calls.some((u) => u.includes(`commits?sha=${sha}`)));
    assert.ok(calls.some((u) => u.includes(`/acme/app/${sha}/src/auth.ts`)));
    assert.equal(body.retrieval.inspectedFiles, 1);
  } finally {
    globalThis.fetch = previous;
  }
});

test("server-owned credential cannot be used to expose a private repository", async () => {
  const previous = globalThis.fetch;
  globalThis.fetch = async () =>
    Response.json({ private: true, default_branch: "main" });
  try {
    const { resolveSnapshot } = loadProduction("src/lib/github.ts");
    await assert.rejects(
      resolveSnapshot("https://github.com/acme/private"),
      /your own GitHub token/,
    );
  } finally {
    globalThis.fetch = previous;
  }
});

test("evidence obligation guards execution claims and rejects duplicate claims", () => {
  assert.equal(
    evidenceObligation("All unit tests passed successfully"),
    "execution",
  );
  assert.equal(evidenceObligation("Deployed to Vercel"), "runtime");
  assert.equal(evidenceObligation("Added a login function"), "implementation");
  assert.throws(
    () =>
      validateAuditClaims([
        { id: "same", text: "one" },
        { id: "same", text: "two" },
      ]),
    /unique/,
  );
  assert.throws(() => validateAuditClaims([{ text: "" }]), /characters/);
});

test("requirements report omissions without pretending keyword matches establish fulfillment", () => {
  const rows = extractRequirements([
    {
      file: "scope.md",
      text: "# Requirements\n- Must support password reset\n- Never execute user code",
    },
  ]);
  const mapped = mapRequirements(
    rows,
    [{ id: "c1", text: "Password reset function exists" }],
    [{ claimId: "c1", verdict: "TRUE" }],
    tokenize,
  );
  assert.equal(mapped[0].status, "mentioned");
  assert.equal(mapped[1].status, "not-mentioned");
  assert.match(mapped[0].note, /not certified/);
});

test("actual model validator rejects changed string literals and duplicate assessments", () => {
  const { validateAssessments } = loadProduction("src/lib/gemini.ts");
  const claims = [{ id: "c1", text: "The route uses HTTP GET" }];
  const assessment = {
    claimId: "c1",
    contradicts: false,
    supported: true,
    supportingFile: "route.ts",
    supportingQuote: 'const method = "get";',
  };
  const result = validateAssessments([assessment], claims, [], {
    c1: [{ file: "route.ts", text: 'const method = "GET";' }],
  });
  assert.equal(result[0].supported, false);
  assert.throws(
    () => validateAssessments([assessment, assessment], claims, [], {}),
    /duplicate/,
  );
});
