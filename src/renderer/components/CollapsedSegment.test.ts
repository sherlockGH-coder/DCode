import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { parseHTML } from 'linkedom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SegmentChildRenderUnit } from '../utils/tool-pipeline';
import CollapsedSegment from './CollapsedSegment';

vi.mock('../contexts/AppContext', () => ({
  useAppContext: () => ({
    setPreview: vi.fn(),
  }),
  usePreviewActions: () => ({
    setPreview: vi.fn(),
  }),
}));

describe('CollapsedSegment', () => {
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
    vi.restoreAllMocks();
  });

  it('uses the pencil glyph for collapsed file change summaries', () => {
    const units: SegmentChildRenderUnit[] = [
      {
        kind: 'entry',
        segmentIndex: 0,
        item: {
          id: 'edit-call_1',
          toolCallId: 'call_1',
          name: 'edit_file',
          kind: 'edit',
          status: 'done',
          timestamp: 0,
          path: '/Users/conan/Code/10.project/DCode/src/renderer/components/ToolItemCard.tsx',
          linesAdded: 4,
          linesDeleted: 2,
          diff: '@@ -1 +1 @@\n-old\n+new',
        },
      },
    ];

    act(() => {
      root?.render(React.createElement(CollapsedSegment, {
        units,
        summary: '已编辑 1 个文件',
      }));
    });

    const icon = container.querySelector('[data-testid="collapsed-segment-icon"]') as HTMLElement | null;
    expect(icon).not.toBeNull();
    expect(icon?.getAttribute('data-tool-icon')).toBe('pencil');
  });

  it('uses a terminal glyph for non-file collapsed summaries and hides expanded child icons', () => {
    const units: SegmentChildRenderUnit[] = [
      {
        kind: 'entry',
        segmentIndex: 0,
        item: {
          id: 'exec-call_1',
          toolCallId: 'call_1',
          name: 'bash_exec',
          kind: 'exec',
          status: 'done',
          timestamp: 0,
          command: 'curl -s https://example.com',
        },
      },
      {
        kind: 'entry',
        segmentIndex: 0,
        item: {
          id: 'read-call_1',
          toolCallId: 'call_2',
          name: 'read_file',
          kind: 'read',
          status: 'done',
          timestamp: 0,
          path: '/Users/conan/Code/10.project/DCode/mcp.json',
        },
      },
    ];

    act(() => {
      root?.render(React.createElement(CollapsedSegment, {
        units,
        summary: '已读取 1 个文件，已运行 1 个命令',
      }));
    });

    const icon = container.querySelector('[data-testid="collapsed-segment-icon"]') as HTMLElement | null;
    expect(icon).not.toBeNull();
    expect(icon?.getAttribute('data-tool-icon')).toBe('terminal');

    const button = container.querySelector('button') as HTMLButtonElement | null;
    act(() => {
      button?.dispatchEvent(new window.Event('click', { bubbles: true }));
    });

    expect(container.querySelectorAll('[data-testid="tool-item-kind-icon"]')).toHaveLength(0);
    expect(container.textContent).toContain('已运行');
    expect(container.textContent).toContain('已读取');
  });

  it('renders exploration groups as flat child rows when a collapsed segment is expanded', () => {
    const units: SegmentChildRenderUnit[] = [
      {
        kind: 'exploration-group',
        segmentIndex: 0,
        summary: '已搜索 1 次和已列出文件',
        items: [
          {
            id: 'grep-call_1',
            toolCallId: 'call_1',
            name: 'grep',
            kind: 'grep',
            status: 'done',
            timestamp: 0,
            pattern: 'CollapsedSegment',
            matchCount: 2,
            fileCount: 1,
          },
          {
            id: 'glob-call_1',
            toolCallId: 'call_2',
            name: 'glob',
            kind: 'glob',
            status: 'done',
            timestamp: 1,
            pattern: 'src/renderer/**/*.tsx',
            matchCount: 8,
          },
        ],
      },
    ];

    act(() => {
      root?.render(React.createElement(CollapsedSegment, {
        units,
        summary: '已搜索代码并列出文件',
      }));
    });

    const button = container.querySelector('button') as HTMLButtonElement | null;
    act(() => {
      button?.dispatchEvent(new window.Event('click', { bubbles: true }));
    });

    expect(container.querySelector('[data-testid="exploration-summary"]')).toBeNull();
    expect(container.querySelectorAll('[data-testid="tool-item-row"]')).toHaveLength(2);
    expect(container.querySelectorAll('[data-testid="tool-item-kind-icon"]')).toHaveLength(0);
    expect(container.textContent).toContain('已搜索');
    expect(container.textContent).toContain('已检索');
  });
});
