import { expect, test, type Page } from "@playwright/test";

type BrowserErrors = { console: string[]; page: string[] };

function collectErrors(page: Page): BrowserErrors {
  const errors: BrowserErrors = { console: [], page: [] };
  page.on("console", (message) => {
    if (message.type() === "error") errors.console.push(message.text());
  });
  page.on("pageerror", (error) => errors.page.push(error.message));
  return errors;
}

async function openStockMaster(page: Page, level: 1 | 10) {
  await page.goto("/?debug=true");
  await page.waitForTimeout(900);
  const levelButton = page.getByRole("button", { name: `L${level}`, exact: true });
  await levelButton.click();
  await expect(levelButton).toHaveAttribute("aria-pressed", "true");
  const card = page.locator("article", { has: page.getByRole("heading", { name: "Stock Master" }) });
  await card.getByRole("button", { name: "Practice" }).click();
  const levelPicker = page.locator(".level-picker", {
    hasText: `L${level} · ${level === 1 ? "Foundation" : "Extreme"}`,
  }).last();
  await expect(levelPicker).toBeVisible();
  const description = await levelPicker.locator("p").innerText();
  await page.getByRole("button", { name: "Start practice" }).click();
  await expect(page.getByRole("region", { name: "Stock Master game" })).toBeVisible();
  return description;
}

async function expectNoHorizontalClipping(page: Page) {
  const geometry = await page.evaluate(() => {
    const root = document.documentElement;
    const controls = Array.from(document.querySelectorAll<HTMLElement>("button, canvas"))
      .filter((element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
      })
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          label: element.getAttribute("aria-label") || element.textContent?.trim() || element.tagName,
          left: rect.left,
          right: rect.right,
        };
      });
    return {
      clientWidth: root.clientWidth,
      scrollWidth: root.scrollWidth,
      clipped: controls.filter((control) => control.left < -0.5 || control.right > window.innerWidth + 0.5),
    };
  });
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
  expect(geometry.clipped).toEqual([]);
}

test("Stock Master L10 increases divided-attention load while preserving stable controls and missed passes", async ({ page }) => {
  const errors = collectErrors(page);
  await page.setViewportSize({ width: 1440, height: 900 });

  const levelOneDescription = await openStockMaster(page, 1);
  expect(levelOneDescription).toContain("Two gauges");
  expect(levelOneDescription).toContain("wide target zones");
  expect(levelOneDescription).toContain("separated events");
  await expect(page.locator("canvas.gauge-canvas")).toHaveAttribute("aria-label", "2 animated timing gauges. Use number keys 1 through 2.");
  await expect(page.locator(".gauge-keys button")).toHaveCount(2);
  await expect(page.locator(".game-status-metrics")).toContainText("1 / 8");

  await page.getByRole("button", { name: "← Exit attempt" }).click();
  const levelFiveDescription = await openStockMaster(page, 10);
  expect(levelFiveDescription).toContain("Nine gauges");
  expect(levelFiveDescription).toContain("narrow zones");
  expect(levelFiveDescription).toContain("reversals");
  expect(levelFiveDescription).toContain("overlapping target events");
  await expect(page.locator("canvas.gauge-canvas")).toHaveAttribute("aria-label", "9 animated timing gauges. Use number keys 1 through 9.");
  await expect(page.locator(".gauge-keys button")).toHaveCount(9);
  await expect(page.locator(".game-status-metrics")).toContainText("1 / 15");
  for (let gauge = 1; gauge <= 9; gauge += 1) {
    await expect(page.getByRole("button", { name: `Gauge ${gauge}`, exact: false })).toContainText(String(gauge));
  }

  await page.getByRole("button", { name: "Gauge 1", exact: false }).click();
  await expect(page.locator(".feedback")).toContainText("Gauge 1");
  await page.keyboard.press("9");
  await expect(page.locator(".feedback")).toContainText("Gauge 9");

  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Game paused" })).toBeVisible();
  const statusWhilePaused = await page.locator(".game-status-metrics").innerText();
  await page.waitForTimeout(100);
  const pausedCanvasBefore = await page.locator("canvas.gauge-canvas").screenshot();
  await page.keyboard.press("1");
  await page.waitForTimeout(800);
  const pausedCanvasAfter = await page.locator("canvas.gauge-canvas").screenshot();
  expect(pausedCanvasAfter.equals(pausedCanvasBefore)).toBe(true);
  expect(await page.locator(".game-status-metrics").innerText()).toBe(statusWhilePaused);
  await page.getByRole("button", { name: "Resume attempt" }).click();

  await page.waitForFunction(
    () => document.querySelector(".feedback")?.textContent?.includes("MISSED TARGET PASS"),
    undefined,
    { timeout: 6_000, polling: "raf" },
  );
  await expect(page.locator(".feedback")).toContainText("MISSED TARGET PASS");

  for (let attempt = 0; attempt < 20; attempt += 1) await page.keyboard.press("1");
  await expect(page.getByText("ATTEMPT COMPLETE")).toBeVisible({ timeout: 5_000 });
  await expect(page.locator(".result-hero")).toContainText("L10 Extreme");
  const storedResult = await page.evaluate(() => {
    const history = JSON.parse(localStorage.getItem("cortex-history-v1") ?? "[]");
    return history.find((entry: { gameId: string }) => entry.gameId === "stock-master");
  });
  expect(storedResult).toMatchObject({
    gameId: "stock-master",
    level: 10,
    metrics: {
      gaugeCount: 9,
      targetZoneWidth: 24,
      initialMinVelocity: 55,
      initialMaxVelocity: 84,
      arrivalSpacingMs: 60,
      level: 10,
    },
  });
  expect(storedResult.metrics.missedTargetPasses).toBeGreaterThan(0);
  await expectNoHorizontalClipping(page);
  expect(errors).toEqual({ console: [], page: [] });
});

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
]) {
  test(`Stock Master L10 controls fit ${viewport.width}x${viewport.height} without clipping`, async ({ page }) => {
    const errors = collectErrors(page);
    await page.setViewportSize(viewport);
    await openStockMaster(page, 10);
    await expect(page.locator("canvas.gauge-canvas")).toBeVisible();
    await expect(page.locator(".gauge-keys button")).toHaveCount(9);
    await expect(page.getByRole("button", { name: "Gauge 1", exact: false })).toBeVisible();
    await expect(page.getByRole("button", { name: "Gauge 9", exact: false })).toBeVisible();
    await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
    await expectNoHorizontalClipping(page);
    expect(errors).toEqual({ console: [], page: [] });
  });
}
