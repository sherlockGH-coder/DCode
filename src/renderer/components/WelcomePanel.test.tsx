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
    expect(container.querySelector('button[aria-label="探索：帮我探索和分析当前代码库的架构与核心实现"]')).not.toBeNull();
    expect(container.querySelector('button[aria-label="构建：帮我构建一个新的功能模块："]')).not.toBeNull();
    expect(container.querySelector('button[aria-label="修复：帮我检查并修复代码中的问题："]')).not.toBeNull();
    expect(container.querySelector('button[aria-label="审查：帮我审查最近的代码变更并给出改进建议"]')).not.toBeNull();
    expect(container.textContent).not.toContain('DCode Workbench');
    expect(container.textContent).not.toContain('Enter 执行');
  });

  it('passes the selected prompt to the composer integration', () => {
    const onQuickAction = vi.fn();
    act(() => root?.render(<WelcomePanel onQuickAction={onQuickAction} />));

    const buildButton = container.querySelector('button[aria-label="构建：帮我构建一个新的功能模块："]') as HTMLButtonElement;
    act(() => buildButton.dispatchEvent(new window.Event('click', { bubbles: true })));

    expect(onQuickAction).toHaveBeenCalledWith('帮我构建一个新的功能模块：');
  });
});
