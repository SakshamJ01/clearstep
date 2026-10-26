import { expect, test } from "@playwright/test";

test("opens share card modal, switches themes, toggles privacy, and copies/downloads momentum card", async ({
  page,
}) => {
  // 1. Visit guest studio
  await page.goto("/try");

  // 2. Select preset and activate
  await page.getByRole("button", { name: "🧹 Clear my life admin" }).click();
  await page.locator("#guest-generate-btn").click();
  await page.locator("#guest-activate-btn").click();
  await expect(page.getByText("Active Plan · Guest Mode")).toBeVisible();

  // 3. Click Share Card button
  const shareBtn = page.locator("#guest-share-card-btn");
  await expect(shareBtn).toBeVisible();
  await shareBtn.click();

  // 4. Modal and live canvas preview should be visible
  await expect(page.getByRole("dialog", { name: /Share Momentum Card/i })).toBeVisible();
  const canvas = page.locator("#share-preview-canvas");
  await expect(canvas).toBeVisible();

  // 5. Test switching theme to Minimal Acid & Midnight Obsidian
  await page.getByRole("button", { name: "Minimal Acid" }).click();
  await page.getByRole("button", { name: "Midnight Obsidian" }).click();
  await page.getByRole("button", { name: "Deep Forest" }).click();

  // 6. Test toggling privacy mode checkbox
  const privacyToggle = page.locator("#hide-task-titles-toggle");
  await expect(privacyToggle).toBeVisible();
  await privacyToggle.check();
  expect(await privacyToggle.isChecked()).toBe(true);

  // 7. Click copy image button & verify feedback
  const copyBtn = page.locator("#copy-card-image-btn");
  await expect(copyBtn).toBeVisible();
  await copyBtn.click();
  await expect(page.getByRole("status")).toBeVisible();

  // 8. Test download PNG button
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#download-card-image-btn").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/clearstep-.*\.png/);

  // 9. Close modal via Escape key
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: /Share Momentum Card/i })).not.toBeVisible();
});
