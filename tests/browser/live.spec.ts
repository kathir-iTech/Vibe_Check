import { test, expect } from "@playwright/test";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

test("real GitHub and Gemini audit, requirement conflict, export and offline signature verification", async ({
  page,
  request,
}) => {
  test.skip(
    process.env.RUN_LIVE_PROVIDERS !== "1",
    "Explicit opt-in: consumes actual provider capacity.",
  );
  test.setTimeout(220000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Check the proof" })).toBeEnabled();
  await page
    .getByLabel("Agent completion message")
    .fill("Next.js is listed as a project dependency. All unit tests passed.");
  await page.getByText("Add requirements", { exact: false }).click();
  await page
    .getByLabel("Optional requirements · one per line")
    .fill("Next.js dependency is forbidden.");
  await page.getByText("Advanced options", { exact: false }).click();
  await page
    .getByLabel("Inspect a commit")
    .fill("0bb49508c85aa6a1eafbf13a9c1849ef8a14464c");
  await page.getByRole("button", { name: "Check the proof" }).click();
  await expect(
    page.getByText("Live server assessment", { exact: true }),
  ).toBeVisible({ timeout: 190000 });
  await expect(page.locator(".finding-SPEC-DRIFT")).toHaveCount(1);
  await expect(page.locator(".finding-UNVERIFIED")).toHaveCount(1);
  await expect(page.getByText("Review requirement · line 1")).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download JSON" }).click();
  const download = await downloadPromise;
  mkdirSync("artifacts/live-browser", { recursive: true });
  await download.saveAs("artifacts/live-browser/audit.json");
  const key = await (await request.get("/api/report-key")).json();
  writeFileSync(
    "artifacts/live-browser/trusted-key.json",
    JSON.stringify(key, null, 2),
  );
  const verification = execFileSync(
    process.execPath,
    [
      "scripts/verify-report.mjs",
      "artifacts/live-browser/audit.json",
      "artifacts/live-browser/trusted-key.json",
    ],
    { encoding: "utf8" },
  );
  expect(JSON.parse(verification).signatureVerified).toBe(true);
  await page.getByRole("tab", { name: /Requirements/ }).click();
  await expect(
    page.getByText("Next.js dependency is forbidden.", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "artifacts/live-browser/actual-provider-result.png",
    fullPage: true,
  });
  writeFileSync(
    "artifacts/live-browser/browser-observation.json",
    JSON.stringify(
      {
        scope:
          "Actual builder browser -> server -> GitHub/Gemini -> export -> independent Node signature verification. Review-specific prohibition is supplied by the builder; it is not the repository owner policy.",
        pageErrors: errors,
        result: JSON.parse(
          readFileSync("artifacts/live-browser/audit.json", "utf8"),
        ),
      },
      null,
      2,
    ),
  );
  expect(errors).toEqual([]);
});
