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

async function openDigit(page: Page, level: 1 | 10) {
  await page.goto("/?debug=true");
  await page.waitForTimeout(900);
  const timed = page.getByRole("checkbox", { name: "Timed where supported" });
  if (!(await timed.isChecked())) await timed.check();
  const levelButton = page.getByRole("button", { name: `L${level}`, exact: true });
  await levelButton.click();
  await expect(levelButton).toHaveAttribute("aria-pressed", "true");
  const card = page.locator("article", { has: page.getByRole("heading", { name: "Digit" }) });
  await card.getByRole("button", { name: "Practice" }).click();
  await expect(page.locator(".level-picker", {
    hasText: `L${level} · ${level === 1 ? "Foundation" : "Extreme"}`,
  }).last()).toBeVisible();
  await page.getByRole("button", { name: "Start practice" }).click();
  await expect(page.getByRole("region", { name: "Digit game" })).toBeVisible();
}

async function captureSequence(page: Page, span: number) {
  // Sample inside the page so the test runner cannot miss a 400 ms frame
  // between remote locator polls.
  return page.evaluate(async (expectedSpan) => {
    const digits: number[] = [];
    const observedAt: number[] = [];
    const startedAt = performance.now();
    while (performance.now() - startedAt < 8_000) {
      const display = document.querySelector<HTMLElement>(".digit-display");
      const label = display?.getAttribute("aria-label") ?? "";
      const match = label.match(/^Digit (\d+) of (\d+): (\d)$/);
      if (match && Number(match[2]) === expectedSpan) {
        const index = Number(match[1]) - 1;
        if (digits[index] === undefined) {
          digits[index] = Number(match[3]);
          observedAt[index] = performance.now();
        }
      }
      if (document.querySelector(".recall-display")) {
        return { digits, firstStepMs: observedAt[1] - observedAt[0] };
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    throw new Error("Digit presentation did not reach recall within 8 seconds");
  }, span);
}

async function waitForRound(page: Page, task: "REPEAT" | "REVERSE" | "SORT", span: number) {
  await expect(page.locator(".memory-task-label")).toHaveText(task, { timeout: 5_000 });
  await expect(page.locator(".digit-display")).toHaveAttribute(
    "aria-label",
    new RegExp(`^Digit 1 of ${span}:`),
    { timeout: 5_000 },
  );
  await expect(page.locator(".game-status-metrics")).toContainText(`Span ${span}`);
}

async function submitWithHardware(page: Page, expected: number[]) {
  const value = expected.join("");
  await page.keyboard.type(value.slice(0, -1));
  await page.keyboard.press(value.at(-1) === "9" ? "0" : "9");
  await page.keyboard.press("Backspace");
  await page.keyboard.press(value.at(-1)!);
  await page.keyboard.press("Enter");
}

async function submitWithKeypad(page: Page, expected: number[]) {
  for (const digit of expected) await page.getByRole("button", { name: String(digit), exact: true }).click();
  await page.getByRole("button", { name: "Enter", exact: true }).click();
}

async function submitWrong(page: Page, span: number) {
  for (let index = 0; index < span; index += 1) {
    await page.getByRole("button", { name: "0", exact: true }).click();
  }
  await page.getByRole("button", { name: "Enter", exact: true }).click();
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

async function waitForTransientText(page: Page, text: string, timeoutMs: number) {
  const observed = await page.evaluate(({ expectedText, timeout }) => new Promise<boolean>((resolve) => {
    const hasText = () => document.body.textContent?.includes(expectedText) ?? false;
    if (hasText()) return resolve(true);
    const observer = new MutationObserver(() => {
      if (!hasText()) return;
      observer.disconnect();
      window.clearTimeout(timer);
      resolve(true);
    });
    observer.observe(document.body, { childList: true, characterData: true, subtree: true });
    const timer = window.setTimeout(() => {
      observer.disconnect();
      resolve(false);
    }, timeout);
  }), { expectedText: text, timeout: timeoutMs });
  expect(observed).toBe(true);
}

test("Digit L10 is faster and longer while preserving phases, adaptive timing, and all input guards", async ({ page }) => {
  test.setTimeout(90_000);
  const errors = collectErrors(page);
  await page.setViewportSize({ width: 1440, height: 900 });

  await openDigit(page, 1);
  await expect(page.locator(".memory-task-label")).toHaveText("REPEAT");
  await expect(page.locator(".game-status-metrics")).toContainText("Span 4");
  await expect(page.locator(".game-status-metrics")).toContainText("1 / 3");
  const firstLabel = await page.locator(".digit-display").getAttribute("aria-label");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(page.getByRole("button", { name: "0", exact: true })).toBeDisabled();
  await page.waitForTimeout(1_200);
  expect(await page.locator(".digit-display").getAttribute("aria-label")).toBe(firstLabel);
  const levelOneCadenceStarted = Date.now();
  await page.getByRole("button", { name: "Resume attempt" }).click();
  await page.waitForFunction(
    (pausedLabel) => document.querySelector(".digit-display")?.getAttribute("aria-label") !== pausedLabel,
    firstLabel,
    { timeout: 5_000, polling: "raf" },
  );
  const levelOneCadenceMs = Date.now() - levelOneCadenceStarted;
  expect(levelOneCadenceMs).toBeGreaterThan(650);

  await page.getByRole("button", { name: "← Exit attempt" }).click();
  await openDigit(page, 10);
  await waitForRound(page, "REPEAT", 8);
  await expect(page.locator(".game-status-metrics")).toContainText("1 / 9");
  const repeatOne = await captureSequence(page, 8);
  expect(repeatOne.firstStepMs).toBeLessThan(700);
  expect(repeatOne.firstStepMs).toBeLessThan(levelOneCadenceMs);

  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(page.getByRole("button", { name: "0", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Enter", exact: true })).toBeDisabled();
  await page.waitForTimeout(1_000);
  await expect(page.locator(".recall-display")).toBeVisible();
  await page.getByRole("button", { name: "Resume attempt" }).click();
  await submitWithHardware(page, repeatOne.digits);

  await waitForRound(page, "REPEAT", 9);
  const repeatTwo = await captureSequence(page, 9);
  await submitWithKeypad(page, repeatTwo.digits);
  await waitForRound(page, "REPEAT", 10);
  await page.locator(".recall-display").waitFor({ state: "visible", timeout: 7_000 });
  await waitForTransientText(page, "Correct sequence:", 8_000);

  await waitForRound(page, "REVERSE", 8);
  const reverseOne = await captureSequence(page, 8);
  await submitWithHardware(page, [...reverseOne.digits].reverse());
  await waitForRound(page, "REVERSE", 9);
  await page.locator(".recall-display").waitFor({ state: "visible", timeout: 5_000 });
  await submitWrong(page, 9);
  await waitForRound(page, "REVERSE", 8);
  await page.locator(".recall-display").waitFor({ state: "visible", timeout: 5_000 });
  await submitWrong(page, 8);

  await waitForRound(page, "SORT", 8);
  const sortOne = await captureSequence(page, 8);
  await submitWithKeypad(page, [...sortOne.digits].sort((left, right) => left - right));
  await waitForRound(page, "SORT", 9);
  await page.locator(".recall-display").waitFor({ state: "visible", timeout: 5_000 });
  await submitWrong(page, 9);
  await waitForRound(page, "SORT", 8);
  await page.locator(".recall-display").waitFor({ state: "visible", timeout: 5_000 });
  await submitWrong(page, 8);

  await expect(page.getByText("ATTEMPT COMPLETE")).toBeVisible({ timeout: 5_000 });
  await expect(page.locator(".result-hero")).toContainText("L10 Extreme");
  await expect(page.locator(".metric-grid")).toContainText("REPEAT");
  await expect(page.locator(".metric-grid")).toContainText("REVERSE");
  await expect(page.locator(".metric-grid")).toContainText("SORT");
  await expectNoHorizontalClipping(page);
  expect(errors).toEqual({ console: [], page: [] });
});

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
]) {
  test(`Digit L10 controls fit ${viewport.width}x${viewport.height} without clipping`, async ({ page }) => {
    const errors = collectErrors(page);
    await page.setViewportSize(viewport);
    await openDigit(page, 10);
    await expect(page.locator(".digit-display")).toBeVisible();
    await expect(page.locator(".digit-display span")).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "0", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Enter", exact: true })).toBeVisible();
    await expectNoHorizontalClipping(page);
    expect(errors).toEqual({ console: [], page: [] });
  });
}
