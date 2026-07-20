import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { parseHTML } from 'linkedom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import WelcomePanel from './WelcomePanel';

describe('WelcomePanel', () => {
  let root: Root | null = null;
  let container: HTMLElement;

  beforeEach(() => {
    const { window } = parseHTML('<!doctype html><html><body><div id="root"></div></body></html>');
    Object.assign(globalThis, {
      window,
      document: window.document,
      HTMLElement: window.HTMLElement,
      HTMLButtonElement: (window as any).HTMLButtonElement,
      Event: window.Event,
      Node: window.Node,
      SVGElement: (window as any).SVGElement,
      IS_REACT_ACT_ENVIRONMENT: true,
    });
    container = window.document.getElementById('root') as HTMLElement;
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root?.unmount());
    root = null;
    vi.restoreAllMocks();
  });

  it('renders the four welcome actions without legacy helper text', () => {
    act(() => root?.render(<WelcomePanel onQuickAction={vi.fn()} />));

    expect(container.textContent).toContain('准备构建什么？');
    expect(container.textContent).toContain('从想法到实现，AI 与你一起完成');
    expect(container.querySelectorAll('.welcome-action-card')).toHaveLength(4);
    expect(container.querySelector('button[aria-label="探索：/explore"]')).not.toBeNull();
    expect(container.querySelector('button[aria-label="构建：/build"]')).not.toBeNull();
    expect(container.querySelector('button[aria-label="修复：/fix"]')).not.toBeNull();
    expect(container.querySelector('button[aria-label="审查：/review"]')).not.toBeNull();
    expect(container.textContent).not.toContain('DCode Workbench');
    expect(container.textContent).not.toContain('Enter 执行');
  });

  it('passes the selected command to the composer integration', () => {
    const onQuickAction = vi.fn();
    act(() => root?.render(<WelcomePanel onQuickAction={onQuickAction} />));

    const buildButton = container.querySelector('button[aria-label="构建：/build"]') as HTMLButtonElement;
    act(() => buildButton.dispatchEvent(new window.Event('click', { bubbles: true })));

    expect(onQuickAction).toHaveBeenCalledWith('/build');
  });
});
