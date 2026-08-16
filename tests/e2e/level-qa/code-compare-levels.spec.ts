import { expect, test, type Locator, type Page } from "@playwright/test";

test.setTimeout(60_000);

async function codeCompareCard(page: Page) {
  return page.locator("article", { has: page.getByRole("heading", { name: "Code Compare" }) });
}

async function assertNoHorizontalClipping(page: Page, controls: Locator[]) {
  const layout = await page.evaluate(() => ({
    bodyWidth: document.body.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    documentWidth: document.documentElement.scrollWidth,
  }));
  expect(layout.documentWidth).toBeLessThanOrEqual(layout.clientWidth);
  expect(layout.bodyWidth).toBeLessThanOrEqual(layout.clientWidth);
  for (const control of controls) {
    await expect(control).toBeVisible();
    const box = await control.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(0);
    expect(box!.height).toBeGreaterThan(0);
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(layout.clientWidth);
  }
}

test("Code Compare L1/L5 profiles, inputs, pause, and results", async ({ page }) => {
  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => browserErrors.push(`pageerror: ${error.message}`));
  await page.addInitScript(() => localStorage.clear());

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?debug=true");
  await page.waitForTimeout(900);
  await page.getByRole("button", { name: "L1", exact: true }).click();
  const firstCard = await codeCompareCard(page);
  await firstCard.getByRole("button", { name: "Practice" }).click();
  await expect(page.locator(".level-picker")).toContainText("L1 · Foundation");
  await expect(page.locator(".level-picker")).toContainText("Six digits, three choices, and a generous comparison window.");
  await page.getByRole("button", { name: "Start practice" }).click();

  const status = page.locator(".game-status-metrics");
  const choices = page.locator(".code-choices button");
  await expect(status).toContainText("1 / 6");
  await expect(status).toContainText("6 digits · 3000 ms");
  await expect(page.locator(".reference-code strong")).toHaveText(/^\d{6}$/);
  await expect(choices).toHaveCount(3);
  await assertNoHorizontalClipping(page, await choices.all());

  await page.keyboard.press("6");
  await page.waitForTimeout(100);
  await expect(status).toContainText("1 / 6");
  await expect(page.locator(".feedback")).toHaveCount(0);

  await page.getByRole("button", { name: "Pause" }).click();
  await expect(page.getByRole("dialog", { name: "Game paused" })).toBeVisible();
  await choices.first().click({ force: true });
  await page.keyboard.press("1");
  await page.waitForTimeout(3300);
  await expect(status).toContainText("1 / 6");
  await expect(page.locator(".feedback")).toHaveCount(0);
  await page.getByRole("button", { name: "Resume attempt" }).click();
  await choices.first().click();
  await expect(page.locator(".feedback")).toBeVisible();
  await expect(status).toContainText("2 / 6");

  await page.getByRole("button", { name: "← Exit attempt" }).click();
  await page.getByRole("button", { name: "← Back" }).click();
  await page.getByLabel("Timed where supported").uncheck();
  await page.getByRole("button", { name: "L5", exact: true }).click();
  const secondCard = await codeCompareCard(page);
  await secondCard.getByRole("button", { name: "Practice" }).click();
  await expect(page.locator(".level-picker")).toContainText("L5 · Extreme");
  await expect(page.locator(".level-picker")).toContainText("Fourteen digits, six choices, and the shortest response window.");
  await page.getByRole("button", { name: "Start practice" }).click();

  await page.setViewportSize({ width: 1024, height: 768 });
  await expect(status).toContainText("1 / 14");
  await expect(status).toContainText("14 digits · 900 ms");
  await expect(page.locator(".reference-code strong")).toHaveText(/^\d{14}$/);
  await expect(choices).toHaveCount(6);
  await assertNoHorizontalClipping(page, await choices.all());

  for (let index = 0; index < 6; index += 1) {
    await expect(choices.nth(index)).toBeEnabled();
    await choices.nth(index).click();
    await page.waitForTimeout(350);
  }
  for (let key = 1; key <= 6; key += 1) {
    await page.keyboard.press(String(key));
    await page.waitForTimeout(350);
  }
  for (let remaining = 0; remaining < 2; remaining += 1) {
    await page.keyboard.press("1");
    await page.waitForTimeout(350);
  }

  await expect(page.getByText("ATTEMPT COMPLETE")).toBeVisible();
  await expect(page.locator(".result-hero")).toContainText("L5 Extreme");
  const savedResult = await page.evaluate(() => JSON.parse(localStorage.getItem("cortex-history-v1") ?? "[]")[0]);
  expect(savedResult.level).toBe(5);
  expect(savedResult.metrics).toMatchObject({ level: 5, codeLength: 14, choiceCount: 6, responseWindowMs: 900 });
  expect(savedResult.rounds.slice(0, 12).map((round: { response: string }) => round.response)).toEqual([
    "1", "2", "3", "4", "5", "6", "1", "2", "3", "4", "5", "6",
  ]);
  expect(browserErrors).toEqual([]);
});
