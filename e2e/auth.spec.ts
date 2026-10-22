import { expect, test, type Page } from "@playwright/test";
import { signUp } from "./helpers";

const STORAGE_PREFIX = "clearstep:composer:v1:";

function hasLocalDraft(page: Page): Promise<boolean> {
  return page.evaluate(
    (prefix) =>
      Object.keys(window.localStorage).some((key) => key.startsWith(prefix)),
    STORAGE_PREFIX,
  );
}

test("signs up and clears the local composer draft on request and sign-out", async ({
  page,
}) => {
  await signUp(page, "auth");

  const dump = page.getByLabel(/What.s taking up space\?/);
  await dump.fill("A private thought that should not stay on a shared device.");
  await expect(page.getByText("Saved on this device")).toBeVisible();
  await expect.poll(() => hasLocalDraft(page)).toBe(true);

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Clear from device" }).click();

  await expect(dump).toHaveValue("");
  await expect(page.getByText("Local draft cleared")).toBeVisible();
  await expect.poll(() => hasLocalDraft(page)).toBe(false);

  await dump.fill("Another private thought saved before signing out.");
  await expect(page.getByText("Saved on this device")).toBeVisible();
  await expect.poll(() => hasLocalDraft(page)).toBe(true);

  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL((url) => url.pathname === "/");
  await expect.poll(() => hasLocalDraft(page)).toBe(false);
});
