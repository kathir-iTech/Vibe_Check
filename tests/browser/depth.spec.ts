import { test, expect } from "@playwright/test";
import { EXAMPLE_AUDIT } from "../../src/lib/example-audit";

test("review extraction precedes inspection and accepts explicit source hints", async ({
  page,
}) => {
  let inspected = false;
  await page.route("**/api/extract-claims", (route) =>
    route.fulfill({
      json: {
        claims: [
          { id: "c1", text: "A login function exists" },
          { id: "c2", text: "All tests passed" },
        ],
      },
    }),
  );
  await page.route("**/api/audit", (route) => {
    inspected = true;
    const input = route.request().postDataJSON();
    expect(input.fileHints).toEqual(["src/auth.ts"]);
    expect(input.claims).toHaveLength(2);
    return route.fulfill({
      contentType: "application/x-ndjson",
      body:
        JSON.stringify({
          type: "result",
          audit: EXAMPLE_AUDIT,
          auditReceipt: null,
        }) + "\n",
    });
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Review extracted claims first" })
    .click();
  await expect(page.getByLabel("One atomic claim per line")).toHaveValue(
    "A login function exists\nAll tests passed",
  );
  expect(inspected).toBe(false);
  await page.getByText("Advanced options", { exact: false }).click();
  await page.getByLabel(/Relevant files/).fill("src/auth.ts");
  await page
    .getByRole("button", { name: "Check the proof", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "A quick look at the results." }),
  ).toBeVisible();
  expect(inspected).toBe(true);
});

test("a failed later stage preserves extracted claims at the original revision", async ({
  page,
}) => {
  const sha = "c".repeat(40);
  await page.route("**/api/audit", (route) =>
    route.fulfill({
      contentType: "application/x-ndjson",
      body:
        [
          {
            type: "checkpoint",
            claims: [{ id: "c", text: "A session function exists" }],
            repoUrl: "https://github.com/acme/app",
            headSha: sha,
          },
          { type: "error", error: "Provider temporarily unavailable" },
        ]
          .map((v) => JSON.stringify(v))
          .join("\n") + "\n",
    }),
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "Check the proof", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Provider temporarily unavailable",
  );
  await page.getByRole("button", { name: "Recover extracted claims" }).click();
  await expect(page.getByLabel("One atomic claim per line")).toHaveValue(
    "A session function exists",
  );
  await expect(page.getByLabel("GitHub repository")).toHaveValue(
    "https://github.com/acme/app",
  );
  await page.getByText("Advanced options", { exact: false }).click();
  await expect(page.getByLabel("Inspect a commit")).toHaveValue(sha);
});

test("inspect-more keeps the report revision and repair handoffs contain unresolved obligations", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  await page.getByRole("button", { name: "Try an example" }).click();
  await page
    .getByRole("button", { name: "Inspect more evidence" })
    .first()
    .click();
  await expect(page.getByLabel("One atomic claim per line")).toHaveValue(
    "All tests passed.",
  );
  await page.getByText("Advanced options", { exact: false }).click();
  await expect(page.getByLabel("Inspect a commit")).toHaveValue(
    EXAMPLE_AUDIT.headSha,
  );
  await page.getByText("Repair handoff", { exact: true }).click();
  await page.getByRole("button", { name: "Copy repair checklist" }).click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain("- [ ] All tests passed.");
  expect(copied).toContain(EXAMPLE_AUDIT.headSha);
  expect(copied).not.toContain("- [ ] Next.js is a project dependency.");
});
