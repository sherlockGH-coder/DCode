import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { highlightCode } from './highlightCode';

describe('highlightCode', () => {
  it.each([
    ['py', 'def answer(): return 42', 'def', 'text-[#a626a4]'],
    ['json', '{"answer": true}', 'true', 'text-[#986801]'],
    ['ts', 'const answer = "yes"', 'const', 'text-[#a626a4]'],
    ['css', '.answer { color: red; }', '.answer', 'text-[#e45649]'],
    ['txt', '// answer', '// answer', 'text-[#a0a1a7]'],
  ])('preserves token styling for %s', (ext, source, token, className) => {
    const html = renderToStaticMarkup(React.createElement('div', null, highlightCode(source, ext)));

    expect(html).toContain(token);
    expect(html).toContain(className);
  });
});
