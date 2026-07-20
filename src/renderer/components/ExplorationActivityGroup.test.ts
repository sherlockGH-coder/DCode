import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { parseHTML } from 'linkedom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ToolItem } from '../../shared/types';
import ExplorationActivityGroup, { type ExplorationActivity } from './ExplorationActivityGroup';

vi.mock('../contexts/AppContext', () => ({
  usePreviewActions: () => ({ setPreview: vi.fn() }),
}));

describe('ExplorationActivityGroup', () => {
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
    vi.restoreAllMocks();
  });

  it('defaults to collapsed and uses the first non-reasoning activity icon', () => {
    const read: ToolItem = {
      id: 'read-1', toolCallId: 'call-read', name: 'read_file', kind: 'read', status: 'done', timestamp: 1,
      path: '/repo/src/App.tsx', lineCount: 22,
    };
    const grep: ToolItem = {
      id: 'grep-1', toolCallId: 'call-grep', name: 'grep', kind: 'grep', status: 'done', timestamp: 2,
      path: '/repo/src', pattern: 'MessageBubble', matchCount: 5, fileCount: 2,
    };
    const activities: ExplorationActivity[] = [
      { kind: 'reasoning', id: 'thought-1', content: 'reasoning', durationMs: 169_000 },
      { kind: 'tool', id: 'tool-read', item: read },
      { kind: 'tool', id: 'tool-grep', item: grep },
    ];

    act(() => root?.render(React.createElement(ExplorationActivityGroup, { activities })));

    const summary = container.querySelector('[data-testid="exploration-activity-summary"]') as HTMLButtonElement;
    expect(summary.getAttribute('aria-expanded')).toBe('false');
    expect(summary.getAttribute('data-tool-icon')).toBe('book');
    expect(summary.textContent).toContain('思考了 2分49秒，读取 1 个文件，搜索 1 次');
    expect(container.querySelector('[data-testid="exploration-activity-details"]')).toBeNull();

    act(() => summary.dispatchEvent(new window.Event('click', { bubbles: true })));

    expect(summary.getAttribute('aria-expanded')).toBe('true');
    const details = container.querySelector('[data-testid="exploration-activity-details"]') as HTMLElement;
    expect(details.className).not.toContain('pl-[25px]');
    expect(details.querySelector('[data-testid="reasoning-activity-toggle"]')?.className).not.toContain('px-2');
    expect(details.querySelector('[data-testid="tool-item-row"]')?.className).not.toContain('px-2');
    expect(container.textContent).toContain('已深度思考，思考了 2分49秒');
    expect(container.textContent).toContain('已读取');
    expect(container.textContent).toContain('App.tsx');
    expect(container.textContent).toContain('22 lines');
    expect(container.textContent).toContain('src 中的 MessageBubble');
  });

  it('renders reasoning directly without a redundant summary and expands its content', () => {
    act(() => root?.render(React.createElement(ExplorationActivityGroup, { activities: [
        { kind: 'reasoning', id: 'thought-only', content: 'reasoning', durationMs: 12_000 },
      ] })));

    expect(container.querySelector('[data-testid="exploration-activity-summary"]')).toBeNull();
    const reasoningToggle = container.querySelector('[data-testid="reasoning-activity-toggle"]') as HTMLButtonElement;
    expect(reasoningToggle.textContent).toContain('已深度思考，思考了 12秒');
    expect(reasoningToggle.getAttribute('aria-expanded')).toBe('false');
    expect(container.textContent).not.toContain('reasoning');

    act(() => reasoningToggle.dispatchEvent(new window.Event('click', { bubbles: true })));

    expect(reasoningToggle.getAttribute('aria-expanded')).toBe('true');
    expect(container.querySelector('[data-testid="reasoning-activity-content"]')?.textContent).toBe('reasoning');
  });

  it('uses the search icon when search is the first non-reasoning activity', () => {
    const grep: ToolItem = {
      id: 'grep-only', toolCallId: 'call-grep', name: 'grep', kind: 'grep', status: 'done', timestamp: 2,
      pattern: 'activity', matchCount: 3, fileCount: 1,
    };
    act(() => root?.render(React.createElement(ExplorationActivityGroup, { activities: [
        { kind: 'reasoning', id: 'thought-before-search', content: 'reasoning', durationMs: 2_000 },
        { kind: 'tool', id: 'tool-search', item: grep },
      ] })));

    const summary = container.querySelector('[data-testid="exploration-activity-summary"]') as HTMLButtonElement;
    expect(summary.getAttribute('data-tool-icon')).toBe('search');
    expect(summary.className).toContain('activity-summary-row');
  });

  it('collapses a reasoning row as soon as its own stream completes while the turn continues', () => {
    const streamingActivity: Extract<ExplorationActivity, { kind: 'reasoning' }> = {
      kind: 'reasoning', id: 'thought-streaming', content: '正在思考', isStreaming: true,
    };

    act(() => root?.render(React.createElement(ExplorationActivityGroup, {
      activities: [streamingActivity],
      isProcessing: true,
    })));

    expect(container.querySelector('[data-testid="reasoning-activity-toggle"]')).toBeNull();
    expect(container.querySelector('[data-testid="reasoning-activity-streaming-label"]')?.textContent).toContain('正在深度思考');
    expect(container.querySelector('[data-testid="reasoning-activity-content"]')?.textContent).toBe('正在思考');

    act(() => root?.render(React.createElement(ExplorationActivityGroup, {
      activities: [{ ...streamingActivity, isStreaming: false }],
      isProcessing: true,
    })));

    const reasoningToggle = container.querySelector('[data-testid="reasoning-activity-toggle"]') as HTMLButtonElement;
    expect(reasoningToggle.getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector('[data-testid="reasoning-activity-streaming-label"]')).toBeNull();
    expect(container.textContent).not.toContain('正在思考');
  });

  it('hides the summary row while the group is still active and shows it once terminated', () => {
    const read: ToolItem = {
      id: 'read-active', toolCallId: 'call-read', name: 'read_file', kind: 'read', status: 'running', timestamp: 1,
      path: '/repo/src/App.tsx',
    };
    const activities: ExplorationActivity[] = [{ kind: 'tool', id: 'tool-read', item: read }];

    act(() => root?.render(React.createElement(ExplorationActivityGroup, { activities, isProcessing: true })));

    expect(container.querySelector('[data-testid="exploration-activity-summary"]')).toBeNull();
    expect(container.querySelector('[data-testid="exploration-activity-details"]')).not.toBeNull();

    act(() => root?.render(React.createElement(ExplorationActivityGroup, {
      activities: [{ kind: 'tool', id: 'tool-read', item: { ...read, status: 'done' as const, lineCount: 10 } }],
      isProcessing: false,
    })));

    const summary = container.querySelector('[data-testid="exploration-activity-summary"]') as HTMLButtonElement;
    expect(summary.getAttribute('aria-expanded')).toBe('false');
    expect(summary.textContent).toContain('读取 1 个文件');
    expect(container.querySelector('[data-testid="exploration-activity-details"]')).toBeNull();
  });
});
