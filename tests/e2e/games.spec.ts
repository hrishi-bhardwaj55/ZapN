import { expect, test, type Page } from "@playwright/test";

async function openTutorial(page: Page, game: string) {
  await page.goto("/");
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
    await page.getByRole("button", { name: /Cash out/ }).click();
    await page.waitForTimeout(700);
  }
  await expect(page.getByText("ATTEMPT COMPLETE")).toBeVisible();
});

test("Skyscraper tutorial completes with an optimal legal sequence", async ({ page }) => {
  await openTutorial(page, "Skyscraper");
  for (const [from, to] of [[1,3],[1,2],[3,2],[1,3],[2,1],[2,3],[1,3]]) {
    await page.getByRole("button", { name: new RegExp(`Tower ${from},`) }).click();
    await page.getByRole("button", { name: new RegExp(`Tower ${to},`) }).click();
  }
  await expect(page.getByText("ATTEMPT COMPLETE")).toBeVisible();
});

test("Shapeshift tutorial accepts clickable inputs through results", async ({ page }) => {
  await openTutorial(page, "Shapeshift");
  for (let round = 0; round < 5; round += 1) { await page.getByRole("button", { name: "Left" }).click(); await page.waitForTimeout(750); }
  await expect(page.getByText("ATTEMPT COMPLETE")).toBeVisible();
});

test("Code Compare tutorial reaches results", async ({ page }) => {
  await openTutorial(page, "Code Compare");
  for (let round = 0; round < 4; round += 1) { await page.locator(".code-choices button").first().click(); await page.waitForTimeout(750); }
  await expect(page.getByText("ATTEMPT COMPLETE")).toBeVisible();
});

test("Pincode tutorial reaches results", async ({ page }) => {
  await openTutorial(page, "Pincode");
  for (let round = 0; round < 3; round += 1) {
    await page.waitForTimeout(2900);
    const emptySlots = await page.locator(".recall-display span").count();
    for (let digit = 0; digit < emptySlots; digit += 1) await page.getByRole("button", { name: "0", exact: true }).click();
    await page.getByRole("button", { name: "Enter" }).click();
    await page.waitForTimeout(1100);
  }
  await expect(page.getByText("ATTEMPT COMPLETE")).toBeVisible();
});

test("Number Box tutorial rejects invalid math safely and completes", async ({ page }) => {
  await openTutorial(page, "Number Box");
  for (let round = 0; round < 2; round += 1) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await page.getByLabel("Arithmetic expression").fill("1");
      await page.getByRole("button", { name: "Check expression" }).click();
    }
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
  await page.waitForTimeout(750);
  await expect(page.locator(".game-status-metrics")).toContainText("2 / 5");
  for (let round = 1; round < 5; round += 1) { await page.getByRole("button", { name: /No/ }).click(); await page.waitForTimeout(750); }
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
