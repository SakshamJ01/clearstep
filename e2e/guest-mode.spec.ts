import { expect, test } from "@playwright/test";
import { PASSWORD, uniqueEmail } from "./helpers";

test("guest visitor creates instant plan, completes a step, and claims it on registration", async ({
  page,
}) => {
  // 1. Visit landing page
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Try without signup" })).toBeVisible();

  // 2. Click to open guest mode
  await page.getByRole("link", { name: "Try without signup" }).click();
  await page.waitForURL((url) => url.pathname === "/try");

  // 3. Select preset
  await page.getByRole("button", { name: "🧹 Clear my life admin" }).click();
  const dumpArea = page.getByLabel(/The Brain Dump/);
  await expect(dumpArea).not.toHaveValue("");

  // 4. Generate plan
  await page.locator("#guest-generate-btn").click();
  await expect(page.getByText("Step 2 of 2 · Review & Reorder")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  // 5. Activate plan into guest workspace
  await page.locator("#guest-activate-btn").click();
  await expect(page.getByText("Active Plan · Guest Mode")).toBeVisible();

  // 6. Complete the first step
  const firstCheckbox = page.locator(".checkbox-btn").first();
  await firstCheckbox.click();
  await expect(page.locator(".checkbox-btn.is-checked")).toHaveCount(1);

  // 7. Test persistence across reload
  await page.reload();
  await expect(page.getByText("Active Plan · Guest Mode")).toBeVisible();
  await expect(page.locator(".checkbox-btn.is-checked")).toHaveCount(1);

  // 8. Click Save this plan -> lands on /signup?claim=true
  await page.locator("#guest-save-account-btn").click();
  await page.waitForURL((url) => url.pathname === "/signup");
  await expect(page.getByText("Guest plan found:")).toBeVisible();

  // 9. Complete signup
  const email = uniqueEmail("guest");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel(/^Password/).fill(PASSWORD);
  await page.getByLabel("Confirm password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();

  // 10. Verifies redirected to the claimed plan in cloud
  await page.waitForURL((url) => url.pathname.startsWith("/plans/"), {
    timeout: 30_000,
  });
  await expect(
    page.getByRole("heading", { name: /overdue life admin sorted/i }),
  ).toBeVisible();
});
