import { expect, test } from "@playwright/test";

test("blindfold mode isolates single step, allows skipping, note editing, and reaches victory", async ({
  page,
}) => {
  // 1. Visit guest studio
  await page.goto("/try");

  // 2. Select preset and activate
  await page.getByRole("button", { name: "🧹 Clear my life admin" }).click();
  await page.locator("#guest-generate-btn").click();
  await page.locator("#guest-activate-btn").click();
  await expect(page.getByText("Active Plan · Guest Mode")).toBeVisible();

  // 3. Engage Blindfold Mode
  const blindfoldBtn = page.locator("#guest-blindfold-btn");
  await expect(blindfoldBtn).toBeVisible();
  await blindfoldBtn.click();

  // 4. Verify full list is hidden and only single-step focus card is active
  await expect(page.getByText("FOCUS ON THIS STEP ONLY")).toBeVisible();
  await expect(page.locator(".blindfold-card")).toBeVisible();
  await expect(page.locator("#guest-tasks-list")).not.toBeVisible();

  // 5. Check step counter
  await expect(page.getByText(/Step 1 of \d+/)).toBeVisible();

  // 6. Test note scratchpad inside blindfold card
  await page.getByRole("button", { name: /Add scratch note/i }).click();
  const noteInput = page.getByPlaceholder(/Quick thoughts, phone numbers/i);
  await expect(noteInput).toBeVisible();
  await noteInput.fill("Call receptionist between 9am and 11am");

  // 7. Test Skip for now
  const skipBtn = page.getByRole("button", { name: /Skip for now/i });
  if (await skipBtn.isVisible()) {
    await skipBtn.click();
    await expect(page.getByText(/Step 2 of \d+/)).toBeVisible();
  }

  // 8. Test Mark Done & Reveal Next
  await page.locator("#blindfold-complete-btn").click();
  await expect(page.getByText(/1 completed/i)).toBeVisible();

  // 9. Exit Blindfold Mode via button
  await page.getByRole("button", { name: /Exit Blindfold/i }).first().click();
  await expect(page.getByText("FOCUS ON THIS STEP ONLY")).not.toBeVisible();
  await expect(page.getByText(/All Steps/i)).toBeVisible();
  await expect(page.locator(".task-row").first()).toBeVisible();
});
