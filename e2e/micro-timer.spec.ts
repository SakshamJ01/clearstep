import { expect, test } from "@playwright/test";

test("starts 5-minute micro-action sprint, pauses, switches presets, minimizes, and closes", async ({
  page,
}) => {
  // 1. Visit guest studio
  await page.goto("/try");

  // 2. Select preset and activate
  await page.getByRole("button", { name: "🧹 Clear my life admin" }).click();
  await page.locator("#guest-generate-btn").click();
  await page.locator("#guest-activate-btn").click();
  await expect(page.getByText("Active Plan · Guest Mode")).toBeVisible();

  // 3. Find and click 5-Min Sprint button on the hero action step
  const sprintBtn = page.locator("#guest-hero-sprint-btn");
  await expect(sprintBtn).toBeVisible();
  await sprintBtn.click();

  // 4. Verify floating sprint card appears
  const timerRegion = page.getByRole("region", { name: /5-Minute Micro-Action Timer/i });
  await expect(timerRegion).toBeVisible();
  const display = page.locator("#micro-sprint-display");
  await expect(display).toBeVisible();
  await expect(display).toHaveText(/0[45]:\d\d/);

  // 5. Test pause and resume
  const toggleBtn = page.locator("#micro-sprint-toggle-btn");
  await toggleBtn.click();
  await expect(page.getByText("Paused")).toBeVisible();
  await expect(toggleBtn).toContainText("Resume");

  await toggleBtn.click();
  await expect(toggleBtn).toContainText("Pause");

  // 6. Test preset switching
  await page.getByRole("button", { name: "10 min", exact: true }).click();
  await expect(display).toHaveText(/09:\d\d|10:00/);

  await page.getByRole("button", { name: "5 min", exact: true }).click();
  await expect(display).toHaveText(/04:\d\d|05:00/);

  // 7. Test Focus Soundscape selection (Brown Noise, Rain, Volume)
  const soundscapeContainer = page.locator("#micro-soundscapes-container");
  await expect(soundscapeContainer).toBeVisible();

  const brownBtn = page.locator("#soundscape-btn-brown");
  await expect(brownBtn).toBeVisible();
  await brownBtn.click();
  await expect(brownBtn).toHaveAttribute("aria-pressed", "true");
  await expect(soundscapeContainer.getByText("Active", { exact: true })).toBeVisible();

  const volumeSlider = page.locator("#soundscape-volume-slider");
  await expect(volumeSlider).toBeVisible();

  // Switch soundscape to Gentle Rain
  const rainBtn = page.locator("#soundscape-btn-rain");
  await rainBtn.click();
  await expect(rainBtn).toHaveAttribute("aria-pressed", "true");
  await expect(brownBtn).toHaveAttribute("aria-pressed", "false");

  // 8. Test minimizing to pill with active soundscape badge
  await page.getByRole("button", { name: "Minimize timer" }).click();
  const pill = page.locator(".micro-sprint-pill");
  await expect(pill).toBeVisible();
  await expect(pill.getByText("Rain")).toBeVisible();

  // 9. Restore from pill
  await pill.click();
  await expect(timerRegion).toBeVisible();

  // Turn soundscape off
  const offBtn = page.locator("#soundscape-btn-off");
  await offBtn.click();
  await expect(offBtn).toHaveAttribute("aria-pressed", "true");
  await expect(soundscapeContainer.getByText("Active", { exact: true })).not.toBeVisible();

  // 10. Close timer via Close button
  await page.getByRole("button", { name: "Close timer" }).first().click();
  await expect(timerRegion).not.toBeVisible();

  // 10. Test sprint button from inside Blindfold Mode
  await page.locator("#guest-blindfold-btn").click();
  await expect(page.getByText("FOCUS ON THIS STEP ONLY")).toBeVisible();

  const blindfoldSprintBtn = page.locator("#blindfold-sprint-btn");
  await expect(blindfoldSprintBtn).toBeVisible();
  await blindfoldSprintBtn.click();
  await expect(timerRegion).toBeVisible();
});
