import { expect, test } from "@playwright/test";

async function events(page) {
  return JSON.parse(await page.locator("#event-state").textContent());
}

async function resetEvents(page) {
  await page.locator("#reset-events").click();
  await expect
    .poll(() => events(page))
    .toEqual({
      activePanels: [],
      layoutCount: 0,
      removedPanels: [],
    });
}

async function waitForPanels(page) {
  await expect(page.getByRole("tab", { name: "panel-c" })).toBeVisible();
  await expect(page.locator("#content-panel-c")).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await waitForPanels(page);
  await resetEvents(page);
});

test("Trame panel labels target only their own switch", async ({ page }) => {
  const panelB = page.locator("#content-panel-b");
  const panelC = page.locator("#content-panel-c");

  await panelB.getByText("Toggle panel-b").click();
  await expect(panelB.locator('input[type="checkbox"]')).toBeChecked();
  await expect(panelC.locator('input[type="checkbox"]')).not.toBeChecked();

  await panelC.getByText("Toggle panel-c").click();
  await expect(panelC.locator('input[type="checkbox"]')).toBeChecked();
  await expect(panelB.locator('input[type="checkbox"]')).toBeChecked();
});

test("restore reuses mounted panels and emits one final active panel", async ({
  page,
}) => {
  await page.locator("#activate-panel-b").click();
  await expect
    .poll(() => events(page))
    .toMatchObject({
      activePanels: ["panel-b"],
    });
  await resetEvents(page);
  await page.locator("#activate-panel-c").click();
  await expect
    .poll(() => events(page))
    .toMatchObject({
      activePanels: ["panel-c"],
      layoutCount: 1,
    });

  await page.evaluate(() => {
    window.panelCInput = document.querySelector(
      '#content-panel-c input[type="checkbox"]',
    );
  });
  await resetEvents(page);
  await page.locator("#restore-layout").click();

  await expect
    .poll(() => events(page))
    .toMatchObject({ activePanels: ["panel-c"], removedPanels: [] });
  expect(
    await page.evaluate(
      () =>
        window.panelCInput ===
        document.querySelector('#content-panel-c input[type="checkbox"]'),
    ),
  ).toBe(true);
});

test("user and programmatic removals each emit exactly once", async ({
  page,
}) => {
  await resetEvents(page);
  await page
    .getByRole("tab", { name: "panel-c" })
    .locator(".dv-default-tab-action")
    .click();

  await expect
    .poll(() => events(page))
    .toMatchObject({ removedPanels: ["panel-c"] });

  await resetEvents(page);
  await page.locator("#remove-panel-b").click();
  await expect
    .poll(() => events(page))
    .toMatchObject({ removedPanels: ["panel-b"] });
});
