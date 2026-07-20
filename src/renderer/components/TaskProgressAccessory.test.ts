import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { parseHTML } from 'linkedom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Message, Task, ToolItem } from '../../shared/types';
import TaskProgressAccessory from './TaskProgressAccessory';

const taskMocks = vi.hoisted(() => ({
  tasks: [] as Task[],
}));

vi.mock('../hooks/useTasks', () => ({
  useTasks: () => ({
    tasks: taskMocks.tasks,
    isLoading: false,
    refresh: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  }),
}));

function planMessage(statuses: Array<'pending' | 'in_progress' | 'completed'>): Message {
  const plan: ToolItem = {
    id: 'plan_1',
    toolCallId: 'call_plan_1',
    name: 'update_plan',
    kind: 'plan_update',
    status: 'done',
    timestamp: 0,
    plan: statuses.map((status, index) => ({ step: `步骤 ${index + 1}`, status })),
  };
  return { id: 'assistant_1', role: 'assistant', content: '', toolItems: [plan] };
}

function task(id: string, title: string, status: Task['status']): Task {
  return {
    id,
    title,
    description: '',
    status,
    scope: 'project',
    projectPath: '/tmp/project',
    blockedBy: [],
    blocks: [],
    isBackground: false,
    conversationId: 'conv_1',
    outputFilePath: null,
    createdAt: '2026-07-15T00:00:00.000Z',
    updatedAt: '2026-07-15T00:00:00.000Z',
    completedAt: null,
  };
}

describe('TaskProgressAccessory', () => {
  let root: Root | null = null;
  let container: HTMLElement;

  beforeEach(() => {
    vi.useFakeTimers();
    const { window } = parseHTML('<!doctype html><html><body><div id="root"></div></body></html>');
    Object.assign(globalThis, {
      window,
      document: window.document,
      HTMLElement: window.HTMLElement,
      Event: window.Event,
      Node: window.Node,
      IS_REACT_ACT_ENVIRONMENT: true,
    });
    taskMocks.tasks = [];
    container = window.document.getElementById('root') as HTMLElement;
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root?.unmount());
    root = null;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const renderAccessory = (messages: Message[], isAgentRunning = true) => {
    root?.render(React.createElement(TaskProgressAccessory, {
      activeConversationId: 'conv_1',
      activeProject: '/tmp/project',
      messages,
      isAgentRunning,
    }));
  };

  it('shows compact progress and expands the ordered todo list', () => {
    act(() => renderAccessory([planMessage(['completed', 'in_progress', 'pending'])]));

    expect(container.textContent).toContain('步骤 1 / 3');
    expect(container.querySelector('[aria-label="展开待办事项"]')).not.toBeNull();

    const toggle = container.querySelector('[aria-label="展开待办事项"]') as HTMLButtonElement;
    act(() => toggle.dispatchEvent(new window.Event('click', { bubbles: true })));

    expect(container.querySelector('[aria-label="收起待办事项"]')).not.toBeNull();
    const text = container.textContent ?? '';
    expect(text).toContain('步骤 1');
    expect(text).toContain('步骤 3');
    expect(text.indexOf('步骤 1')).toBeLessThan(text.lastIndexOf('步骤 3'));

    const panel = container.querySelector('[data-testid="task-progress-panel"]');
    expect(panel?.className).toContain('w-[min(340px,80vw)]');

    const completedIcon = container.querySelector('[data-todo-status="completed"]');
    expect(completedIcon?.className).toContain('rounded-full');
    expect(completedIcon?.className).toContain('border');
    expect(completedIcon?.className).toContain('text-text-primary');
    expect(completedIcon?.querySelector('svg')?.getAttribute('class')).toBe('shrink-0 text-current');

    const inProgressIcon = container.querySelector('[data-todo-status="in_progress"]');
    const pendingIcon = container.querySelector('[data-todo-status="pending"]');
    for (const icon of [inProgressIcon, pendingIcon]) {
      expect(icon?.className).toContain('h-4');
      expect(icon?.className).toContain('w-4');
      expect(icon?.className).toContain('rounded-full');
    }
    expect(inProgressIcon?.querySelector('svg')?.getAttribute('width')).toBe('16');
    expect(inProgressIcon?.querySelector('svg')?.getAttribute('height')).toBe('16');
  });

  it('shows progress and lists todos when no todo is in progress', () => {
    act(() => renderAccessory([planMessage(['pending'])], false));
    expect(container.textContent).toContain('步骤 0 / 1');
    expect(container.textContent).toContain('步骤 1');
  });

  it('briefly shows completion and then removes the accessory', () => {
    act(() => renderAccessory([planMessage(['in_progress'])]));
    expect(container.querySelector('[data-testid="task-progress-accessory"]')).not.toBeNull();

    act(() => renderAccessory([planMessage(['completed'])]));
    expect(container.querySelector('[data-testid="task-progress-complete"]')).not.toBeNull();
    expect(container.textContent).toContain('步骤 1 / 1');

    act(() => vi.advanceTimersByTime(1800));
    expect(container.querySelector('[data-testid="task-progress-complete"]')).toBeNull();
  });

  it('does not include cancelled tasks in progress', () => {
    taskMocks.tasks = [
      task('task_pending', '待执行任务', 'pending'),
      task('task_cancelled', '已取消任务', 'cancelled'),
    ];

    act(() => renderAccessory([], false));

    expect(container.textContent).toContain('步骤 0 / 1');
    expect(container.textContent).toContain('待执行任务');
    expect(container.textContent).not.toContain('已取消任务');
  });
});
