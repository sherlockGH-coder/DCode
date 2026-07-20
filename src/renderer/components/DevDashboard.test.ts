import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { parseHTML } from 'linkedom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Message, Task, ToolItem } from '../../shared/types';
import DevDashboard from './DevDashboard';

const taskMocks = vi.hoisted(() => ({
  tasks: [] as Task[],
  update: vi.fn(),
  setPreview: vi.fn(),
  gitGetCommitStatus: vi.fn(),
}));

vi.mock('../hooks/useTasks', () => ({
  useTasks: () => ({
    tasks: taskMocks.tasks,
    isLoading: false,
    refresh: vi.fn(),
    create: vi.fn(),
    update: taskMocks.update,
    remove: vi.fn(),
  }),
}));

vi.mock('../contexts/AppContext', () => ({
  useAppContext: () => ({
    setPreview: taskMocks.setPreview,
  }),
}));

function task(id: string, title: string, status: Task['status']): Task {
  return {
    id,
    title,
    description: '',
    status,
    scope: 'project',
    projectPath: '/Users/conan/Code/10.project/DCode',
    blockedBy: [],
    blocks: [],
    isBackground: false,
    conversationId: 'conv_1',
    outputFilePath: null,
    createdAt: '2026-06-15T00:00:00.000Z',
    updatedAt: '2026-06-15T00:00:00.000Z',
    completedAt: status === 'completed' ? '2026-06-15T00:00:00.000Z' : null,
  };
}

