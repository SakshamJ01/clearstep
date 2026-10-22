import { expect, test } from "@playwright/test";
import { approveDraft, createManualDraft, signUp } from "./helpers";

test("builds a manual draft, approves it, and completes a task", async ({
  page,
}) => {
  await signUp(page, "plan");
  await createManualDraft(page);
  await approveDraft(page);

  await expect(page.getByText("Next action", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Mark done" }).first().click();

  await expect(page.getByText(/1 completed task/)).toBeVisible();
  await expect(page.getByText(/1 of \d+ tasks done/)).toBeVisible();
});
