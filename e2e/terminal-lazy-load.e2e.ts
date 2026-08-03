import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  createUserDataDir,
  launchElectronApp,
  removeUserDataDir,
  stopElectron,
} from './support/electron';

/**
 * Guardrail for the first-paint JavaScript budget.
 *
 * `file://` pages do not report resource timing, so whether chunks were loaded early cannot be measured at runtime.
 * Assert the build artifact directly instead: the entry HTML must not reference these heavy chunks.
 */
test('heavy vendor chunks stay off the first-paint critical path', () => {
  const html = readFileSync(resolve('out/renderer/index.html'), 'utf-8');

  expect(html).not.toContain('vendor-xterm');
  expect(html).not.toContain('vendor-icons');

  expect(html).toMatch(/<script[^>]+src="\.\/assets\/index-[^"]+\.js"/);
});

test('terminal panel mounts on first open and stays mounted after collapse', async () => {
  const userData = createUserDataDir('deepseek-terminal-lazy-e2e-');
  const { app, page } = await launchElectronApp(userData);

  try {
    await expect(page.locator('body')).toBeVisible();

    await expect(page.locator('.xterm')).toHaveCount(0);

    await page.getByRole('button', { name: 'Show terminal' }).click();
    await expect(page.locator('.xterm')).toHaveCount(1, { timeout: 20_000 });
    await expect(page.locator('.xterm')).toBeVisible();

    await page.getByRole('button', { name: 'Hide terminal' }).click();
    await expect(page.locator('.xterm')).toHaveCount(1);
  } finally {
    await stopElectron(app);
    removeUserDataDir(userData);
  }
});
