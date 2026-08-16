import { expect, test, type Page } from "@playwright/test";

test.setTimeout(90_000);

type Prompt = {
  task: "NUMBER" | "ARROWS";
  answer: boolean;
  sequenceLength: number | null;
};

async function openSwitch(page: Page, level: 1 | 5) {
  await page.goto("/?debug=true");
  await page.waitForTimeout(900);
  await page.getByRole("button", { name: `L${level}`, exact: true }).click();
  const card = page.locator("article", {
    has: page.getByRole("heading", { name: "The Switch" }),
  });
  await card.getByRole("button", { name: "Practice" }).click();
  await expect(page.locator(".level-picker").last()).toContainText(`L${level}`);
  await page.getByRole("button", { name: "Start practice" }).click();
  await expect(page.getByRole("region", { name: "The Switch game" })).toBeVisible();
}

async function readPrompt(page: Page): Promise<Prompt> {
  const board = page.locator(".position-switch-board");
  const label = await board.getAttribute("aria-label");
  const card = board.locator(".switch-prompt-card");
  await expect(card).toBeVisible();
  if (label === "Prompt in top region") {
    const equation = await card.locator("strong").innerText();
    const match = equation.match(/(\d+) \+ (\d+) = (\d+)/);
    expect(match).toBeTruthy();
    const left = Number(match?.[1]);
    const right = Number(match?.[2]);
    const displayedResult = Number(match?.[3]);
    expect(displayedResult).toBe(left + right);
    const asksOdd = (await card.locator("p").innerText()).includes("ODD");
    const odd = displayedResult % 2 !== 0;
    return { task: "NUMBER", answer: asksOdd ? odd : !odd, sequenceLength: null };
  }
  expect(label).toBe("Prompt in bottom region");
  const rows = await card.locator("strong").allTextContents();
  expect(rows).toHaveLength(2);
  const top = rows[0].trim().split(/\s+/);
  const bottom = rows[1].trim().split(/\s+/);
  return {
    task: "ARROWS",
    answer: top.length === bottom.length && top.every((arrow, index) => arrow === bottom[index]),
    sequenceLength: top.length,
  };
}

async function currentRound(page: Page) {
  const text = await page.locator(".game-status-metrics strong").first().innerText();
  return Number(text.match(/^(\d+) \/ /)?.[1]);
}

