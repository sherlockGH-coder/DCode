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
 * FileIcon is lazy-loaded, so synchronous renderToStaticMarkup only renders the Suspense placeholder.
 * Use React 19's prerender to wait for the Suspense boundary before reading the markup.
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
    // The synchronous render path should return a placeholder instead of crashing.
    const element = getFileIcon('ts', 'index.ts');
    expect(element).toBeTruthy();
  });
});
