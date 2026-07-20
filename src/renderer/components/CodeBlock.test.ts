import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { parseHTML } from 'linkedom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CodeBlock from './CodeBlock';

vi.mock('../contexts/AppContext', () => ({
  usePreviewActions: () => ({ setPreview: vi.fn() }),
}));

vi.mock('../hooks/useIsDarkTheme', () => ({
  useIsDarkTheme: () => false,
}));

describe('CodeBlock', () => {
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
    act(() => root?.unmount());
    root = null;
  });

  it('renders plain text with a transparent, readable body instead of syntax-highlight background blocks', () => {
    act(() => root?.render(React.createElement(CodeBlock, {
      language: 'text',
      code: 'commit 7b24ade (main)\n11 files changed',
    })));

    const body = container.querySelector('[data-testid="plain-text-code-body"]') as HTMLElement;
    expect(body).not.toBeNull();
    expect(body.className).toContain('bg-transparent');
    expect(body.className).toContain('text-[13px]');
    expect(body.className).toContain('break-words');
    expect(body.textContent).toContain('11 files changed');
    expect(container.querySelector('[data-testid="syntax-highlighted-code-body"]')).toBeNull();
  });
});
