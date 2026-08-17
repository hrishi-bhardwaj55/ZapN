import { expect, test, type Locator, type Page } from "@playwright/test";

async function balloonCard(page: Page) {
  return page.locator("article", { has: page.getByRole("heading", { name: "Balloon" }) });
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

test("Balloon levels expose real L1/L10 profiles and remain operable", async ({ page }) => {
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
  await expect(page.getByRole("button", { name: "L1", exact: true })).toHaveAttribute("aria-pressed", "true");
  const firstCard = await balloonCard(page);
  await firstCard.getByRole("button", { name: "Practice" }).click();
  await expect(page.locator(".level-picker")).toContainText("L1 · Foundation");
  await expect(page.locator(".level-picker")).toContainText("8 balloons with wider, easier-to-learn burst ranges.");
  await page.getByRole("button", { name: "Start practice" }).click();

  const status = page.locator(".game-status-metrics");
  const pump = page.getByRole("button", { name: /Pump/ });
  const collect = page.getByRole("button", { name: /Collect/ });
  const balloon = page.locator(".balloon-arena .balloon");
  await expect(status).toContainText("1 / 8");
  await expect(page.getByText("BALLOON CLASS")).toBeVisible();
  await expect(page.locator(".game-aside code")).toContainText("debug · breakpoint");
  await assertNoHorizontalClipping(page, [pump, collect]);

  const beforePause = await balloon.getAttribute("aria-label");
  await page.getByRole("button", { name: "Pause" }).click();
  await expect(page.getByRole("dialog", { name: "Game paused" })).toBeVisible();
  await pump.click({ force: true });
  await collect.click({ force: true });
  await page.keyboard.press("Space");
  await page.keyboard.press("Enter");
  await expect(balloon).toHaveAttribute("aria-label", beforePause!);
  await expect(status).toContainText("1 / 8");
  await page.getByRole("button", { name: "Resume attempt" }).click();

  await expect(pump).toBeEnabled();
  await pump.click();
  await expect(balloon).toHaveAttribute("aria-label", /1 pumps$/);
  await expect(collect).toBeEnabled();
  await collect.click();
  await expect(page.getByText(/BANKED/)).toBeVisible();
  await expect(status).toContainText("2 / 8");

  await page.getByRole("button", { name: "← Exit attempt" }).click();
  await page.getByRole("button", { name: "← Back" }).click();
  await page.getByRole("button", { name: "L10", exact: true }).click();
  await expect(page.getByRole("button", { name: "L10", exact: true })).toHaveAttribute("aria-pressed", "true");
  const secondCard = await balloonCard(page);
  await secondCard.getByRole("button", { name: "Practice" }).click();
  await expect(page.locator(".level-picker")).toContainText("L10 · Extreme");
  await expect(page.locator(".level-picker")).toContainText("20 balloons with maximum distribution overlap and adaptation demand.");
  await page.getByRole("button", { name: "Start practice" }).click();

  await page.setViewportSize({ width: 1024, height: 768 });
  await expect(status).toContainText("1 / 20");
  await assertNoHorizontalClipping(page, [pump, collect]);

  for (let completed = 0; completed < 20; completed += 1) {
    await pump.click();
    await expect(collect).toBeEnabled();
    await collect.click();
    if (completed < 19) await expect(status).toContainText(`${completed + 2} / 20`);
  }

  await expect(page.getByText("ATTEMPT COMPLETE")).toBeVisible();
  await expect(page.locator(".result-hero")).toContainText("L10 Extreme");
  expect(browserErrors).toEqual([]);
});
