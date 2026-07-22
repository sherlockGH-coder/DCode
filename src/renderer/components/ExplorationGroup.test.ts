import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { parseHTML } from 'linkedom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ToolItem } from '../../shared/types';
import ExplorationGroup from './ExplorationGroup';

vi.mock('../contexts/AppContext', () => ({
  useAppContext: () => ({
    setPreview: vi.fn(),
  }),
}));

describe('ExplorationGroup', () => {
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

  it('renders exploration details as compact gray summaries with basenames only', () => {
    const items: ToolItem[] = [
      {
        id: 'read_1',
        toolCallId: 'call_read',
        name: 'read_file',
        kind: 'read',
        status: 'done',
        timestamp: 0,
        path: '/Users/conan/Code/10.project/DeepSeek-App/src/renderer/components/preview/DiffView.tsx',
        lineCount: 520,
        output: Array.from({ length: 80 }, (_, index) => `line ${index}`).join('\n'),
      },
      {
        id: 'list_1',
        toolCallId: 'call_list',
        name: 'list_directory',
        kind: 'list_directory',
        status: 'done',
        timestamp: 1,
        path: '/Users/conan/Code/10.project/DeepSeek-App/src/renderer/components/preview',
        totalCount: 5,
      },
      {
        id: 'grep_1',
        toolCallId: 'call_grep',
        name: 'grep',
        kind: 'grep',
        status: 'done',
        timestamp: 2,
        pattern: 'bash|terminal.*icon|terminal.*chiclet|chiclet|\\[1m|bash_exec',
        matchCount: 33,
        fileCount: 31,
      },
    ];

    act(() => {
      root?.render(React.createElement(ExplorationGroup, {
        items,
        summary: 'Read a file、已搜索 1 次和已列出文件',
      }));
    });

    const summary = container.querySelector('[data-testid="exploration-summary"]') as HTMLElement | null;
    expect(summary).not.toBeNull();
    expect(summary?.getAttribute('data-tool-icon')).toBe('search');
    expect(summary?.textContent).toContain('Read a file');
    expect(summary?.textContent).toContain('已搜索');
    expect(summary?.textContent).toContain('已列出文件');
    expect(summary?.outerHTML).toContain('text-text-secondary');

    const details = Array.from(container.querySelectorAll('[data-testid="exploration-detail"]'));
    expect(details).toHaveLength(3);
    expect(details.map((detail) => detail.textContent)).toEqual([
      '已读取 DiffView.tsx',
      '已列出 preview',
      '已搜索代码',
    ]);
    expect(container.textContent).not.toContain('/Users/conan');
    expect(container.textContent).not.toContain('src/renderer/components/preview/DiffView.tsx');
    expect(container.textContent).not.toContain('bash|terminal.*icon');
    expect(container.querySelector('[data-testid="tool-item-row"]')).toBeNull();
  });
});
