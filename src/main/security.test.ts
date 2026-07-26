import { afterEach, describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isInternalUrl } from './security';

const originalDevUrl = process.env.ELECTRON_RENDERER_URL;

afterEach(() => {
  if (originalDevUrl === undefined) delete process.env.ELECTRON_RENDERER_URL;
  else process.env.ELECTRON_RENDERER_URL = originalDevUrl;
});

/** 与 security.ts 内部一致：打包后允许的唯一页面。 */
function packagedRendererUrl(): string {
  return pathToFileURL(join(__dirname, '../renderer/index.html')).toString();
}

describe('isInternalUrl (packaged)', () => {
  afterEach(() => {
    delete process.env.ELECTRON_RENDERER_URL;
  });

  it('allows the renderer entry document', () => {
    delete process.env.ELECTRON_RENDERER_URL;
    expect(isInternalUrl(packagedRendererUrl())).toBe(true);
  });

  it('allows in-page routing fragments and query strings', () => {
    delete process.env.ELECTRON_RENDERER_URL;
    expect(isInternalUrl(`${packagedRendererUrl()}#/settings`)).toBe(true);
    expect(isInternalUrl(`${packagedRendererUrl()}?foo=bar`)).toBe(true);
  });

  it('rejects arbitrary local files', () => {
    delete process.env.ELECTRON_RENDERER_URL;
    expect(isInternalUrl('file:///etc/passwd')).toBe(false);
    expect(isInternalUrl(pathToFileURL('/tmp/evil.html').toString())).toBe(false);
  });

  it('rejects remote pages', () => {
    delete process.env.ELECTRON_RENDERER_URL;
    expect(isInternalUrl('https://example.com')).toBe(false);
    expect(isInternalUrl('http://127.0.0.1:5173')).toBe(false);
  });
});

describe('isInternalUrl (dev server)', () => {
  it('allows the configured dev origin and its routes', () => {
    process.env.ELECTRON_RENDERER_URL = 'http://localhost:5173';
    expect(isInternalUrl('http://localhost:5173')).toBe(true);
    expect(isInternalUrl('http://localhost:5173/index.html')).toBe(true);
    expect(isInternalUrl('http://localhost:5173/@vite/client')).toBe(true);
  });

  it('still rejects other origins while the dev server is configured', () => {
    process.env.ELECTRON_RENDERER_URL = 'http://localhost:5173';
    expect(isInternalUrl('https://evil.example')).toBe(false);
    expect(isInternalUrl('http://localhost:6173')).toBe(false);
  });
});
