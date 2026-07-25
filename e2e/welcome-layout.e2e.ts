import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

async function stopElectron(app: ElectronApplication): Promise<void> {
  const closed = new Promise<void>((resolveClosed) => app.once('close', resolveClosed));
  await app.evaluate(({ app: electronApp, BrowserWindow }) => {
    for (const window of BrowserWindow.getAllWindows()) window.destroy();
    electronApp.quit();
  }).catch(() => undefined);
  await closed;
}

test('opens wider and renders compact welcome action icons and titles', async () => {
  const userData = mkdtempSync(join(tmpdir(), 'deepseek-welcome-layout-e2e-'));
  const app = await electron.launch({
    args: [resolve('out/main/index.js')],
    env: { ...process.env, DEEPSEEK_E2E_USER_DATA_DIR: userData },
  });

  try {
    const page = await app.firstWindow();
    await page.waitForLoadState('domcontentloaded');

    const bounds = await app.evaluate(({ BrowserWindow }) => (
      BrowserWindow.getAllWindows()[0]?.getBounds()
    ));
    expect(bounds).toMatchObject({ width: 1125, height: 800 });

    const cards = page.locator('.welcome-action-card');
    await expect(cards).toHaveCount(4);

    const welcomeWidths = await page.locator('.welcome-layout').evaluate((layout) => {
      const content = layout.querySelector<HTMLElement>('.welcome-content');
      const hero = layout.querySelector<HTMLElement>('.welcome-hero');
      const actions = layout.querySelector<HTMLElement>('.welcome-actions');
      const composer = layout.querySelector<HTMLElement>('.welcome-composer');
      if (!content || !hero || !actions || !composer) throw new Error('Welcome layout is incomplete');
      return {
        layout: layout.getBoundingClientRect().width,
        content: content.getBoundingClientRect().width,
        hero: hero.getBoundingClientRect().width,
        actions: actions.getBoundingClientRect().width,
        composer: composer.getBoundingClientRect().width,
      };
    });
    expect(welcomeWidths.hero).toBeCloseTo(welcomeWidths.content * 0.9, 1);
    expect(welcomeWidths.actions).toBeCloseTo(752 * 0.9, 1);
    expect(welcomeWidths.composer).toBeCloseTo(Math.min(750, welcomeWidths.layout * 0.9 - 28.8), 1);

    await expect(page.locator('.welcome-title-accent')).toHaveCSS('color', 'rgb(82, 101, 180)');

    const actionColors = await page.locator('.welcome-action-title').evaluateAll((titles) => (
      titles.map((title) => getComputedStyle(title).color)
    ));
    expect(actionColors).toEqual([
      'rgb(57, 121, 185)',
      'rgb(111, 104, 168)',
      'rgb(185, 110, 56)',
      'rgb(59, 138, 99)',
    ]);

    const iconSizes = await page.locator('.welcome-action-art .welcome-action-icon').evaluateAll((icons) => (
      icons.map((icon) => {
        const style = getComputedStyle(icon);
        return { width: style.width, height: style.height };
      })
    ));
    expect(iconSizes).toEqual(Array(4).fill({ width: '18px', height: '18px' }));

    const titleSizes = await page.locator('.welcome-action-title').evaluateAll((titles) => (
      titles.map((title) => getComputedStyle(title).fontSize)
    ));
    expect(titleSizes).toEqual(Array(4).fill('11px'));

    await expect(page.locator('.welcome-review-check')).toHaveCSS('width', '13px');
    await expect(page.locator('.welcome-review-check')).toHaveCSS('height', '13px');

    for (const label of ['附加选项', '语音输入']) {
      const button = page.getByRole('button', { name: label });
      await expect(button).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      await button.hover();
      await expect(button).toHaveCSS('background-color', 'rgba(117, 124, 143, 0.07)');
    }

    await app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0]?.setSize(1400, 800);
    });
    await expect.poll(() => page.locator('.welcome-composer').evaluate((composer) => (
      composer.getBoundingClientRect().width
    ))).toBe(750);
  } finally {
    await stopElectron(app);
  }
});
