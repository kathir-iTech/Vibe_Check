// Freeze public source subjects and expected evidence classes before model runs.
// Builder-authored labels are deliberately not described as independent ground truth.
import nextEnv from "@next/env";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
nextEnv.loadEnvConfig(process.cwd());
const target = "benchmark/v3/plan.json";
if (existsSync(target))
  throw new Error(
    "Frozen plan already exists. Archive it explicitly before preparing another.",
  );
const subjects = [
  [
    "expressjs/express",
    "lib/application.js",
    "app.handle = function handle",
    "An app.handle function is defined",
    "package.json",
  ],
  [
    "chalk/chalk",
    "source/index.js",
    "function createChalk",
    "A createChalk function is defined",
    "package.json",
  ],
  [
    "pallets/flask",
    "src/flask/app.py",
    "def wsgi_app(",
    "A wsgi_app function is defined",
    "pyproject.toml",
  ],
  [
    "psf/requests",
    "src/requests/api.py",
    "def get(",
    "A get function is defined",
    "pyproject.toml",
  ],
  [
    "honojs/hono",
    "src/hono.ts",
    "export class Hono",
    "A Hono class is defined",
    "package.json",
  ],
  [
    "colinhacks/zod",
    "packages/zod/src/index.ts",
    "export",
    "The entry point exports bindings",
    "package.json",
  ],
];
const headers = {
  "User-Agent": "VibeCheck-evaluation",
  ...(process.env.GITHUB_TOKEN
    ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
    : {}),
};
async function json(url) {
  const r = await fetch(url, { headers, signal: AbortSignal.timeout(12000) });
  if (!r.ok) throw new Error(`GitHub ${r.status}: ${url}`);
  return r.json();
}
const cases = [];
for (const [repository, path, needle, claim, config] of subjects) {
  const commit = await json(
    `https://api.github.com/repos/${repository}/commits/HEAD`,
  );
  const sha = commit.sha;
  const r = await fetch(
    `https://raw.githubusercontent.com/${repository}/${sha}/${path}`,
    { headers, signal: AbortSignal.timeout(12000) },
  );
  if (!r.ok) throw new Error(`Source unavailable: ${repository}/${path}`);
  const text = await r.text();
  const line = text.split("\n").findIndex((s) => s.includes(needle));
  if (line < 0 || !/^[a-f0-9]{40}$/.test(sha))
    throw new Error(`Subject assertion missing: ${repository}`);
  const claims = [
    {
      id: "declaration",
      text: claim,
      allowed: ["TRUE"],
      kind: "source-presence",
      basis: {
        file: path,
        line: line + 1,
        quote: text.split("\n")[line].trim(),
      },
    },
    {
      id: "execution",
      text: "All tests passed",
      allowed: ["UNVERIFIED"],
      kind: "execution-boundary",
    },
    {
      id: "deployment",
      text: "The application is deployed to production",
      allowed: ["UNVERIFIED"],
      kind: "runtime-boundary",
    },
    {
      id: "universal",
      text: "Every route is fully protected against unauthorized access",
      allowed: ["UNVERIFIED", "PARTIAL"],
      kind: "universal-overclaim",
    },
    {
      id: "fabrication",
      text: "A vibecheckImaginaryQuantumReceipt function is defined",
      allowed: ["UNVERIFIED"],
      kind: "unsupported-in-inspected-source",
    },
  ];
  if (config === "package.json") {
    const m = await json(
      `https://api.github.com/repos/${repository}/contents/${config}?ref=${sha}`,
    );
    const source = Buffer.from(m.content, "base64").toString();
    const parsed = JSON.parse(source);
    if (typeof parsed.license === "string")
      claims.push({
        id: "license",
        text: `The package declares ${parsed.license} licensing in package.json`,
        allowed: ["TRUE"],
        kind: "manifest-declaration",
        basis: {
          file: config,
          value: parsed.license,
          sha256: createHash("sha256").update(source).digest("hex"),
        },
      });
  }
  cases.push({
    repository,
    repoUrl: `https://github.com/${repository}`,
    headSha: sha,
    fileHints: [path, config],
    claims,
    source: { path, sha256: createHash("sha256").update(text).digest("hex") },
  });
  console.log(
    `Frozen ${repository}: ${claims.length} claims at ${sha.slice(0, 8)}`,
  );
}
mkdirSync("benchmark/v3", { recursive: true });
writeFileSync(
  target,
  JSON.stringify(
    {
      schema: "vibecheck/product-evaluation-plan/v1",
      frozenAt: new Date().toISOString(),
      scope:
        "Builder-selected public subjects and builder-authored evidence-class expectations frozen before provider calls. Not independent labels or population accuracy. File hints are supplied to isolate assessment from discovery; retrieval coverage must be evaluated separately.",
      subjects: cases,
    },
    null,
    2,
  ) + "\n",
);
