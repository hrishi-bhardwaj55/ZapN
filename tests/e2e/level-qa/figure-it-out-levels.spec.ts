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

async function openFigurePractice(page: Page, level: 1 | 10) {
  await page.goto("/?debug=true");
  await page.waitForTimeout(900);
  await page.getByRole("button", { name: `L${level}`, exact: true }).click();
  await expect(page.getByRole("button", { name: `L${level}`, exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".level-picker", { hasText: `L${level} · ${level === 1 ? "Foundation" : "Extreme"}` }).first()).toBeVisible();

  const card = page.locator("article", { has: page.getByRole("heading", { name: "Figure It Out" }) });
  await card.getByRole("button", { name: "Practice" }).click();
  await expect(page.getByRole("heading", { name: "Figure It Out", level: 1 })).toBeVisible();
  await expect(page.locator(".level-picker", { hasText: `L${level} · ${level === 1 ? "Foundation" : "Extreme"}` }).last()).toBeVisible();
  await page.getByRole("button", { name: "Start practice" }).click();
  await expect(page.getByRole("region", { name: "Figure It Out game" })).toBeVisible();
}

async function visibleProfile(page: Page) {
  const color = page.getByRole("combobox", { name: "Color", exact: true });
  const shape = page.getByRole("combobox", { name: "Shape", exact: true });
  const pattern = page.getByRole("combobox", { name: "Pattern", exact: true });
  return {
    colors: await color.locator("option").count(),
    shapes: await shape.locator("option").count(),
    patterns: await pattern.locator("option").count(),
    candidates:
      (await color.locator("option").count()) *
      (await shape.locator("option").count()) *
      (await pattern.locator("option").count()),
  };
}

async function expectNoHorizontalClipping(page: Page) {
  const geometry = await page.evaluate(() => {
    const root = document.documentElement;
    const controls = Array.from(document.querySelectorAll<HTMLElement>("button, select"))
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

test("Figure It Out exposes materially harder L10 controls and records an L10 completion", async ({ page }) => {
  const errors = collectErrors(page);
  await page.setViewportSize({ width: 1440, height: 900 });

  await openFigurePractice(page, 1);
  const levelOne = await visibleProfile(page);
  await expect(page.locator(".game-status-metrics")).toContainText("1 / 8");
  expect(levelOne).toEqual({ colors: 2, shapes: 3, patterns: 2, candidates: 12 });

  await page.getByRole("button", { name: "← Exit attempt" }).click();
  await openFigurePractice(page, 10);
  const levelFive = await visibleProfile(page);
  await expect(page.locator(".game-status-metrics")).toContainText("1 / 4");
  expect(levelFive).toEqual({ colors: 4, shapes: 4, patterns: 5, candidates: 80 });
  expect(levelFive.candidates).toBeGreaterThan(levelOne.candidates);
  expect(levelFive.patterns).toBeGreaterThan(levelOne.patterns);

  const submit = page.getByRole("button", { name: "Submit guess" });
  await page.getByRole("button", { name: "Pause" }).click();
  await expect(submit).toBeDisabled();
  await expect(page.getByRole("combobox", { name: "Color", exact: true })).toBeDisabled();
  await expect(page.getByRole("combobox", { name: "Shape", exact: true })).toBeDisabled();
  await expect(page.getByRole("combobox", { name: "Pattern", exact: true })).toBeDisabled();
  await expect(page.locator(".game-status-metrics")).toContainText("1 / 4");
  await page.getByRole("button", { name: "Resume attempt" }).click();

  const targetText = await page.locator("code", { hasText: "debug ·" }).innerText();
  const target = targetText.replace("debug · ", "");
  const colors = await page.getByRole("combobox", { name: "Color", exact: true }).locator("option").allTextContents();
  const shapes = await page.getByRole("combobox", { name: "Shape", exact: true }).locator("option").allTextContents();
  const patterns = await page.getByRole("combobox", { name: "Pattern", exact: true }).locator("option").allTextContents();
  const wrongGuess = colors.flatMap((color) => shapes.flatMap((shape) => patterns.map((pattern) => ({ color, shape, pattern }))))
    .find(({ color, shape, pattern }) => `${color} ${shape} with ${pattern} pattern` !== target);
  expect(wrongGuess).toBeTruthy();
  await page.getByRole("combobox", { name: "Color", exact: true }).selectOption({ label: wrongGuess!.color });
  await page.getByRole("combobox", { name: "Shape", exact: true }).selectOption({ label: wrongGuess!.shape });
  await page.getByRole("combobox", { name: "Pattern", exact: true }).selectOption({ label: wrongGuess!.pattern });
  await expect(submit).toBeEnabled();

  for (let guess = 0; guess < 4; guess += 1) await submit.click();
  await expect(page.getByText("ATTEMPT COMPLETE")).toBeVisible({ timeout: 5_000 });
  await expect(page.locator(".result-hero")).toContainText("L10 Extreme");
  await expectNoHorizontalClipping(page);
  expect(errors).toEqual({ console: [], page: [] });
});

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
]) {
  test(`Figure It Out L10 controls fit ${viewport.width}x${viewport.height} without horizontal clipping`, async ({ page }) => {
    const errors = collectErrors(page);
    await page.setViewportSize(viewport);
    await openFigurePractice(page, 10);
    await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Submit guess" })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Color", exact: true })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Shape", exact: true })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Pattern", exact: true })).toBeVisible();
    await expectNoHorizontalClipping(page);
    expect(errors).toEqual({ console: [], page: [] });
  });
}
