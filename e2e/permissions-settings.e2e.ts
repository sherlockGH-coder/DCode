import { expect, test } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  captureVisualQa,
  createUserDataDir,
  launchElectronApp,
  removeUserDataDir,
  stopElectron,
} from './support/electron';

test('full access requires confirmation before it is persisted', async () => {
  const userData = createUserDataDir('deepseek-permissions-e2e-');
  const settingsPath = join(userData, 'settings.json');
  const { app, page } = await launchElectronApp(userData);

  try {
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByRole('button', { name: 'Permissions' }).click();

    const policyGroup = page.getByRole('radiogroup', { name: 'Tool approval policy' });
    await expect(policyGroup.getByRole('radio')).toHaveCount(3);
    const defaultPolicy = policyGroup.getByRole('radio', { name: /Default approval/ });
    const fullAccess = policyGroup.getByRole('radio', { name: /Full access/ });
    await expect(defaultPolicy).toHaveAttribute('aria-checked', 'true');
    await captureVisualQa(page, 'permissions-default', 200);

    await fullAccess.click();
    const dialog = page.getByRole('dialog', { name: 'Enable full access mode?' });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('svg')).toHaveCount(0);
    await captureVisualQa(page, 'permissions-full-access-confirm', 200);
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(defaultPolicy).toHaveAttribute('aria-checked', 'true');

    await fullAccess.click();
    await page.getByRole('dialog', { name: 'Enable full access mode?' })
      .getByRole('button', { name: 'Enable full access' })
      .click();

    await expect(page.getByRole('dialog', { name: 'Enable full access mode?' })).toHaveCount(0);
    await expect(fullAccess).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByText('Full access is enabled')).toBeVisible();
    await expect(page.getByText('High risk')).toBeVisible();
    await captureVisualQa(page, 'permissions-full-access-active', 200);
    await expect.poll(() => {
      if (!existsSync(settingsPath)) return undefined;
      const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as {
        permissions?: { bashExec?: string };
      };
      return settings.permissions?.bashExec;
    }).toBe('full_access');
  } finally {
    await stopElectron(app);
    removeUserDataDir(userData);
  }
});
