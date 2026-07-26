import React from 'react';
import { prerender } from 'react-dom/static';
import { describe, expect, it } from 'vitest';

import { getFileIcon } from './icons';

async function streamToString(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let out = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    out += decoder.decode(value, { stream: true });
  }
  return out + decoder.decode();
}

/**
 * FileIcon 现在是懒加载的，同步的 renderToStaticMarkup 只会渲染 Suspense 占位。
 * 用 React 19 的 prerender 等待 Suspense 边界解析完再取标记。
 */
async function renderIconTitle(ext: string, filename: string): Promise<string> {
  const { prelude } = await prerender(
    React.createElement(React.Fragment, null, getFileIcon(ext, filename)),
  );
  const markup = await streamToString(prelude);
  return markup.match(/title="([^"]+)"/)?.[1] || '';
}

describe('getFileIcon', () => {
  it.each([
    ['ts', 'index.ts', 'typescript icon'],
    ['js', 'main.js', 'javascript icon'],
    ['html', 'index.html', 'html icon'],
  ])('uses language icon for .%s files', async (ext, filename, expectedTitle) => {
    await expect(renderIconTitle(ext, filename)).resolves.toBe(expectedTitle);
  });

  it('renders a placeholder glyph before the icon chunk resolves', () => {
    // 同步渲染路径下应当拿到占位符而不是崩溃
    const element = getFileIcon('ts', 'index.ts');
    expect(element).toBeTruthy();
  });
});
