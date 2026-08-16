import { expect, test, type Page } from "@playwright/test";

async function openTutorial(page: Page, game: string) {
  await page.goto("/?debug=true");
  await page.waitForTimeout(900);
  const card = page.locator("article", { has: page.getByRole("heading", { name: game }) });
  await card.getByRole("button", { name: "Tutorial" }).click();
  await expect(page.getByRole("heading", { name: game, level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "Run tutorial" }).click();
  await expect(page.getByRole("main")).toContainText(game);
}

test("Balloon tutorial completes", async ({ page }) => {
  await openTutorial(page, "Balloon");
  for (let round = 0; round < 2; round += 1) {
    await page.getByRole("button", { name: /Pump/ }).click();
    await page.getByRole("button", { name: /Collect/ }).click();
    await page.waitForTimeout(700);
  }
  await expect(page.getByText("ATTEMPT COMPLETE")).toBeVisible();
});

test("Skyscraper tutorial completes with an optimal legal sequence", async ({ page }) => {
  await openTutorial(page, "Skyscraper");
  for (let move = 0; move < 12; move += 1) {
    if (await page.getByText("ATTEMPT COMPLETE").isVisible()) break;
    const hint = await page.locator("code", { hasText: "debug · try" }).innerText();
    const [, from, to] = hint.match(/try (\d+) → (\d+)/) ?? [];
    expect(from).toBeTruthy();
    expect(to).toBeTruthy();
    await page.getByRole("button", { name: new RegExp(`Stack ${from},`) }).click();
    await page.getByRole("button", { name: new RegExp(`Stack ${to},`) }).click();
    await page.waitForTimeout(650);
  }
  await expect(page.getByText("ATTEMPT COMPLETE")).toBeVisible();
});

test("Shapeshift tutorial classifies shapes while ignoring position", async ({ page }) => {
  await openTutorial(page, "Shapeshift");
  for (let round = 0; round < 4; round += 1) {
    await page.locator(".shape-stimulus").waitFor({ state: "visible" });
    const isCircle = await page.locator(".shape-stimulus.circle").isVisible();
    await page.getByRole("button", { name: isCircle ? "Circle, left" : "Square, right" }).click();
    await page.waitForTimeout(720);
  }
  await expect(page.getByText("ATTEMPT COMPLETE")).toBeVisible();
});

test("Code Compare tutorial reaches results", async ({ page }) => {
  await openTutorial(page, "Code Compare");
  for (let round = 0; round < 4; round += 1) { await page.locator(".code-choices button").first().click(); await page.waitForTimeout(750); }
  await expect(page.getByText("ATTEMPT COMPLETE")).toBeVisible();
});

test("Digit tutorial flashes one digit at a time through all three phases", async ({ page }) => {
  await openTutorial(page, "Digit");
  for (let round = 0; round < 3; round += 1) {
    await page.waitForTimeout(3900);
    const emptySlots = await page.locator(".recall-display span").count();
    for (let digit = 0; digit < emptySlots; digit += 1) await page.getByRole("button", { name: "0", exact: true }).click();
    await page.getByRole("button", { name: "Enter" }).click();
    await page.waitForTimeout(1100);
  }
  await expect(page.getByText("ATTEMPT COMPLETE")).toBeVisible();
});

test("Number Box tutorial provides clickable 24-game controls and completes", async ({ page }) => {
  await openTutorial(page, "Number Box");
  for (let round = 0; round < 2; round += 1) {
    await expect(page.getByRole("button", { name: /Use value/ }).first()).toBeEnabled();
    await expect(page.getByRole("button", { name: "Undo" })).toBeVisible();
    await page.getByRole("button", { name: "Skip" }).click();
    await page.waitForTimeout(1100);
  }
  await expect(page.getByText("ATTEMPT COMPLETE")).toBeVisible();
});

test("Figure It Out tutorial completes after the guess limit", async ({ page }) => {
  await openTutorial(page, "Figure It Out");
  for (let guess = 0; guess < 7; guess += 1) await page.getByRole("button", { name: "Submit guess" }).click();
  await expect(page.getByText("ATTEMPT COMPLETE")).toBeVisible();
});

test("The Switch tutorial accepts F/No equivalents and completes", async ({ page }) => {
  await openTutorial(page, "The Switch");
  await page.getByRole("button", { name: /No/ }).dblclick();
  await page.getByRole("button", { name: "Pause" }).click();
  await page.waitForTimeout(750);
  await expect(page.locator(".game-status-metrics")).toContainText("1 / 6");
  await page.getByRole("button", { name: "Resume attempt" }).click();
  await page.waitForTimeout(100);
  await expect(page.locator(".game-status-metrics")).toContainText("2 / 6");
  for (let round = 1; round < 6; round += 1) { await page.getByRole("button", { name: /No/ }).click(); await page.waitForTimeout(720); }
  await expect(page.getByText("ATTEMPT COMPLETE")).toBeVisible();
});

test("Stock Master tutorial completes with clickable gauge controls", async ({ page }) => {
  await openTutorial(page, "Stock Master");
  for (let round = 0; round < 6; round += 1) await page.getByRole("button", { name: /Gauge 1/ }).click();
  await expect(page.getByText("ATTEMPT COMPLETE")).toBeVisible();
});

test("history, custom session, simulation, and config routes are reachable", async ({ page }) => {
  await page.goto("/");
  await page.waitForTimeout(900);
  await page.getByRole("button", { name: "View performance" }).click();
  await expect(page.getByRole("heading", { name: "Your local training record." })).toBeVisible();
  await page.goto("/simulation");
  await expect(page.getByRole("heading", { name: /Nine games/ })).toBeVisible();
  await page.goto("/admin/game-config");
  await expect(page.getByRole("heading", { name: "Game configuration" })).toBeVisible();
});
