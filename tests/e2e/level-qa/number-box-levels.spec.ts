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

async function openNumberBox(page: Page, level: 1 | 10) {
  await page.goto("/?debug=true");
  await page.waitForTimeout(900);
  const levelButton = page.getByRole("button", { name: `L${level}`, exact: true });
  await levelButton.click();
  await expect(levelButton).toHaveAttribute("aria-pressed", "true");

  const card = page.locator("article", { has: page.getByRole("heading", { name: "Number Box" }) });
  await card.getByRole("button", { name: "Practice" }).click();
  const levelPicker = page.locator(".level-picker", {
    hasText: `L${level} · ${level === 1 ? "Foundation" : "Extreme"}`,
  }).last();
  await expect(levelPicker).toBeVisible();
  const levelDescription = await levelPicker.locator("p").innerText();
  await page.getByRole("button", { name: "Start practice" }).click();
  await expect(page.getByRole("region", { name: "Number Box game" })).toBeVisible();
  return levelDescription;
}

async function visibleOperands(page: Page) {
  return page.getByRole("button", { name: /Use value/ }).evaluateAll((buttons) =>
    buttons.map((button) => Number(button.textContent?.trim())),
  );
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

test("Number Box L10 visibly tightens the profile and preserves the full clickable workflow", async ({ page }) => {
  const errors = collectErrors(page);
  await page.setViewportSize({ width: 1440, height: 900 });

  const levelOneDescription = await openNumberBox(page, 1);
  const levelOneOperands = await visibleOperands(page);
  expect(levelOneDescription).toContain("longer solve time");
  await expect(page.locator(".game-status-metrics")).toContainText("1 / 2");
  await expect(page.getByText("Any operations", { exact: true })).toBeVisible();
  expect(levelOneOperands).toHaveLength(4);
  expect(levelOneOperands.every((value) => value >= 1 && value <= 6)).toBe(true);

  await page.getByRole("button", { name: "← Exit attempt" }).click();
  const levelFiveDescription = await openNumberBox(page, 10);
  const levelFiveOperands = await visibleOperands(page);
  expect(levelFiveDescription).toContain("maximum pressure");
  await expect(page.locator(".game-status-metrics")).toContainText("1 / 6");
  await expect(page.getByText("Required: / and -", { exact: true })).toBeVisible();
  expect(levelFiveOperands).toHaveLength(4);
  expect(levelFiveOperands.every((value) => value >= 2 && value <= 13)).toBe(true);
  expect(Math.max(...levelFiveOperands)).toBeGreaterThan(Math.max(...levelOneOperands));
  const debugSolution = await page.locator("code", { hasText: "debug ·" }).innerText();
  expect(debugSolution).toContain("/");
  expect(debugSolution).toContain("-");

  const valueButtons = page.getByRole("button", { name: /Use value/ });
  const divide = page.getByRole("button", { name: "÷", exact: true });
  const subtract = page.getByRole("button", { name: "−", exact: true });
  const skip = page.getByRole("button", { name: "Skip", exact: true });
  await valueButtons.first().click();
  await expect(divide).toBeEnabled();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(valueButtons.first()).toBeDisabled();
  await expect(divide).toBeDisabled();
  await expect(subtract).toBeDisabled();
  await expect(skip).toBeDisabled();
  await expect(page.locator(".game-status-metrics")).toContainText("1 / 6");
  await page.getByRole("button", { name: "Resume attempt" }).click();

  await expect(divide).toBeEnabled();
  await divide.click();
  await valueButtons.nth(1).click();
  await expect(valueButtons).toHaveCount(3);
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Reset", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(valueButtons).toHaveCount(4);

  await valueButtons.first().click();
  await subtract.click();
  await valueButtons.nth(1).click();
  await expect(valueButtons).toHaveCount(3);
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(valueButtons).toHaveCount(4);

  await skip.click();
  for (let remaining = 0; remaining < 5; remaining += 1) {
    await expect(skip).toBeEnabled({ timeout: 3_000 });
    await skip.click();
  }
  await expect(page.getByText("ATTEMPT COMPLETE")).toBeVisible({ timeout: 5_000 });
  await expect(page.locator(".result-hero")).toContainText("L10 Extreme");
  await expectNoHorizontalClipping(page);
  expect(errors).toEqual({ console: [], page: [] });
});

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
]) {
  test(`Number Box L10 controls fit ${viewport.width}x${viewport.height} without clipping`, async ({ page }) => {
    const errors = collectErrors(page);
    await page.setViewportSize(viewport);
    await openNumberBox(page, 10);
    await expect(page.getByRole("button", { name: /Use value/ }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "÷", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Reset", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Skip", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Check 24", exact: true })).toBeVisible();
    await expectNoHorizontalClipping(page);
    expect(errors).toEqual({ console: [], page: [] });
  });
}
