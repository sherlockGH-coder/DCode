import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { parseHTML } from 'linkedom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import ProcessedSummary from './ProcessedSummary';

describe('ProcessedSummary', () => {
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

  it('stays expanded while processing and collapses when the whole turn completes', () => {
    const child = React.createElement('div', null, '中间过程');

    act(() => root?.render(React.createElement(ProcessedSummary, {
      isProcessing: true,
      startedAt: Date.now(),
      hasIntermediate: true,
      children: child,
    })));

    const toggle = container.querySelector('[data-testid="processed-summary-toggle"]') as HTMLButtonElement;
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(container.textContent).toContain('中间过程');

    act(() => root?.render(React.createElement(ProcessedSummary, {
      isProcessing: false,
      durationMs: 2_000,
      hasIntermediate: true,
      children: child,
    })));

    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(container.textContent).not.toContain('中间过程');
  });
});
