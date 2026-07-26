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
 * 首屏 JS 预算的护栏。
 *
 * `file://` 页面不上报 resource timing，所以「有没有被提前加载」不能在运行时测，
 * 改为直接断言构建产物：入口 HTML 里不得引用这些重型 chunk。
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

    await page.getByRole('button', { name: '显示终端' }).click();
    await expect(page.locator('.xterm')).toHaveCount(1, { timeout: 20_000 });
    await expect(page.locator('.xterm')).toBeVisible();

    await page.getByRole('button', { name: '隐藏终端' }).click();
    await expect(page.locator('.xterm')).toHaveCount(1);
  } finally {
    await stopElectron(app);
    removeUserDataDir(userData);
  }
});
