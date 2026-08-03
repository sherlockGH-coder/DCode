/* global console */
import playwright from 'playwright-core';

const browser = await playwright.chromium.connectOverCDP('http://127.0.0.1:9222');
const ctx = browser.contexts()[0];
const page = ctx.pages()[0] || await ctx.newPage();
await page.waitForTimeout(1000);

await page.screenshot({path: '/tmp/ui-changes.png', fullPage: false});
console.log('Screenshot complete');

await browser.close();
