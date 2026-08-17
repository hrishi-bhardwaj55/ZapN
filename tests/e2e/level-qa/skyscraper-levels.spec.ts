import { expect, test, type Page } from "@playwright/test";

async function openSkyscraper(page: Page, level: 1 | 10) {
  await page.goto("/?debug=true");
  await page.waitForTimeout(900);
  await page.getByRole("button", { name: `L${level}`, exact: true }).click();
  const card = page.locator("article", {
    has: page.getByRole("heading", { name: "Skyscraper" }),
  });
  await card.getByRole("button", { name: "Practice" }).click();
  await expect(page.locator(".level-picker").last()).toContainText(`L${level}`);
  await page.getByRole("button", { name: "Start practice" }).click();
  await expect(page.getByRole("region", { name: "Skyscraper game" })).toBeVisible();
}

async function expectNoHorizontalClipping(page: Page) {
  const geometry = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    boxes: [...document.querySelectorAll(".game-shell, .tower-board, .tower-pad")]
      .filter((element) => {
        const style = getComputedStyle(element);
        return style.display !== "none" && style.visibility !== "hidden";
      })
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return { left: rect.left, right: rect.right, width: rect.width };
      }),
  }));
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.innerWidth);
  expect(geometry.boxes.length).toBeGreaterThan(0);
  for (const box of geometry.boxes) {
    expect(box.width).toBeGreaterThan(0);
    expect(box.left).toBeGreaterThanOrEqual(-1);
    expect(box.right).toBeLessThanOrEqual(geometry.innerWidth + 1);
  }
}

async function stackCounts(page: Page) {
  const labels = await page.locator(".tower-board .tower-pad").evaluateAll((buttons) =>
    buttons.map((button) => button.getAttribute("aria-label") ?? ""),
  );
  return labels.map((label) => Number(label.match(/, (\d+) blocks?/)?.[1] ?? -1));
}

test("Skyscraper level profiles, controls, pause, layout, and result metadata", async ({ page }) => {
  test.setTimeout(90_000);
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  await page.setViewportSize({ width: 1440, height: 900 });
  await openSkyscraper(page, 1);
  await expect(page.locator(".tower-board .tower-pad")).toHaveCount(3);
  await expect(page.locator(".tower-board .tower-disk")).toHaveCount(3);
  const level1Burden = Number(
    (await page.getByText(/optimal moves$/).innerText()).match(/(\d+) optimal moves/)?.[1],
  );
  expect(level1Burden).toBeGreaterThanOrEqual(2);
  await expectNoHorizontalClipping(page);

  await page.getByRole("button", { name: "← Exit attempt" }).click();
  await page.getByRole("button", { name: "L10", exact: true }).click();
  await expect(page.locator(".level-picker").last()).toContainText("L10 · Extreme");
  await page.getByRole("button", { name: "Start practice" }).click();

  const stackButtons = page.locator(".tower-board .tower-pad");
  await expect(stackButtons).toHaveCount(4);
  await expect(page.locator(".tower-board .tower-disk")).toHaveCount(7);
  const level5Burden = Number(
    (await page.getByText(/optimal moves$/).innerText()).match(/(\d+) optimal moves/)?.[1],
  );
  expect(level5Burden).toBeGreaterThanOrEqual(8);
  expect(level5Burden).toBeGreaterThan(level1Burden);
  await expectNoHorizontalClipping(page);

  for (let index = 0; index < 4; index += 1) {
    const stack = stackButtons.nth(index);
    await expect(stack).toBeEnabled();
    const label = await stack.getAttribute("aria-label");
    const blocks = Number(label?.match(/, (\d+) blocks?/)?.[1] ?? 0);
    await stack.click();
    if (blocks > 0) {
      await expect(stack).toHaveAttribute("aria-pressed", "true");
      await stack.click();
      await expect(stack).toHaveAttribute("aria-pressed", "false");
    } else {
      await expect(page.getByRole("status")).toContainText("stack is empty");
    }
  }

  const countsBeforePause = await stackCounts(page);
  const moveTextBeforePause = await page.getByText(/^\d+ moves$/).innerText();
  await page.getByRole("button", { name: "Pause" }).click();
  await expect(page.getByRole("dialog", { name: "Game paused" })).toBeVisible();
  const pauseSource = countsBeforePause.findIndex((count) => count > 0);
  await stackButtons.nth(pauseSource).click({ force: true });
  expect(await stackCounts(page)).toEqual(countsBeforePause);
  await expect(page.getByText(/^\d+ moves$/)).toHaveText(moveTextBeforePause);
  await expect(stackButtons.nth(pauseSource)).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "Resume attempt" }).click();

  let counts = await stackCounts(page);
  const destination = counts.indexOf(Math.max(...counts));
  while (counts[destination] < 3) {
    const source = counts.findIndex((count, index) => index !== destination && count > 0);
    expect(source).toBeGreaterThanOrEqual(0);
    await stackButtons.nth(source).click();
    await expect(stackButtons.nth(destination)).toHaveAttribute("aria-label", /legal destination/);
    await stackButtons.nth(destination).click();
    counts = await stackCounts(page);
  }

  const sourceForInvalid = counts.findIndex((count, index) => index !== destination && count > 0);
  expect(sourceForInvalid).toBeGreaterThanOrEqual(0);
  const labelsBeforeInvalid = await stackButtons.evaluateAll((buttons) =>
    buttons.map((button) => button.getAttribute("aria-label")),
  );
  const movesBeforeInvalid = await page.getByText(/^\d+ moves$/).innerText();
  await stackButtons.nth(sourceForInvalid).click();
  await expect(stackButtons.nth(destination)).not.toHaveAttribute("aria-label", /legal destination/);
  await stackButtons.nth(destination).click();
  await expect(page.getByRole("status")).toContainText("destination is full");
  expect(await stackButtons.evaluateAll((buttons) => buttons.map((button) => button.getAttribute("aria-label")))).toEqual(labelsBeforeInvalid);
  await expect(page.getByText(/^\d+ moves$/)).toHaveText(movesBeforeInvalid);

  await page.setViewportSize({ width: 1024, height: 768 });
  await expectNoHorizontalClipping(page);

  for (let move = 0; move < 60; move += 1) {
    if (await page.getByText("ATTEMPT COMPLETE").isVisible()) break;
    const hint = page.locator("code", { hasText: "debug · try" });
    if (!(await hint.count())) {
      await page.waitForTimeout(700);
      break;
    }
    const [, from, to] = (await hint.innerText()).match(/try (\d+) → (\d+)/) ?? [];
    expect(from).toBeTruthy();
    expect(to).toBeTruthy();
    await page.getByRole("button", { name: new RegExp(`Stack ${from},`) }).click();
    await page.getByRole("button", { name: new RegExp(`Stack ${to},`) }).click();
  }
  await expect(page.getByText("ATTEMPT COMPLETE")).toBeVisible();
  await expect(page.getByText(/L10 Extreme · medium · seeded run/)).toBeVisible();
  expect(consoleErrors).toEqual([]);
});
