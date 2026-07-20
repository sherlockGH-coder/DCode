import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { getFileIcon } from './icons';

function renderIconTitle(ext: string, filename: string): string {
  const markup = renderToStaticMarkup(React.createElement(React.Fragment, null, getFileIcon(ext, filename)));
  return markup.match(/title="([^"]+)"/)?.[1] || '';
}

describe('getFileIcon', () => {
  it.each([
    ['ts', 'index.ts', 'typescript icon'],
    ['js', 'main.js', 'javascript icon'],
    ['html', 'index.html', 'html icon'],
  ])('uses language icon for .%s files', (ext, filename, expectedTitle) => {
    expect(renderIconTitle(ext, filename)).toBe(expectedTitle);
  });
});
