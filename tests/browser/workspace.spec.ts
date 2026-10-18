import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { encodeSignedReport } from "../../src/lib/report-crypto.mjs";
import { EXAMPLE_AUDIT } from "../../src/lib/example-audit";

test("first visit shows an honest idle state and an explicitly illustrative example", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Less guessing. More evidence." }),
  ).toBeVisible();
  await expect(
    page.getByText("Live server assessment", { exact: true }),
  ).toHaveCount(0);
  mkdirSync("artifacts/ui", { recursive: true });
  await page.screenshot({
    path: "artifacts/ui/light-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Try an example" }).click();
  await expect(
    page.getByText("Example · illustrative", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Copy verified link" }),
  ).toBeDisabled();
  await expect(
    page.getByText("A test script is not a completed test run."),
  ).toBeVisible();
  await expect(page.getByRole("tab", { name: /Requirements/ })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Next.js is a project dependency." }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

for (const width of [320, 390, 1440])
  test(`responsive layout and theme persistence at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    await page.getByRole("button", { name: "Try an example" }).click();
    if (width <= 760) {
      await expect(
        page.getByRole("region", { name: "Audit results" }),
      ).toBeFocused();
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.getByRole("button", { name: "Switch to light mode" }).click();
    await page.reload();
    await expect(page.locator("html")).not.toHaveClass(/dark/);
    await page.getByRole("button", { name: "Switch to dark mode" }).click();
    await page.screenshot({
      path: `artifacts/ui/dark-${width}.png`,
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });

test("workspace consumes server progress, exports, verifies reports and rejects changed evidence", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const audit = {
    ...EXAMPLE_AUDIT,
    source: { kind: "live" as const, label: "Synthetic browser-test fixture" },
    generatedAt: "2026-10-18T00:00:00Z",
    requirements: [
      {
        id: "r1",
        text: "Must support password reset",
        file: "scope.md",
        line: 1,
        quote: "Must support password reset",
        section: "Requirements",
        status: "not-mentioned",
        claimIds: [],
      },
    ],
  };
  const signed = encodeSignedReport(audit);
  await page.route("**/api/audit", (route) =>
    route.fulfill({
      contentType: "application/x-ndjson",
      body:
        [
          { type: "stage", stage: "source" },
          { type: "stage", stage: "assessment" },
          {
            type: "result",
            audit: signed.signedPayload,
            auditReceipt: signed.id,
          },
        ]
          .map((row) => JSON.stringify(row))
          .join("\n") + "\n",
    }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Check the proof" }).click();
  await expect(
    page.getByText("Live server assessment", { exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: /Requirements/ }).click();
  await expect(
    page.getByText("Must support password reset", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Check this requirement" }).click();
  await expect(page.getByLabel("One claim per line")).toHaveValue(
    "Must support password reset",
  );
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download JSON" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("vibecheck-audit.json");
  await page.getByRole("button", { name: "Copy verified link" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Verified report link copied",
  );
  const link = await page.evaluate(() => navigator.clipboard.readText());
  await page.goto(link);
  await expect(
    page.getByRole("heading", {
      name: "The report is intact. Inspect the evidence.",
    }),
  ).toBeVisible();
  await page.goto("/");
  const changed = structuredClone(signed.signedPayload);
  changed.verdicts[0].reason = "invented evidence";
  await expect(
    page.getByRole("button", { name: "Import & verify JSON" }),
  ).toBeEnabled();
  await page.getByLabel("Import audit report").setInputFiles({
    name: "changed.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(changed)),
  });
  await expect(page.locator(".error-message")).toContainText(
    "signed content was changed",
  );
});

test("actual report API refuses fabricated client verdicts without invoking a model", async ({
  request,
}) => {
  const response = await request.post("/api/generate-report", {
    data: EXAMPLE_AUDIT,
  });
  expect(response.status()).toBe(422);
});

test("interrupted audit keeps input and lets the user retry", async ({
  page,
}) => {
  await page.route("**/api/audit", (route) =>
    route.fulfill({
      contentType: "application/x-ndjson",
      body: '{"type":"stage","stage":"evidence"}\n',
    }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Check the proof" }).click();
  await expect(page.locator(".error-message")).toContainText(
    "connection ended",
  );
  await expect(page.getByLabel("Agent completion message")).toHaveValue(
    /Next.js/,
  );
  await expect(
    page.getByRole("button", { name: "Check the proof" }),
  ).toBeEnabled();
});

test("recheck preserves the earlier revision and shows changed claim assessments", async ({
  page,
}) => {
  const before = {
    ...EXAMPLE_AUDIT,
    source: { kind: "live" as const, label: "Controlled recheck fixture" },
    generatedAt: "2026-10-18T00:00:00Z",
  };
  const after = structuredClone(before);
  after.headSha = "b".repeat(40);
  after.verdicts[1].verdict = "PARTIAL";
  const requests: any[] = [];
  await page.route("**/api/audit", (route) => {
    requests.push(route.request().postDataJSON());
    const report = encodeSignedReport(requests.length === 1 ? before : after);
    return route.fulfill({
      contentType: "application/x-ndjson",
      body:
        JSON.stringify({
          type: "result",
          audit: report.signedPayload,
          auditReceipt: report.id,
        }) + "\n",
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Check the proof" }).click();
  await expect(
    page.getByText("Live server assessment", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("GitHub repository")
    .fill("https://github.com/other/unrelated");
  await page.getByRole("button", { name: "PR / commit" }).click();
  await expect(page.getByLabel("GitHub repository")).toHaveValue("");
  await page
    .getByLabel("GitHub PR or commit URL")
    .fill("https://github.com/other/unrelated/pull/1");
  await page.getByRole("button", { name: "Recheck latest revision" }).click();
  await expect(page.locator(".audit-title")).toContainText("bbbbbbbb");
  expect(requests[1].baseSha).toBe(before.headSha);
  expect(requests[1].repoUrl).toBe(before.repoUrl);
  expect(requests[1].sourceUrl).toBeUndefined();
  expect(requests[1].headSha).toBe("");
  expect(requests[1].claims.map((claim: any) => claim.text)).toEqual(
    before.claims.map((claim) => claim.text),
  );
  await page.getByRole("tab", { name: /Compare/ }).click();
  const row = page
    .locator(".comparison-row")
    .filter({ hasText: "All tests passed." });
  await expect(row).toContainText("Needs evidence");
  await expect(row).toContainText("Partial support");
});

test("clear this tab removes private draft fields, token and recovery checkpoint across reload", async ({
  page,
}) => {
  await page.route("**/api/audit", (route) =>
    route.fulfill({
      contentType: "application/x-ndjson",
      body:
        [
          {
            type: "checkpoint",
            claims: [{ id: "c1", text: "Private recovery claim" }],
            repoUrl: "https://github.com/private/repo",
            headSha: "c".repeat(40),
          },
          { type: "error", error: "Provider temporarily unavailable" },
        ]
          .map((row) => JSON.stringify(row))
          .join("\n") + "\n",
    }),
  );
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: /Check the proof/ }),
  ).toBeEnabled();
  await page
    .getByLabel("Agent completion message")
    .fill("Private handoff text");
  await page
    .getByLabel("GitHub repository")
    .fill("https://github.com/private/repo");
  await page.locator("summary").filter({ hasText: "Add requirements" }).click();
  await page
    .getByLabel(/Optional requirements/)
    .fill("Private review requirement");
  await page.locator("summary").filter({ hasText: "Advanced options" }).click();
  await page.getByLabel(/Relevant files/).fill("src/private.ts");
  await page
    .getByLabel(/Your GitHub read token/)
    .fill("test-only-never-a-real-token");
  await page.getByRole("button", { name: /Check the proof/ }).click();
  await expect(
    page.getByRole("button", { name: "Recover extracted claims" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Clear this tab", exact: true })
    .click();
  await expect(page.getByLabel("Agent completion message")).toHaveValue("");
  await expect(page.getByLabel(/Your GitHub read token/)).toHaveValue("");
  await expect
    .poll(() =>
      page.evaluate(
        () => sessionStorage.getItem("vibecheck-workspace-v2") || "",
      ),
    )
    .not.toMatch(/Private|private|test-only-never/);
  await page.reload();
  await expect(page.getByLabel("Agent completion message")).toHaveValue("");
  await expect(page.getByLabel("GitHub repository")).toHaveValue("");
  await expect(
    page.getByRole("button", { name: "Recover extracted claims" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Less guessing. More evidence." }),
  ).toBeVisible();
});

test("malformed tab cache cannot crash the workspace", async ({ page }) => {
  await page.addInitScript(() =>
    sessionStorage.setItem(
      "vibecheck-workspace-v2",
      JSON.stringify({
        audit: { source: { kind: "live" }, claims: "invalid" },
        message: { unexpected: true },
        checkpoint: { claims: "invalid" },
        mode: "invalid",
      }),
    ),
  );
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: /Check the proof/ }),
  ).toBeEnabled();
  await expect(
    page.getByRole("heading", { name: "Less guessing. More evidence." }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
