import { expect, type Page } from "@playwright/test";

export const PASSWORD = "correct horse battery staple";

export const DUMP = `renew the passport before the trip
ask Sam about splitting the rent
book the train tickets before prices go up
call the dentist
clear the pile of post on the kitchen table`;

export function uniqueEmail(prefix = "e2e"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

export async function signUp(page: Page, prefix?: string): Promise<string> {
  const email = uniqueEmail(prefix);
  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel(/^Password/).fill(PASSWORD);
  await page.getByLabel("Confirm password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL((url) => url.pathname === "/compose");
  return email;
}

export async function createManualDraft(page: Page): Promise<void> {
  await page.getByLabel(/What.s taking up space\?/).fill(DUMP);
  await page.getByLabel("Desired outcome").fill("Clear the test admin");
  await page.getByRole("button", { name: "Build a manual draft" }).click();
  await page.waitForURL((url) => url.pathname.startsWith("/drafts/"), {
    timeout: 30_000,
  });
}

export async function approveDraft(page: Page): Promise<void> {
  const approve = page.getByRole("button", { name: "Approve plan" });
  await expect(approve).toBeEnabled();
  await approve.click();
  await page.waitForURL((url) => url.pathname.startsWith("/plans/"), {
    timeout: 30_000,
  });
}
