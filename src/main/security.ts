import { shell, session, type BrowserWindow, type Session } from 'electron';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * The renderer displays model-generated Markdown, so its links are untrusted.
 *
 * Previously the main window had neither a `setWindowOpenHandler` nor a `will-navigate` guard:
 * an ordinary `<a href="https://…">` could navigate the entire app shell,
 * while `target="_blank"` opened an Electron window without an address bar that shared the same session.
 * Keep navigation and opening external links separate: the app window may stay only on its own pages;
 * everything else is handed to the system browser.
 */

const EXTERNAL_SCHEMES = /^(https?|mailto):/i;

function rendererFileUrl(): string {
  return pathToFileURL(join(__dirname, '../renderer/index.html')).toString();
}

/** Remove query and hash so frontend routes such as `#/route` are not treated as external navigation. */
function stripFragment(url: string): string {
  const hash = url.indexOf('#');
  const query = url.indexOf('?');
  const cut = Math.min(hash === -1 ? url.length : hash, query === -1 ? url.length : query);
  return url.slice(0, cut);
}

export function isInternalUrl(url: string): boolean {
  const devUrl = process.env.ELECTRON_RENDERER_URL;
  if (devUrl && devUrl.trim() && url.startsWith(devUrl.trim())) return true;
  // In packaged builds, allow only the renderer's own HTML, not arbitrary file:// URLs.
  return stripFragment(url) === stripFragment(rendererFileUrl());
}

function openExternally(url: string): void {
  if (!EXTERNAL_SCHEMES.test(url)) return;
  shell.openExternal(url).catch((err: unknown) => {
    console.warn('[security] openExternal failed:', err instanceof Error ? err.message : String(err));
  });
}

/** Install navigation guards on a window. */
export function bindNavigationGuards(win: BrowserWindow): void {
  // Never open window.open or target=_blank inside the app; hand them to the system browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    openExternally(url);
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    if (isInternalUrl(url)) return;
    event.preventDefault();
    openExternally(url);
  });

  // Block redirects too, or will-navigate could still let the window be taken elsewhere.
  win.webContents.on('will-redirect', (event, url) => {
    if (isInternalUrl(url)) return;
    event.preventDefault();
  });

  // No <webview> is used, so disable this attack surface.
  win.webContents.on('will-attach-webview', (event) => {
    event.preventDefault();
  });
}

/**
 * Content Security Policy for the renderer.
 *
 * In development, Vite HMR and React Refresh need eval and websockets; tighten the policy in packaged builds.
 * The style-side `unsafe-inline` cannot be removed because Tailwind runtime and syntax-highlighting components inject inline styles.
 */
function buildCsp(isDev: boolean): string {
  const devUrl = (process.env.ELECTRON_RENDERER_URL || '').trim();
  const devOrigin = devUrl ? devUrl.replace(/\/$/, '') : '';
  const devWs = devOrigin.replace(/^http/, 'ws');

  const scriptSrc = isDev ? "'self' 'unsafe-inline' 'unsafe-eval'" : "'self'";
  const connectSrc = isDev
    ? `'self' local-file: data: blob: ${devOrigin} ${devWs}`.trim()
    : "'self' local-file: data: blob:";

  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: local-file:",
    "font-src 'self' data: local-file:",
    "media-src 'self' data: blob: local-file:",
    `connect-src ${connectSrc}`,
    // HtmlPreview uses an iframe with srcdoc and sandbox="".
    "frame-src 'self' data: blob:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join('; ');
}

/**
 * Attach CSP response headers to the session.
 *
 * `local-file:` is handled by `protocol.handle` and does not pass through webRequest,
 * so this affects only the renderer's own document and resource requests.
 */
export function applyContentSecurityPolicy(targetSession: Session = session.defaultSession): void {
  const isDev = Boolean((process.env.ELECTRON_RENDERER_URL || '').trim());
  const csp = buildCsp(isDev);

  targetSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp],
      },
    });
  });
}