async function expectNoHorizontalOrLabelClipping(page: Page) {
  const geometry = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    boxes: [...document.querySelectorAll(".game-shell, .position-switch-board, .switch-prompt-card, .yes-no button")]
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

async function submitAndCheck(page: Page, prompt: Prompt, response: boolean, action: () => Promise<void>) {
  await action();
  const status = page.getByRole("status");
  await expect(status).toBeVisible();
  if (response === prompt.answer) await expect(status).toContainText(/Switch|Repeat/);
  else await expect(status).toContainText(`Correct answer: ${prompt.answer ? "YES" : "NO"}`);
}

function switchCount(tasks: Array<Prompt["task"]>) {
  return tasks.slice(1).filter((task, index) => task !== tasks[index]).length;
}

test("The Switch L1/L5 profiles, prompts, controls, guards, pause, layout, and metrics", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  await page.setViewportSize({ width: 1440, height: 900 });
  await openSwitch(page, 1);
  await expect(page.locator(".game-status-metrics")).toContainText("1 / 10");
  await expect(page.getByRole("button", { name: /No/ })).toContainText("F / ←");
  await expect(page.getByRole("button", { name: /Yes/ })).toContainText("J / →");
  await expectNoHorizontalOrLabelClipping(page);

  const level1Prompts: Prompt[] = [await readPrompt(page)];
  const level1TimeoutStartedAt = Date.now();
  await expect.poll(() => currentRound(page), { timeout: 4_500 }).toBe(2);
  const level1TimeoutMs = Date.now() - level1TimeoutStartedAt;
  expect(level1TimeoutMs).toBeGreaterThanOrEqual(2_900);
  // Polling observes the next round after the 240 ms feedback transition.
  expect(level1TimeoutMs).toBeLessThan(4_500);

  const actions: Array<{ response: boolean; run: () => Promise<void> }> = [
    { response: false, run: () => page.getByRole("button", { name: /No/ }).click() },
    { response: true, run: () => page.getByRole("button", { name: /Yes/ }).click() },
    { response: false, run: () => page.keyboard.press("f") },
    { response: true, run: () => page.keyboard.press("j") },
    { response: false, run: () => page.keyboard.press("ArrowLeft") },
    { response: true, run: () => page.keyboard.press("ArrowRight") },
  ];
  let doubleSubmitChecked = false;
  for (let trial = 1; trial < 10; trial += 1) {
    await expect(page.locator(".switch-prompt-card")).toBeVisible();
    const prompt = await readPrompt(page);
    level1Prompts.push(prompt);
    if (trial <= actions.length) {
      const action = actions[trial - 1];
      await submitAndCheck(page, prompt, action.response, action.run);
    } else if (!doubleSubmitChecked) {
      const before = await currentRound(page);
      await submitAndCheck(page, prompt, false, () => page.getByRole("button", { name: /No/ }).dblclick());
      await page.waitForTimeout(280);
      expect(await currentRound(page)).toBe(before + 1);
      doubleSubmitChecked = true;
      continue;
    } else {
      await submitAndCheck(page, prompt, prompt.answer, () => page.keyboard.press(prompt.answer ? "j" : "f"));
    }
    await page.waitForTimeout(280);
  }
  await expect(page.getByText("ATTEMPT COMPLETE")).toBeVisible();
  expect(level1Prompts.filter((prompt) => prompt.task === "ARROWS").every((prompt) => prompt.sequenceLength === 3)).toBe(true);
  expect(switchCount(level1Prompts.map((prompt) => prompt.task))).toBe(2);
  expect(doubleSubmitChecked).toBe(true);
  const level1Result = await page.evaluate(() => JSON.parse(localStorage.getItem("cortex-history-v1") ?? "[]")[0]);
  expect(level1Result.metrics.responseWindowMs).toBe(3000);
  expect(level1Result.metrics.sequenceLength).toBe(3);
  expect(level1Result.metrics.switchRateTarget).toBe(25);

  await page.getByRole("button", { name: "← Practice library" }).click();
  await page.getByRole("button", { name: "L5", exact: true }).click();
  const card = page.locator("article", {
    has: page.getByRole("heading", { name: "The Switch" }),
  });
  await card.getByRole("button", { name: "Practice" }).click();
  await expect(page.locator(".level-picker").last()).toContainText("L5 · Extreme");
  await page.getByRole("button", { name: "Start practice" }).click();
  await expect(page.locator(".game-status-metrics")).toContainText("1 / 18");
  await expectNoHorizontalOrLabelClipping(page);

  const level5Prompts: Prompt[] = [await readPrompt(page)];
  const pausedRound = await currentRound(page);
  await page.getByRole("button", { name: "Pause" }).click();
  await expect(page.getByRole("dialog", { name: "Game paused" })).toBeVisible();
  await page.getByRole("button", { name: /No/ }).click({ force: true });
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(1_350);
  expect(await currentRound(page)).toBe(pausedRound);
  await expect(page.getByRole("status")).toHaveCount(0);

  await page.getByRole("button", { name: "Resume attempt" }).click();
  const level5TimeoutStartedAt = Date.now();
  await expect.poll(() => currentRound(page), { timeout: 2_500 }).toBe(pausedRound + 1);
  const level5TimeoutMs = Date.now() - level5TimeoutStartedAt;
  expect(level5TimeoutMs).toBeGreaterThanOrEqual(1_100);
  expect(level5TimeoutMs).toBeLessThan(2_300);
  expect(level5TimeoutMs).toBeLessThan(level1TimeoutMs);

  await page.setViewportSize({ width: 1024, height: 768 });
  await page.waitForTimeout(280);
  await expectNoHorizontalOrLabelClipping(page);
  for (let trial = 1; trial < 18; trial += 1) {
    await expect(page.locator(".switch-prompt-card")).toBeVisible();
    const prompt = await readPrompt(page);
    level5Prompts.push(prompt);
    await submitAndCheck(page, prompt, prompt.answer, () => page.keyboard.press(prompt.answer ? "ArrowRight" : "ArrowLeft"));
    await page.waitForTimeout(280);
  }
  await expect(page.getByText("ATTEMPT COMPLETE")).toBeVisible();
  expect(level5Prompts.filter((prompt) => prompt.task === "ARROWS").every((prompt) => prompt.sequenceLength === 7)).toBe(true);
  expect(switchCount(level5Prompts.map((prompt) => prompt.task))).toBe(14);
  await expect(page.getByText(/L5 Extreme · medium · seeded run/)).toBeVisible();

  const level5Result = await page.evaluate(() => JSON.parse(localStorage.getItem("cortex-history-v1") ?? "[]")[0]);
  expect(level5Result.gameId).toBe("switch");
  expect(level5Result.level).toBe(5);
  expect(level5Result.totalRounds).toBe(18);
  expect(level5Result.metrics.sequenceLength).toBe(7);
  expect(level5Result.metrics.responseWindowMs).toBe(1150);
  expect(level5Result.metrics.switchRateTarget).toBe(85);
  expect(level5Result.metrics.actualSwitchRate).toBeCloseTo((14 / 17) * 100, 5);
  expect(Number.isFinite(level5Result.metrics.switchCostMs)).toBe(true);
  expect(Number.isFinite(level5Result.metrics.switchReactionTimeMs)).toBe(true);
  expect(Number.isFinite(level5Result.metrics.repeatReactionTimeMs)).toBe(true);
  expect(consoleErrors).toEqual([]);
});
