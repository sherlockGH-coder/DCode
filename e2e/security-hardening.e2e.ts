import { expect, test } from '@playwright/test';
import {
  createUserDataDir,
  launchElectronApp,
  removeUserDataDir,
  stopElectron,
} from './support/electron';

test('renderer is hardened: CSP applied, external navigation blocked, window.open denied', async () => {
  const userData = createUserDataDir('deepseek-security-e2e-');
  const { app, page } = await launchElectronApp(userData);

  try {
    const startUrl = page.url();

    const csp = await app.evaluate(async ({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      return win.webContents.executeJavaScript(
        `fetch(location.href).then(r => r.headers.get('content-security-policy'))`,
      );
    });
    expect(csp).toBeTruthy();
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'self'");

    const inlineScriptBlocked = await page.evaluate(() => {
      (window as unknown as Record<string, unknown>).__cspProbe = false;
      const script = document.createElement('script');
      script.textContent = 'window.__cspProbe = true;';
      document.head.appendChild(script);
      script.remove();
      return (window as unknown as Record<string, unknown>).__cspProbe === false;
    });
    expect(inlineScriptBlocked).toBe(true);

    const windowCountBefore = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length);
    await page.evaluate(() => window.open('https://example.com', '_blank'));
    await page.waitForTimeout(500);
    const windowCountAfter = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length);
    expect(windowCountAfter).toBe(windowCountBefore);

    await expect(page.locator('body')).toBeVisible();

    // preventDefault keeps Playwright's navigation state machine waiting, so subsequent assertions
    // use the main-process webContents instead of page.
    await page.evaluate(() => {
      window.location.href = 'https://example.com';
    }).catch(() => undefined);
    await new Promise((r) => setTimeout(r, 1500));

    const finalUrl = await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0]?.webContents.getURL(),
    );
    expect(finalUrl).toBe(startUrl);

    const stillAlive = await app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      return Boolean(win) && !win.webContents.isDestroyed() && !win.webContents.isCrashed();
    });
    expect(stillAlive).toBe(true);
  } finally {
    await stopElectron(app);
    removeUserDataDir(userData);
  }
});