describe('DevDashboard', () => {
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
    taskMocks.gitGetCommitStatus.mockResolvedValue({
      hasGit: true,
      branch: 'main',
      additions: 12,
      deletions: 3,
      hasChanges: true,
      hasStagedChanges: false,
      hasUnstagedChanges: true,
      aheadCount: 0,
      hasRemote: true,
      hasUpstream: true,
    });
    (window as any).dcodeApi = {
      gitGetCommitStatus: taskMocks.gitGetCommitStatus,
      gitCommit: vi.fn(),
      gitPush: vi.fn(),
    };
    taskMocks.tasks = [
      task('task_1', '改工具调用行', 'in_progress'),
      task('task_2', '整理右侧面板', 'pending'),
    ];
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

  it('renders task monitoring sections', () => {
    const writeItem: ToolItem = {
      id: 'write_1',
      toolCallId: 'call_write',
      name: 'write_file',
      kind: 'write',
      status: 'done',
      timestamp: 0,
      path: '/Users/conan/Code/10.project/DCode/src/renderer/components/ToolItemCard.tsx',
      isNew: false,
      diff: '@@ -1 +1 @@\n-old\n+new',
    };
    const searchItem: ToolItem = {
      id: 'search_1',
      toolCallId: 'call_search',
      name: 'web_search',
      kind: 'web_search',
      status: 'done',
      timestamp: 0,
      query: 'tool call UI',
      resultCount: 3,
    };
    const messages: Message[] = [
      {
        id: 'assistant_1',
        role: 'assistant',
        content: '',
        toolItems: [writeItem, searchItem],
      },
    ];
    const onActiveTodoPresenceChange = vi.fn();

    act(() => {
      root?.render(React.createElement(DevDashboard, {
        activeConversationId: 'conv_1',
        activeProject: '/Users/conan/Code/10.project/DCode',
        messages,
        onActiveTodoPresenceChange,
      }));
    });

    expect(container.textContent).toContain('改工具调用行');
    expect(container.textContent).toContain('变更');
    expect(container.textContent).toContain('外部资源');
    expect(container.textContent).toContain('待办事项');
    expect(container.textContent).not.toContain('任务监控');
    expect(onActiveTodoPresenceChange).toHaveBeenLastCalledWith(true);
  });

  it('renders the runtime environment before changes and opens the commit panel', async () => {
    await act(async () => {
      root?.render(React.createElement(DevDashboard, {
        activeConversationId: 'conv_1',
        activeProject: '/Users/conan/Code/10.project/DCode',
        messages: [],
      }));
      await Promise.resolve();
    });

    const text = container.textContent || '';
    expect(text).toContain('运行环境');
    expect(text).toContain('main');
    expect(text.indexOf('运行环境')).toBeLessThan(text.indexOf('变更'));

    const commitButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Commit or push'));
    act(() => commitButton?.dispatchEvent(new window.Event('click', { bubbles: true })));

    expect(document.querySelector('[role="dialog"][aria-label="Commit or push"]')).not.toBeNull();
    expect(document.body.textContent).toContain('+12');
    expect(document.body.textContent).toContain('-3');
  });

  it('collapses empty sections and auto-expands each section when content first appears', async () => {
    const renderDashboard = (messages: Message[]) => {
      root?.render(React.createElement(DevDashboard, {
        activeConversationId: 'conv_1',
        activeProject: '/Users/conan/Code/10.project/DCode',
        messages,
      }));
    };

    await act(async () => {
      renderDashboard([]);
      await Promise.resolve();
    });

    expect(container.querySelector('[aria-label="展开 变更"]')?.getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector('[aria-label="展开 外部资源"]')?.getAttribute('aria-expanded')).toBe('false');

    const writeItem: ToolItem = {
      id: 'write_auto_expand',
      toolCallId: 'call_write_auto_expand',
      name: 'write_file',
      kind: 'write',
      status: 'done',
      timestamp: 0,
      path: '/Users/conan/Code/10.project/DCode/src/new.ts',
      isNew: true,
      diff: '@@ -0,0 +1 @@\n+export {}',
    };
    const searchItem: ToolItem = {
      id: 'search_auto_expand',
      toolCallId: 'call_search_auto_expand',
      name: 'web_search',
      kind: 'web_search',
      status: 'done',
      timestamp: 0,
      query: 'React layout',
      resultCount: 1,
    };

    await act(async () => {
      renderDashboard([{ id: 'assistant_auto_expand', role: 'assistant', content: '', toolItems: [writeItem, searchItem] }]);
      await Promise.resolve();
    });

    expect(container.querySelector('[aria-label="折叠 变更"]')?.getAttribute('aria-expanded')).toBe('true');
    expect(container.querySelector('[aria-label="折叠 外部资源"]')?.getAttribute('aria-expanded')).toBe('true');
  });

  it('removes the todo section after all plan steps and session tasks are completed', () => {
    taskMocks.tasks = [task('task_done', '已完成的任务', 'completed')];
    const onActiveTodoPresenceChange = vi.fn();
    const completedPlan: ToolItem = {
      id: 'plan_done',
      toolCallId: 'call_plan_done',
      name: 'update_plan',
      kind: 'plan_update',
      status: 'done',
      timestamp: 0,
      plan: [{ step: '完成界面调整', status: 'completed' }],
    };

    act(() => {
      root?.render(React.createElement(DevDashboard, {
        activeConversationId: 'conv_1',
        activeProject: '/Users/conan/Code/10.project/DCode',
        messages: [{ id: 'assistant_done', role: 'assistant', content: '', toolItems: [completedPlan] }],
        onActiveTodoPresenceChange,
      }));
    });

    expect(container.textContent).toContain('变更');
    expect(container.textContent).toContain('外部资源');
    expect(container.textContent).not.toContain('待办事项');
    expect(container.textContent).not.toContain('已完成的任务');
    expect(onActiveTodoPresenceChange).toHaveBeenLastCalledWith(false);
  });

  it('renders changed file icons in monochrome without changing shared file icon output', () => {
    const writeItem: ToolItem = {
      id: 'write_1',
      toolCallId: 'call_write',
      name: 'write_file',
      kind: 'write',
      status: 'done',
      timestamp: 0,
      path: '/Users/conan/Code/10.project/DCode/weather-card.html',
      isNew: false,
      diff: '@@ -1 +1 @@\n-old\n+new',
    };
    const messages: Message[] = [
      {
        id: 'assistant_1',
        role: 'assistant',
        content: '',
        toolItems: [writeItem],
      },
    ];

    act(() => {
      root?.render(React.createElement(DevDashboard, {
        activeConversationId: 'conv_1',
        activeProject: '/Users/conan/Code/10.project/DCode',
        messages,
      }));
    });

    const changedFileButton = container.querySelector('[title="/Users/conan/Code/10.project/DCode/weather-card.html"]');
    const fileIconWrapper = changedFileButton?.querySelector('.material-icon')?.parentElement;

    expect(fileIconWrapper?.className).toContain('grayscale');
    expect(fileIconWrapper?.className).toContain('contrast-125');
  });
});
