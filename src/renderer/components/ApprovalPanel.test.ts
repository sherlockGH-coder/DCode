import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { parseHTML } from 'linkedom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ToolItem } from '../../shared/types';
import ApprovalPanel, { isDenyFeedbackSubmitShortcut } from './ApprovalPanel';

function pressKey(element: Element, key: string, modifiers: { metaKey?: boolean; ctrlKey?: boolean } = {}): void {
  const event = new window.Event('keydown', { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    key: { value: key },
    metaKey: { value: modifiers.metaKey ?? false },
    ctrlKey: { value: modifiers.ctrlKey ?? false },
  });
  element.dispatchEvent(event);
}

const appContextMocks = vi.hoisted(() => ({
  setPreview: vi.fn(),
}));

vi.mock('../contexts/AppContext', () => ({
  useAppContext: () => ({
    setPreview: appContextMocks.setPreview,
  }),
}));

describe('ApprovalPanel', () => {
  let root: Root | null = null;
  let container: HTMLElement;

  beforeEach(() => {
    const { window } = parseHTML('<!doctype html><html><body><div id="root"></div></body></html>');
    Object.assign(globalThis, {
      window,
      document: window.document,
      HTMLElement: window.HTMLElement,
      HTMLInputElement: (window as any).HTMLInputElement,
      HTMLTextAreaElement: (window as any).HTMLTextAreaElement,
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
    vi.restoreAllMocks();
  });

  it('renders a compact inline diff header like a code review preview', () => {
    const item: ToolItem = {
      id: 'approval-call_1',
      toolCallId: 'call_1',
      name: 'write_file',
      kind: 'write',
      status: 'awaiting_approval',
      timestamp: 0,
      path: '/Users/conan/Code/Learn/langchain/ApprovalPanel.test.ts',
      isNew: true,
      approvalDiffPreview: '@@ -1,2 +1,3 @@\n-old line\n+new line\n+next line\n context line',
    };

    act(() => {
      root?.render(React.createElement(ApprovalPanel, { item }));
    });

    const diffCard = container.querySelector('[data-testid="approval-diff-card"]');
    expect(diffCard).not.toBeNull();
    expect(diffCard?.textContent).toContain('ApprovalPanel.test.ts');
    expect(diffCard?.textContent).toContain('+2');
    expect(diffCard?.textContent).toContain('-1');
    expect(diffCard?.textContent).not.toContain('+new line');
    expect(diffCard?.textContent).not.toContain('+next line');
    expect(diffCard?.textContent).not.toContain('Diff preview');
    expect(diffCard?.textContent).not.toContain('/Users/conan/Code/Learn/langchain');
    expect(diffCard?.outerHTML).toContain('text-[13px]');
    expect(diffCard?.outerHTML).toContain('leading-6');
    expect(diffCard?.outerHTML).toContain('py-[2px]');
    expect(diffCard?.outerHTML).not.toContain('text-[14px]');
    expect(diffCard?.outerHTML).not.toContain('text-[15px]');
    expect(diffCard?.outerHTML).not.toContain('leading-8');
    expect(diffCard?.outerHTML).not.toContain('py-[5px]');
  });

  it('does not render the batch deny action', () => {
    const item: ToolItem = {
      id: 'approval-call_1',
      toolCallId: 'call_1',
      name: 'bash_exec',
      kind: 'exec',
      status: 'awaiting_approval',
      timestamp: 0,
      command: 'git status',
    };

    act(() => {
      root?.render(React.createElement(ApprovalPanel, {
        item,
        total: 2,
        index: 0,
      }));
    });

    expect(container.textContent).not.toContain('Deny All');
  });

  it('selects the first option by default, wraps with arrow keys, and confirms with Enter', () => {
    const onConfirm = vi.fn();
    const item: ToolItem = {
      id: 'approval-keyboard',
      toolCallId: 'call_keyboard',
      name: 'bash_exec',
      kind: 'exec',
      status: 'awaiting_approval',
      timestamp: 0,
      command: 'pnpm test',
    };

    act(() => root?.render(React.createElement(ApprovalPanel, { item, onConfirm })));
    const panel = container.querySelector('[data-testid="approval-panel"]') as HTMLElement;
    const options = [...container.querySelectorAll('[data-testid="approval-option"]')];
    expect(options[0].getAttribute('aria-pressed')).toBe('true');

    act(() => pressKey(panel, 'ArrowUp'));
    expect(options[2].getAttribute('aria-pressed')).toBe('true');
    act(() => pressKey(panel, 'ArrowDown'));
    expect(options[0].getAttribute('aria-pressed')).toBe('true');
    act(() => pressKey(panel, 'ArrowDown'));
    expect(options[1].getAttribute('aria-pressed')).toBe('true');
    act(() => pressKey(panel, 'Enter'));
    expect(onConfirm).toHaveBeenCalledWith('call_keyboard', true, undefined, false, undefined);
  });

  it('opens rejection feedback with Tab and reserves submission for Mod+Enter', () => {
    const onConfirm = vi.fn();
    const item: ToolItem = {
      id: 'approval-feedback',
      toolCallId: 'call_feedback',
      name: 'bash_exec',
      kind: 'exec',
      status: 'awaiting_approval',
      timestamp: 0,
      command: 'pnpm test',
    };

    act(() => root?.render(React.createElement(ApprovalPanel, { item, onConfirm })));
    const panel = container.querySelector('[data-testid="approval-panel"]') as HTMLElement;
    act(() => {
      pressKey(panel, 'ArrowDown');
      pressKey(panel, 'ArrowDown');
    });
    act(() => pressKey(panel, 'Tab'));

    const feedback = container.querySelector('textarea[placeholder="可选：告诉 AI 应当改做什么…"]') as HTMLTextAreaElement;
    expect(feedback).not.toBeNull();
    expect(onConfirm).not.toHaveBeenCalled();
    expect(isDenyFeedbackSubmitShortcut({ key: 'Enter', metaKey: false, ctrlKey: false })).toBe(false);
    expect(isDenyFeedbackSubmitShortcut({ key: 'Enter', metaKey: true, ctrlKey: false })).toBe(true);
    expect(isDenyFeedbackSubmitShortcut({ key: 'Enter', metaKey: false, ctrlKey: true })).toBe(true);
  });

  it('ignores stationary hover, tracks pointer movement, and confirms mouse clicks', () => {
    const onConfirm = vi.fn();
    const item: ToolItem = {
      id: 'approval-mouse',
      toolCallId: 'call_mouse',
      name: 'bash_exec',
      kind: 'exec',
      status: 'awaiting_approval',
      timestamp: 0,
      command: 'pnpm test',
    };

    act(() => root?.render(React.createElement(ApprovalPanel, { item, onConfirm })));
    const options = [...container.querySelectorAll('[data-testid="approval-option"]')];
    act(() => options[2].dispatchEvent(new window.Event('mouseover', { bubbles: true })));
    expect(options[0].getAttribute('aria-pressed')).toBe('true');

    act(() => options[2].dispatchEvent(new window.Event('pointermove', { bubbles: true })));
    expect(options[2].getAttribute('aria-pressed')).toBe('true');

    act(() => options[0].dispatchEvent(new window.Event('pointermove', { bubbles: true })));
    expect(options[0].getAttribute('aria-pressed')).toBe('true');
    act(() => options[0].dispatchEvent(new window.Event('click', { bubbles: true })));
    expect(onConfirm).toHaveBeenCalledWith('call_mouse', true, undefined, false, undefined);
  });
});
