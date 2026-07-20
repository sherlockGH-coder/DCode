import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { parseHTML } from 'linkedom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import DiffView from './DiffView';

describe('DiffView', () => {
  let root: Root | null = null;
  let container: HTMLElement;

  beforeEach(() => {
    const { window } = parseHTML('<!doctype html><html><body><div id="root"></div></body></html>');
    Object.assign(globalThis, {
      window,
      document: window.document,
      HTMLElement: window.HTMLElement,
      Event: window.Event,
      Node: window.Node,
      IS_REACT_ACT_ENVIRONMENT: true,
    });
    container = window.document.getElementById('root') as HTMLElement;
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    root = null;
  });

  it('collapses unchanged context so edits render as diff hunks instead of full files', () => {
    const diff = [
      '@@ -1,12 +1,12 @@',
      ' line 1 far context',
      ' line 2 far context',
      ' line 3 far context',
      ' line 4 far context',
      ' line 5 near first edit',
      '-line 6 old',
      '+line 6 new',
      ' line 7 near first edit',
      ' line 8 hidden context',
      ' line 9 hidden context',
      ' line 10 near second edit',
      '-line 11 old',
      '+line 11 new',
      ' line 12 near second edit',
    ].join('\n');

    act(() => {
      root?.render(React.createElement(DiffView, { diff, filename: 'ToolItemCard.test.ts' }));
    });

    const text = container.textContent ?? '';
    expect(text).not.toContain('line 1 far context');
    expect(text).not.toContain('line 2 far context');
    expect(text).not.toContain('line 3 far context');
    expect(text).not.toContain('line 4 far context');
    expect(text).toContain('line 5 near first edit');
    expect(text).toContain('line 6 old');
    expect(text).toContain('line 6 new');
    expect(text).toContain('line 7 near first edit');
    expect(text).not.toContain('line 8 hidden context');
    expect(text).not.toContain('line 9 hidden context');
    expect(text).toContain('line 10 near second edit');
    expect(text).toContain('line 11 old');
    expect(text).toContain('line 11 new');
    expect(text).toContain('line 12 near second edit');
  });

  it('uses codex-like flat rows with a white divider between line numbers and code', () => {
    const diff = '@@ -65,3 +65,3 @@\n expect(row).not.toBeNull();\n-expect(old).toBe(true);\n+expect(newValue).toBe(true);\n expect(done).toBe(true);';

    act(() => {
      root?.render(React.createElement(DiffView, { diff, filename: 'ToolItemCard.test.ts' }));
    });

    const html = container.innerHTML;
    expect(html).toContain('leading-[18px]');
    expect(html).toContain('py-[1px]');
    expect(html).toContain('border-r-2');
    expect(html).toContain('border-white/95');
    expect(html).not.toContain('leading-relaxed');
  });

  it('renders with line-level green and red borders in review mode instead of a container-level left border', () => {
    const diff = '@@ -65,3 +65,3 @@\n expect(row).not.toBeNull();\n-expect(old).toBe(true);\n+expect(newValue).toBe(true);\n expect(done).toBe(true);';

    act(() => {
      root?.render(React.createElement(DiffView, { diff, filename: 'ToolItemCard.test.ts', variant: 'review' }));
    });

    const html = container.innerHTML;

    expect(html).not.toContain('border-l-4 border-[#1ba84a] bg-[#eaf7ec]');

    expect(html).toContain('border-l-4 border-[#1ba84a] dark:border-emerald-500/80');
    expect(html).toContain('border-l-4 border-[#d1242f] dark:border-rose-500/80');
    expect(html).toContain('border-l-4 border-transparent');
  });
});
