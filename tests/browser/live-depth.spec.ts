import { test, expect } from "@playwright/test";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

test("actual claim review reaches pinned code, requirement conflict and independently verified export", async ({
  page,
  request,
}) => {
  test.skip(
    process.env.RUN_LIVE_PROVIDERS !== "1",
    "Explicit opt-in: uses actual provider capacity.",
  );
  test.setTimeout(210000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: /Check the proof/ }),
  ).toBeEnabled();
  await page
    .getByLabel("Agent completion message")
    .fill(
      "A createChalk function is defined. This package is MIT licensed. All tests passed.",
    );
  await page
    .getByLabel("GitHub repository")
    .fill("https://github.com/chalk/chalk");
  await page.locator("summary").filter({ hasText: "Add requirements" }).click();
  await page
    .getByLabel("Optional requirements · one per line")
    .fill("MIT licensing is forbidden.");
  await page.locator("summary").filter({ hasText: "Advanced options" }).click();
  await page
    .getByLabel("Inspect a commit")
    .fill("47fc05abd46171b235e24174cd2dba83d25bf037");
  await page.getByLabel(/Relevant files/).fill("source/index.js\npackage.json");
  await page.getByRole("button", { name: /Check the proof/ }).click();
  await Promise.race([
    page
      .getByText("Live server assessment", { exact: true })
      .waitFor({ timeout: 180000 }),
    page.locator(".error-message").waitFor({ timeout: 180000 }),
  ]);
  if (await page.locator(".error-message").isVisible()) {
    mkdirSync("artifacts/live-depth", { recursive: true });
    writeFileSync(
      "artifacts/live-depth/failure.json",
      JSON.stringify(
        {
          scope:
            "Actual browser attempt failed before a complete report; no successful audit or signature verification is inferred.",
          observedAt: new Date().toISOString(),
          error: await page.locator(".error-message").innerText(),
          pageErrors: errors,
        },
        null,
        2,
      ) + "\n",
    );
    throw new Error(await page.locator(".error-message").innerText());
  }
  await expect(
    page.getByText("Live server assessment", { exact: true }),
  ).toBeVisible({ timeout: 180000 });
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download JSON" }).click();
  mkdirSync("artifacts/live-depth", { recursive: true });
  await (await downloadEvent).saveAs("artifacts/live-depth/audit.json");
  const key = await (await request.get("/api/report-key")).json();
  writeFileSync(
    "artifacts/live-depth/trusted-key.json",
    JSON.stringify(key, null, 2),
  );
  const verified = JSON.parse(
    execFileSync(
      process.execPath,
      [
        "scripts/verify-report.mjs",
        "artifacts/live-depth/audit.json",
        "artifacts/live-depth/trusted-key.json",
      ],
      { encoding: "utf8" },
    ),
  );
  const audit = JSON.parse(
    readFileSync("artifacts/live-depth/audit.json", "utf8"),
  );
  const observation = {
    scope:
      "Actual builder browser -> server -> GitHub/Gemini -> export -> independent Node signature verification. The license prohibition is a supplied test requirement, not Chalk owner policy. This is not independent user testing.",
    observedAt: new Date().toISOString(),
    service: await (await request.get("/api/health")).json(),
    signatureVerified: verified.signatureVerified,
    pageErrors: errors,
    audit,
  };
  writeFileSync(
    "artifacts/live-depth/observation.json",
    JSON.stringify(observation, null, 2) + "\n",
  );
  expect(verified.signatureVerified).toBe(true);
  expect(audit.verifierVersion).toBe("2.1.0");
  expect(
    audit.verdicts.find((v) => v.claimText.startsWith("A createChalk")).verdict,
  ).toBe("TRUE");
  expect(audit.verdicts.find((v) => /\bMIT\b/.test(v.claimText)).verdict).toBe(
    "SPEC-DRIFT",
  );
  expect(
    audit.verdicts.find((v) => v.claimText.startsWith("All tests")).verdict,
  ).toBe("UNVERIFIED");
  await page.getByRole("tab", { name: /Requirements/ }).click();
  await expect(page.locator(".requirement")).toContainText("conflict");
  await page.getByRole("tab", { name: /Claims/ }).click();
  await page.screenshot({
    path: "artifacts/live-depth/results.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
