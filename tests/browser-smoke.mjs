import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { startTestServer } from "./helpers.js";

const server = await startTestServer(3490);
let browser;
try {
  browser = await chromium.launch({ channel: "msedge", headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    acceptDownloads: true,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await fs.mkdir("artifacts", { recursive: true });
  await page.goto(server.base);
  await page.getByRole("heading", { name: /Less friction/ }).waitFor();
  await page.screenshot({
    animations: "disabled",
    path: "artifacts/landing-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Start creating", exact: true })
    .click();
  await page.getByLabel("Your name").fill("Alex Morgan");
  await page.getByLabel("Email address").fill("alex@example.com");
  await page
    .getByLabel("Password", { exact: true })
    .fill("browser-test-password");
  await page.getByRole("button", { name: "Create your account" }).click();
  await page.getByRole("heading", { name: "Your whiteboards" }).waitFor();
  await page
    .getByRole("button", { name: "New whiteboard", exact: true })
    .click();
  await page.getByRole("button", { name: /Project brainstorm/ }).click();
  await page.getByText("All changes saved", { exact: true }).waitFor();
  const boardUrl = page.url();
  const initialCount = await page.locator("[data-element]").count();
  assert.ok(initialCount >= 10);
  await page.screenshot({
    animations: "disabled",
    path: "artifacts/board-desktop.png",
  });
  await page
    .getByRole("button", { name: "Switch to dark mode", exact: true })
    .click();
  assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
  const canvasColor = await page
    .locator(".infinite-canvas")
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  assert.equal(canvasColor, "rgb(19, 21, 27)");
  await page.screenshot({
    animations: "disabled",
    path: "artifacts/board-desktop-dark.png",
    animations: "disabled",
  });
  await page.reload();
  await page.getByText("All changes saved", { exact: true }).waitFor();
  assert.equal(
    await page.locator("html").getAttribute("data-theme"),
    "dark",
    "Theme preference persists after reload",
  );
  await page
    .getByRole("button", { name: "Switch to light mode", exact: true })
    .click();
  await page.getByRole("button", { name: "Sticky note", exact: true }).click();
  await page
    .locator(".infinite-canvas")
    .click({ position: { x: 950, y: 620 } });
  await page.locator("#element-text").fill("A tested, persistent idea.");
  await page.getByRole("button", { name: "Save thought" }).click();
  await page.getByText("All changes saved", { exact: true }).waitFor();
  assert.equal(await page.locator("[data-element]").count(), initialCount + 1);
  await page
    .getByRole("button", { name: "Undo (Ctrl+Z)", exact: true })
    .click();
  assert.equal(await page.locator("[data-element]").count(), initialCount + 1);
  await page
    .getByRole("button", { name: "Undo (Ctrl+Z)", exact: true })
    .click();
  assert.equal(await page.locator("[data-element]").count(), initialCount);
  await page
    .getByRole("button", { name: "Redo (Ctrl+Shift+Z)", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Redo (Ctrl+Shift+Z)", exact: true })
    .click();
  await page.getByRole("button", { name: "Chart", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill("Launch momentum");
  await page.getByRole("button", { name: "Save chart" }).click();
  await page.getByText("All changes saved", { exact: true }).waitFor();
  assert.equal(await page.locator("[data-element]").count(), initialCount + 2);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: /Export as PNG/ }).click();
  const download = await downloadEvent;
  await download.saveAs("artifacts/whiteboard-export.png");
  const png = await fs.readFile("artifacts/whiteboard-export.png");
  assert.equal(png.subarray(1, 4).toString(), "PNG");
  assert.ok(png.length > 1000);
  await page.reload();
  await page.getByText("All changes saved", { exact: true }).waitFor();
  assert.equal(await page.locator("[data-element]").count(), initialCount + 2);
  assert.ok(
    await page
      .locator("[data-element]")
      .filter({ hasText: /persistent idea\./ })
      .count(),
  );
  await page.getByRole("button", { name: "Rectangle", exact: true }).click();
  await page.mouse.move(1230, 150);
  await page.mouse.down();
  await page.mouse.move(1340, 250, { steps: 8 });
  await page.mouse.up();
  assert.equal(await page.locator("[data-element]").count(), initialCount + 3);
  const resize = page.locator('[data-handle="resize"]');
  const handle = await resize.boundingBox();
  await page.mouse.move(handle.x + 3, handle.y + 3);
  await page.mouse.down();
  await page.mouse.move(handle.x + 50, handle.y + 35, { steps: 5 });
  await page.mouse.up();
  await page.keyboard.press("Delete");
  assert.equal(await page.locator("[data-element]").count(), initialCount + 2);
  await page.getByRole("button", { name: "Pen", exact: true }).click();
  await page.mouse.move(1240, 150);
  await page.mouse.down();
  await page.mouse.move(1300, 180, { steps: 7 });
  await page.mouse.move(1340, 230, { steps: 7 });
  await page.mouse.up();
  assert.equal(await page.locator("[data-element]").count(), initialCount + 3);
  await page.getByRole("button", { name: "Eraser", exact: true }).click();
  await page.mouse.move(1250, 165);
  await page.mouse.down();
  await page.mouse.move(1300, 200, { steps: 4 });
  await page.mouse.up();
  assert.equal(await page.locator("[data-element]").count(), initialCount + 2);
  await page.getByRole("button", { name: "AI assistant", exact: true }).click();
  await page
    .getByPlaceholder(/What’s on your mind/)
    .fill("Ideas for our launch");
  await page.getByRole("button", { name: "Bring it to the canvas" }).click();
  await page.getByRole("alert").filter({ hasText: "GEMINI_API_KEY" }).waitFor();
  await page.getByRole("button", { name: "Close AI assistant" }).click();
  await page.getByRole("button", { name: "Share", exact: true }).click();
  await page.getByLabel("Collaborator email").fill("teammate@example.com");
  await page.getByRole("button", { name: "Invite", exact: true }).click();
  await page.getByText("teammate@example.com", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page
    .getByRole("button", { name: "Back to whiteboards", exact: true })
    .click();
  await page.getByRole("heading", { name: "Your whiteboards" }).waitFor();
  await page.screenshot({
    animations: "disabled",
    path: "artifacts/dashboard-desktop.png",
    fullPage: true,
  });
  await page.getByLabel("Search whiteboards").fill("no-such-whiteboard");
  await page
    .getByRole("heading", { name: "No matching whiteboards" })
    .waitFor();
  await page
    .getByRole("button", { name: "Clear search", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Recently opened", exact: true })
    .click();
  assert.equal(
    await page.locator(".board-card").count(),
    1,
    "Recently opened tracks board visits",
  );
  await page.getByRole("button", { name: /All whiteboards/ }).click();
  await page
    .getByRole("button", { name: "Switch to dark mode", exact: true })
    .click();
  await page.screenshot({
    animations: "disabled",
    path: "artifacts/dashboard-desktop-dark.png",
    fullPage: true,
    animations: "disabled",
  });
  assert.equal(
    await page
      .locator(".dashboard-sidebar .brand")
      .evaluate((el) => getComputedStyle(el).color),
    "rgb(238, 239, 245)",
    "Brand is readable in dark mode",
  );
  await page.setViewportSize({ width: 768, height: 1024 });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "No tablet overflow",
  );
  await page.screenshot({
    animations: "disabled",
    path: "artifacts/dashboard-tablet-dark.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    animations: "disabled",
    path: "artifacts/dashboard-mobile.png",
    fullPage: true,
  });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "Dashboard should not overflow on mobile",
  );
  await page.goto(boardUrl);
  await page
    .getByText("All changes saved", { exact: true })
    .waitFor({ state: "attached" });
  await page.screenshot({
    animations: "disabled",
    path: "artifacts/board-mobile.png",
  });
  await page.getByRole("button", { name: "AI assistant", exact: true }).click();
  await page.screenshot({
    animations: "disabled",
    path: "artifacts/board-mobile-dark-ai.png",
  });
  const ai = await page.locator(".ai-panel").boundingBox();
  assert.ok(
    ai.x >= 0 && ai.x + ai.width <= 390,
    "AI panel fits the mobile viewport",
  );
  await page.getByRole("button", { name: "Close AI assistant" }).click();
  await page.getByRole("button", { name: "Share", exact: true }).click();
  await page.getByLabel("Collaborator email").waitFor();
  await page.screenshot({
    animations: "disabled",
    path: "artifacts/share-mobile-dark.png",
  });
  await page.keyboard.press("Escape");
  assert.equal(
    await page.getByRole("dialog").count(),
    0,
    "Escape closes dialogs",
  );
  await page
    .getByRole("button", { name: "Switch to light mode", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Back to whiteboards", exact: true })
    .click();
  await page.getByRole("heading", { name: "Your whiteboards" }).waitFor();
  await page.screenshot({
    animations: "disabled",
    path: "artifacts/dashboard-mobile-light.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "New whiteboard", exact: true })
    .click();
  await page.keyboard.press("Tab");
  assert.ok(
    await page
      .getByRole("dialog")
      .evaluate((el) => el.contains(document.activeElement)),
    "Focus remains in dialog",
  );
  await page.keyboard.press("Escape");
  assert.equal(errors.length, 0, `Browser errors: ${errors.join("; ")}`);
  console.log(
    "Browser checks passed: registration, templates, canvas editing, undo/redo, charts, PNG export, reload persistence, sharing, AI configuration errors, desktop and mobile layouts.",
  );
} finally {
  await browser?.close();
  await server.stop();
}
