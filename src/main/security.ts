import { shell, session, type BrowserWindow, type Session } from 'electron';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * 渲染层展示的是模型生成的 Markdown，其中的链接不可信。
 *
 * 此前主窗口既没有 `setWindowOpenHandler` 也没有 `will-navigate` 守卫：
 * 一个普通的 `<a href="https://…">` 就能把应用外壳整个导航走，
 * `target="_blank"` 则会打开一个没有地址栏、共享同一 session 的 Electron 窗口。
 * 这里把「导航」和「打开外链」彻底分开：应用窗口只允许停留在自己的页面上，
 * 其余一律交给系统浏览器。
 */

const EXTERNAL_SCHEMES = /^(https?|mailto):/i;

function rendererFileUrl(): string {
  return pathToFileURL(join(__dirname, '../renderer/index.html')).toString();
}

/** 去掉 query 与 hash，避免 `#/route` 这类前端路由被当成外部导航。 */
function stripFragment(url: string): string {
  const hash = url.indexOf('#');
  const query = url.indexOf('?');
  const cut = Math.min(hash === -1 ? url.length : hash, query === -1 ? url.length : query);
  return url.slice(0, cut);
}

export function isInternalUrl(url: string): boolean {
  const devUrl = process.env.ELECTRON_RENDERER_URL;
  if (devUrl && devUrl.trim() && url.startsWith(devUrl.trim())) return true;
  // 打包后只认渲染进程自己那一个 HTML，不放行任意 file://
  return stripFragment(url) === stripFragment(rendererFileUrl());
}

function openExternally(url: string): void {
  if (!EXTERNAL_SCHEMES.test(url)) return;
  shell.openExternal(url).catch((err: unknown) => {
    console.warn('[security] openExternal failed:', err instanceof Error ? err.message : String(err));
  });
}

/** 给窗口装上导航守卫。 */
export function bindNavigationGuards(win: BrowserWindow): void {
  // 所有 window.open / target=_blank 一律不在应用内开窗，转交系统浏览器
  win.webContents.setWindowOpenHandler(({ url }) => {
    openExternally(url);
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    if (isInternalUrl(url)) return;
    event.preventDefault();
    openExternally(url);
  });

  // 重定向同样要拦，否则 will-navigate 放行后仍可能被带走
  win.webContents.on('will-redirect', (event, url) => {
    if (isInternalUrl(url)) return;
    event.preventDefault();
  });

  // 未使用 <webview>，直接禁掉这条攻击面
  win.webContents.on('will-attach-webview', (event) => {
    event.preventDefault();
  });
}

/**
 * 渲染进程的 CSP。
 *
 * 开发模式下 Vite 的 HMR 与 React Refresh 需要 eval 和 websocket，
 * 打包后收紧。样式侧的 `unsafe-inline` 无法去掉：Tailwind 运行时与
 * 语法高亮组件都会注入内联 style。
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
    // HtmlPreview 用的是 srcdoc + sandbox="" 的 iframe
    "frame-src 'self' data: blob:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join('; ');
}

/**
 * 给会话挂上 CSP 响应头。
 *
 * `local-file:` 由 `protocol.handle` 接管，不经过 webRequest，
 * 所以这里只影响渲染进程自身的文档与资源请求。
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
