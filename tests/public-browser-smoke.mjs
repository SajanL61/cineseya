import { chromium, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const baseURL = process.env.TEST_BASE_URL || 'http://localhost:4001';
const artifactDir = path.resolve('.artifacts');
await fs.mkdir(artifactDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
});
const context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const pageErrors = [];
const consoleErrors = [];
const imageWarnings = [];
const adRequests = [];
page.on('pageerror', (error) => pageErrors.push(error.message));
page.on('console', (message) => { const value=message.text(); if (message.type() === 'error') consoleErrors.push(value); if (/invalid "position"|Largest Contentful Paint/.test(value)) imageWarnings.push(value); });
page.on('request', (request) => { if (/googlesyndication|doubleclick|fundingchoicesmessages/i.test(request.url())) adRequests.push(request.url()); });

const routes = ['/', '/movies', '/tv', '/tv/open-cinema-sessions', '/tv/open-cinema-sessions/season-1/episode-1', '/subtitles', '/discover', '/genres', '/languages', '/about', '/contact', '/takedown', '/login', '/register'];
for (const route of routes) {
  const response = await page.goto(route, { waitUntil: 'networkidle' });
  expect(response?.status(), `${route} should respond successfully`).toBe(200);
  await expect(page.locator('main')).toBeVisible();
  await expect(page.locator('.site-footer')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${route} should not overflow`).toBe(true);
}

await page.goto('/');
await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
await expect(page.getByText('Ad preview — no live advertisement')).toHaveCount(2);
await page.locator('.search-trigger').click();
await page.waitForTimeout(300);
if (await page.locator('.search-overlay').count() === 0) throw new Error(`Search did not open: ${JSON.stringify({ pageErrors, consoleErrors })}`);
await expect(page.locator('.search-overlay')).toBeVisible();
await page.getByRole('combobox', { name: 'Search' }).fill('Sintel');
await expect(page.getByText('Sintel', { exact: true }).first()).toBeVisible();
await page.keyboard.press('Escape');
await page.screenshot({ path: path.join(artifactDir, 'home-desktop.png'), fullPage: true });

await page.goto('/movies/sintel-2010');
await expect(page.getByRole('heading', { level: 1, name: 'Sintel' })).toBeVisible();
await expect(page.getByRole('heading', { name: 'Subtitles' })).toBeVisible();
await expect(page.locator('.ad-placement')).toHaveCount(0);
const downloadButton = page.getByRole('button', { name: 'Download' }).first();
const downloadAvailable = await downloadButton.count() > 0;
if (downloadAvailable) {
  await downloadButton.click();
  const desktopDialog = page.getByRole('dialog', { name: 'Sintel' });
  await expect(desktopDialog).toBeVisible();
  await page.screenshot({ path: path.join(artifactDir, 'movie-desktop.png') });
  await page.getByRole('button', { name: 'Close download options' }).click();
} else {
  await expect(page.locator('.rights-notice').first()).toBeVisible();
  await page.screenshot({ path: path.join(artifactDir, 'movie-desktop.png') });
}

if (downloadAvailable) {
  await page.goto('/download/77a000000000000000000002');
  await expect(page.getByText('Secure delivery', { exact: true })).toBeVisible();
}

await page.goto('/admin');
await expect(page).toHaveURL(/\/login\?returnTo=%2Fadmin/);

const viewports = [360, 390, 430, 768, 1024, 1366, 1440, 1920];
for (const width of viewports) {
  await page.setViewportSize({ width, height: width < 700 ? 844 : 1000 });
  for (const route of ['/']) {
    const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
    expect(response?.status(), `${route} at ${width}px should respond`).toBe(200);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${route} at ${width}px should not overflow`).toBe(true);
    await expect(page.getByText('Ad preview — no live advertisement')).toHaveCount(2);
  }
  if (width < 700) await expect(page.locator('.mobile-bottom-nav')).toBeVisible();
  else await expect(page.locator('.mobile-bottom-nav')).toBeHidden();
}

await page.setViewportSize({ width: 390, height: 844 });
await page.goto('/', { waitUntil: 'networkidle' });
await page.screenshot({ path: path.join(artifactDir, 'home-mobile.png'), fullPage: true });
await page.goto('/movies/sintel-2010', { waitUntil: 'networkidle' });
if (downloadAvailable) {
  await page.getByRole('button', { name: 'Download' }).first().click();
  await expect(page.getByRole('dialog', { name: 'Sintel' })).toBeVisible();
  const mobileDialog = await page.locator('.download-dialog').boundingBox();
  expect(mobileDialog?.height).toBeGreaterThanOrEqual(840);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'mobile download dialog should not overflow').toBe(true);
  await page.screenshot({ path: path.join(artifactDir, 'download-mobile.png') });
} else await page.screenshot({ path: path.join(artifactDir, 'movie-mobile.png'), fullPage: true });

if (pageErrors.length) throw new Error(`Browser page errors: ${pageErrors.join(' | ')}`);
if (consoleErrors.length) throw new Error(`Browser console errors: ${consoleErrors.join(' | ')}`);
if (imageWarnings.length) throw new Error(`Image optimization warnings: ${imageWarnings.join(' | ')}`);
if (adRequests.length) throw new Error(`Mock mode made advertising requests: ${adRequests.join(' | ')}`);
const result = { routes: routes.length, viewports, adPreviewCount: 2, adRequests: 0, search: true, movieDetail: true, downloadAvailable, downloadDesktop: downloadAvailable, downloadMobile: downloadAvailable, preparationPage: downloadAvailable, tvDetail: true, episodeDetail: true, auth: true, adminProtection: true, overflow: false, consoleErrors: 0 };
await fs.writeFile(path.join(artifactDir, 'browser-result.json'), `${JSON.stringify(result, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
await Promise.race([browser.close(), new Promise((resolve) => setTimeout(resolve, 5000))]);
process.exit(0);
