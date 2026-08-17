import { expect, test, type Locator, type Page } from "@playwright/test";

type Condition = { shape: "circle" | "square"; position: "left" | "right"; incongruent: boolean };

async function openShapeshift(page: Page, level: 1 | 10) {
  await page.goto("/?debug=true");
  await page.waitForTimeout(900);
  await page.getByRole("button", { name: `L${level}`, exact: true }).click();
  const card = page.locator("article", {
    has: page.getByRole("heading", { name: "Shapeshift" }),
  });
  await card.getByRole("button", { name: "Practice" }).click();
  await expect(page.locator(".level-picker").last()).toContainText(`L${level}`);
  const startedAt = Date.now();
  await page.getByRole("button", { name: "Start practice" }).click();
  await expect(page.getByRole("region", { name: "Shapeshift game" })).toBeVisible();
  return startedAt;
}

async function readCondition(stimulus: Locator): Promise<Condition> {
  const label = await stimulus.getAttribute("aria-label");
  const match = label?.match(/(circle|square) on (left|right)/);
  expect(match).toBeTruthy();
  const shape = match?.[1] as Condition["shape"];
  const position = match?.[2] as Condition["position"];
  return {
    shape,
    position,
    incongruent: (shape === "circle" && position === "right") || (shape === "square" && position === "left"),
  };
}

async function expectNoHorizontalOrLabelClipping(page: Page) {
  const geometry = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    boxes: [...document.querySelectorAll(".game-shell, .direction-pad, .direction-pad button, .shape-map span")]
      .filter((element) => {
        const style = getComputedStyle(element);
        return style.display !== "none" && style.visibility !== "hidden";
      })
      .map((element) => {
        const html = element as HTMLElement;
        const rect = html.getBoundingClientRect();
        return {
          left: rect.left,
          right: rect.right,
          width: rect.width,
          clientWidth: html.clientWidth,
          scrollWidth: html.scrollWidth,
        };
      }),
  }));
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.innerWidth);
  expect(geometry.boxes.length).toBeGreaterThan(0);
  for (const box of geometry.boxes) {
    expect(box.width).toBeGreaterThan(0);
    expect(box.left).toBeGreaterThanOrEqual(-1);
    expect(box.right).toBeLessThanOrEqual(geometry.innerWidth + 1);
    expect(box.scrollWidth).toBeLessThanOrEqual(box.clientWidth + 1);
  }
}

async function currentRound(page: Page) {
  const text = await page.locator(".game-status-metrics strong").first().innerText();
  return Number(text.match(/^(\d+) \/ /)?.[1]);
}

async function correctButton(page: Page, condition: Condition) {
  return page.getByRole("button", {
    name: condition.shape === "circle" ? "Circle, left" : "Square, right",
  });
}

