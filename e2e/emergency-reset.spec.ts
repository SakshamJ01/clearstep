import { expect, test } from "@playwright/test";

test("navigates through emergency /reset studio from breathing to grounding to micro-sprint", async ({
  page,
}) => {
  // 1. Visit standalone /reset page
  await page.goto("/reset");

  // 2. Check title and breathing orb in Phase 1
  await expect(page.getByRole("heading", { name: "Breathe With Us." })).toBeVisible();
  const orb = page.locator(".breath-orb");
  await expect(orb).toBeVisible();
  await expect(page.locator(".breath-orb-counter")).toBeVisible();
  await expect(page.getByText(/Cycle \d of 4/i)).toBeVisible();

  // 3. Test Pause / Resume breathing
  const pauseBtn = page.getByRole("button", { name: /Pause breathing|Pause/i });
  await pauseBtn.click();
  await expect(orb).toHaveClass(/is-paused/);

  const resumeBtn = page.getByRole("button", { name: /Resume breathing|Resume/i });
  await resumeBtn.click();
  await expect(orb).not.toHaveClass(/is-paused/);

  // 4. Proceed to Phase 2: Cognitive Grounding
  const toGroundingBtn = page.locator("#proceed-to-grounding-btn");
  await expect(toGroundingBtn).toBeVisible();
  await toGroundingBtn.click();

  await expect(page.getByRole("heading", { name: "Drop the Mental Weight" })).toBeVisible();

  // Fill heaviest thought
  const thoughtInput = page.locator("#heaviest-thought-input");
  await thoughtInput.fill("I have three conflicting deadlines and my inbox is overflowing");

  // Click reality check
  await page.getByRole("button", { name: /No, I am physically safe right now/i }).click();
  await expect(page.locator(".reality-check-verdict")).toBeVisible();

  // 5. Proceed to Phase 3: Micro-Step Action Bridge
  const toActionBtn = page.locator("#proceed-to-action-btn");
  await expect(toActionBtn).toBeVisible();
  await toActionBtn.click();

  await expect(page.getByRole("heading", { name: "One Absurdly Small Action" })).toBeVisible();

  // Select an inspiration chip
  const waterChip = page.getByRole("button", { name: /Drink a cold glass of water/i });
  await waterChip.click();

  const microInput = page.locator("#micro-step-input");
  await expect(microInput).toHaveValue(/Drink a cold glass of water/i);

  // 6. Launch 5-minute sprint
  const launchSprintBtn = page.locator("#launch-sprint-btn");
  await launchSprintBtn.click();

  // Verifies timer launched with the task
  const timerRegion = page.getByRole("region", { name: /5-Minute Micro-Action Timer/i });
  await expect(timerRegion).toBeVisible();
  await expect(timerRegion.getByRole("heading", { name: /Drink a cold glass of water/i })).toBeVisible();
});

test("opens and dismisses overwhelm first-aid modal from guest studio", async ({
  page,
}) => {
  await page.goto("/try");

  const triggerBtn = page.locator("#guest-overwhelm-trigger-btn");
  await expect(triggerBtn).toBeVisible();
  await triggerBtn.click();

  // Modal dialog appears
  const modalBackdrop = page.locator(".modal-backdrop");
  await expect(modalBackdrop).toBeVisible();
  await expect(page.getByRole("heading", { name: "Breathe With Us." })).toBeVisible();

  // Press Escape to dismiss
  await page.keyboard.press("Escape");
  await expect(modalBackdrop).not.toBeVisible();
});
