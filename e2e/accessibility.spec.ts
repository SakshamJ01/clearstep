import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { approveDraft, createManualDraft, signUp } from "./helpers";

async function expectNoSeriousViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  const blocking = results.violations.filter(
    (violation) =>
      violation.impact === "serious" || violation.impact === "critical",
  );
  expect(
    blocking.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      help: violation.help,
      targets: violation.nodes.map((node) => node.target.join(" ")),
    })),
  ).toEqual([]);
}

test("landing page has no serious accessibility violations", async ({
  page,
}) => {
  await page.goto("/");
  await expectNoSeriousViolations(page);
});

test("signup page has no serious accessibility violations", async ({ page }) => {
  await page.goto("/signup");
  await expectNoSeriousViolations(page);
});

test("composer and draft review have no serious accessibility violations", async ({
  page,
}) => {
  await signUp(page, "a11y");
  await expectNoSeriousViolations(page);
  await createManualDraft(page);
  await expectNoSeriousViolations(page);
});

test("plan workspace has no serious accessibility violations", async ({
  page,
}) => {
  await signUp(page, "a11y-plan");
  await createManualDraft(page);
  await approveDraft(page);
  await expectNoSeriousViolations(page);
});