test("Shapeshift L1/L10 profiles, controls, guards, pause, layout, and result metadata", async ({ page }) => {
  test.setTimeout(120_000);
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  await page.setViewportSize({ width: 1440, height: 900 });
  const level1StartedAt = await openShapeshift(page, 1);
  await expect(page.locator(".game-status-metrics")).toContainText("1 / 8");
  await expect(page.getByRole("button", { name: "Circle, left" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Square, right" })).toBeEnabled();
  await expectNoHorizontalOrLabelClipping(page);

  const stimulus = page.locator(".shape-stimulus");
  await stimulus.waitFor({ state: "visible" });
  const level1PreparationMs = Date.now() - level1StartedAt;
  expect(level1PreparationMs).toBeGreaterThanOrEqual(800);
  const level1Conditions: Condition[] = [await readCondition(stimulus)];
  const level1TimeoutStartedAt = Date.now();
  await expect(page.getByRole("status")).toContainText("Timed out", { timeout: 3_500 });
  const level1TimeoutMs = Date.now() - level1TimeoutStartedAt;
  // The timer starts in the same render that exposes the stimulus; locator observation adds overhead.
  expect(level1TimeoutMs).toBeGreaterThanOrEqual(1_600);
  expect(level1TimeoutMs).toBeLessThan(2_800);
  await stimulus.waitFor({ state: "hidden" });

  let usedCircleButton = false;
  let usedSquareButton = false;
  let usedFJ = false;
  let usedArrow = false;
  let verifiedDoubleSubmit = false;
  for (let trial = 1; trial < 8; trial += 1) {
    await stimulus.waitFor({ state: "visible", timeout: 3_000 });
    const condition = await readCondition(stimulus);
    level1Conditions.push(condition);
    await page.waitForTimeout(140);
    if (!usedCircleButton && condition.shape === "circle") {
      await (await correctButton(page, condition)).click();
      usedCircleButton = true;
    } else if (!usedSquareButton && condition.shape === "square") {
      await (await correctButton(page, condition)).click();
      usedSquareButton = true;
    } else if (!usedFJ) {
      await page.keyboard.press(condition.shape === "circle" ? "f" : "j");
      usedFJ = true;
    } else if (!usedArrow) {
      await page.keyboard.press(condition.shape === "circle" ? "ArrowLeft" : "ArrowRight");
      usedArrow = true;
    } else if (!verifiedDoubleSubmit) {
      const before = await currentRound(page);
      await (await correctButton(page, condition)).dblclick();
      await stimulus.waitFor({ state: "hidden" });
      await page.waitForTimeout(350);
      expect(await currentRound(page)).toBe(before + 1);
      verifiedDoubleSubmit = true;
      continue;
    } else {
      await (await correctButton(page, condition)).click();
    }
    await stimulus.waitFor({ state: "hidden" });
  }
  await expect(page.getByText("ATTEMPT COMPLETE")).toBeVisible();
  expect(level1Conditions.filter((condition) => condition.incongruent)).toHaveLength(2);
  expect(usedCircleButton).toBe(true);
  expect(usedSquareButton).toBe(true);
  expect(usedFJ).toBe(true);
  expect(usedArrow).toBe(true);
  expect(verifiedDoubleSubmit).toBe(true);

  await page.getByRole("button", { name: "← Practice library" }).click();
  await page.getByRole("button", { name: "L10", exact: true }).click();
  const card = page.locator("article", {
    has: page.getByRole("heading", { name: "Shapeshift" }),
  });
  await card.getByRole("button", { name: "Practice" }).click();
  await expect(page.locator(".level-picker").last()).toContainText("L10 · Extreme");
  const level5StartedAt = Date.now();
  await page.getByRole("button", { name: "Start practice" }).click();
  await expect(page.locator(".game-status-metrics")).toContainText("1 / 20");
  await stimulus.waitFor({ state: "visible", timeout: 1_200 });
  const level5PreparationMs = Date.now() - level5StartedAt;
  // This includes the screen transition and locator observation; the direct
  // engine profile is asserted separately in the focused unit suite.
  expect(level5PreparationMs).toBeLessThan(1_600);
  expect(level5PreparationMs).toBeLessThan(level1PreparationMs);
  const level5Conditions: Condition[] = [await readCondition(stimulus)];
  await expectNoHorizontalOrLabelClipping(page);

  const pausedRound = await currentRound(page);
  await page.getByRole("button", { name: "Pause" }).click();
  await expect(page.getByRole("dialog", { name: "Game paused" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Circle, left" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Square, right" })).toBeDisabled();
  await page.getByRole("button", { name: "Circle, left" }).click({ force: true });
  await page.keyboard.press("j");
  await page.waitForTimeout(900);
  expect(await currentRound(page)).toBe(pausedRound);
  await expect(stimulus).toBeVisible();

  await page.getByRole("button", { name: "Resume attempt" }).click();
  const level5TimeoutStartedAt = Date.now();
  await expect(page.getByRole("status")).toContainText("Timed out", { timeout: 1_500 });
  const level5TimeoutMs = Date.now() - level5TimeoutStartedAt;
  expect(level5TimeoutMs).toBeGreaterThanOrEqual(550);
  expect(level5TimeoutMs).toBeLessThan(1_200);
  await stimulus.waitFor({ state: "hidden" });

  await page.setViewportSize({ width: 1024, height: 768 });
  await expectNoHorizontalOrLabelClipping(page);
  for (let trial = 1; trial < 20; trial += 1) {
    await stimulus.waitFor({ state: "visible", timeout: 1_500 });
    const condition = await readCondition(stimulus);
    level5Conditions.push(condition);
    await page.waitForTimeout(140);
    await page.keyboard.press(condition.shape === "circle" ? "f" : "j");
    await stimulus.waitFor({ state: "hidden" });
  }
  await expect(page.getByText("ATTEMPT COMPLETE")).toBeVisible();
  expect(level5Conditions.filter((condition) => condition.incongruent)).toHaveLength(15);
  await expect(page.getByText(/L10 Extreme · medium · seeded run/)).toBeVisible();
  expect(consoleErrors).toEqual([]);
});
