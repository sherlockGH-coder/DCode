import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test';
import { existsSync, mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
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

async function captureVisualQa(page: Awaited<ReturnType<ElectronApplication['firstWindow']>>, name: string): Promise<void> {
  const directory = process.env.DCODE_VISUAL_QA_DIR;
  if (!directory) return;
  mkdirSync(directory, { recursive: true });
  await page.waitForTimeout(200);
  await page.screenshot({ path: join(directory, `${name}.png`), fullPage: true });
}

test('full access requires confirmation before it is persisted', async () => {
  const userData = mkdtempSync(join(tmpdir(), 'deepseek-permissions-e2e-'));
  const settingsPath = join(userData, 'settings.json');
  const app = await electron.launch({
    args: [resolve('out/main/index.js')],
    env: { ...process.env, DEEPSEEK_E2E_USER_DATA_DIR: userData },
  });

  try {
    const page = await app.firstWindow();
    await page.waitForLoadState('domcontentloaded');

    await page.getByRole('button', { name: '系统设置' }).click();
    await page.getByRole('button', { name: '权限控制' }).click();

    const policyGroup = page.getByRole('radiogroup', { name: '工具审批策略' });
    await expect(policyGroup.getByRole('radio')).toHaveCount(3);
    const defaultPolicy = policyGroup.getByRole('radio', { name: /默认审批/ });
    const fullAccess = policyGroup.getByRole('radio', { name: /完全访问/ });
    await expect(defaultPolicy).toHaveAttribute('aria-checked', 'true');
    await captureVisualQa(page, 'permissions-default');

    await fullAccess.click();
    const dialog = page.getByRole('dialog', { name: '启用完全访问模式？' });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('svg')).toHaveCount(0);
    await captureVisualQa(page, 'permissions-full-access-confirm');
    await dialog.getByRole('button', { name: '取消' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(defaultPolicy).toHaveAttribute('aria-checked', 'true');

    await fullAccess.click();
    await page.getByRole('dialog', { name: '启用完全访问模式？' })
      .getByRole('button', { name: '启用完全访问' })
      .click();

    await expect(page.getByRole('dialog', { name: '启用完全访问模式？' })).toHaveCount(0);
    await expect(fullAccess).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByText('完全访问已启用')).toBeVisible();
    await expect(page.getByText('高风险')).toBeVisible();
    await captureVisualQa(page, 'permissions-full-access-active');
    await expect.poll(() => {
      if (!existsSync(settingsPath)) return undefined;
      const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as {
        permissions?: { bashExec?: string };
      };
      return settings.permissions?.bashExec;
    }).toBe('full_access');
  } finally {
    await stopElectron(app);
  }
});
