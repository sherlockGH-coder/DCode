import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { parseHTML } from 'linkedom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ChatInput, { BUILTIN_SLASH_COMMAND_NAMES, CompactContextRing, formatCompactSlashCommandDescription } from './ChatInput';

vi.mock('../hooks/useSettings', () => ({
  useSettings: () => ({
    settings: {
      speech: {
        maxDurationSeconds: 60,
      },
      compact: {
        contextLimit: 100_000,
      },
    },
  }),
}));

vi.mock('../hooks/useSkills', () => ({
  useSkills: () => ({
    skills: [],
  }),
}));

vi.mock('../hooks/useVoiceInput', () => ({
  useVoiceInput: () => ({
    status: 'idle',
    errorMessage: null,
    elapsedMs: 0,
    level: 0,
    isBusy: false,
    isRecording: false,
    startRecording: vi.fn(),
    stopAndTranscribe: vi.fn(),
    cancelRecording: vi.fn(),
    resetError: vi.fn(),
  }),
}));

describe('ChatInput slash commands', () => {
  let root: Root | null = null;
  let container: HTMLElement;

  beforeEach(() => {
    const { window } = parseHTML('<!doctype html><html><body><div id="root"></div></body></html>');
    Object.assign(globalThis, {
      window,
      document: window.document,
      HTMLElement: window.HTMLElement,
      HTMLTextAreaElement: (window as any).HTMLTextAreaElement,
      HTMLButtonElement: (window as any).HTMLButtonElement,
      Event: window.Event,
      InputEvent: (window as any).InputEvent ?? window.Event,
      Node: window.Node,
      SVGElement: (window as any).SVGElement,
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

  it('renders compact with a live context ring and usage description', () => {
    act(() => {
      root?.render(React.createElement('div', null, [
        React.createElement(CompactContextRing, { key: 'compact', percent: 67 }),
        React.createElement('span', { key: 'description' }, formatCompactSlashCommandDescription(67)),
      ]));
    });

    const compactRing = container.querySelector('[data-testid="slash-command-compact-ring"]');

    expect(compactRing).not.toBeNull();
    expect(compactRing?.outerHTML).toContain('stroke-dasharray="67 100"');
    expect(compactRing?.getAttribute('aria-label')).toBe('当前上下文已使用 67%');
    expect(container.textContent).toContain('压缩此会话的上下文（已使用 67%）');
  });

  it('does not register clear as a slash command', () => {
    expect(BUILTIN_SLASH_COMMAND_NAMES).not.toContain('clear');
    expect(BUILTIN_SLASH_COMMAND_NAMES).toEqual(['compact', 'plan', 'help']);
  });

  it('does not clip the project selector dropdown slot', () => {
    act(() => {
      root?.render(React.createElement(ChatInput, {
        onSend: vi.fn(),
        onAbort: vi.fn(),
        isLoading: false,
        models: ['deepseek-v4-flash'],
        selectedModel: 'deepseek-v4-flash',
        onModelChange: vi.fn(),
        onReasoningEffortChange: vi.fn(),
        activeProject: null,
        isWelcome: true,
        projectSelector: React.createElement('button', { type: 'button' }, 'OS'),
      }));
    });

    const slot = container.querySelector('[data-testid="chat-input-project-branch-slot"]');
    const projectFooter = container.querySelector('.composer-project-footer');
    expect(slot?.className).toContain('overflow-visible');
    expect(slot?.className).not.toContain('overflow-hidden');
    expect(projectFooter).not.toBeNull();
    expect(projectFooter?.textContent).toContain('OS');
    expect(container.textContent).not.toContain('上下文');
  });

  it('does not render the project footer inside an existing conversation', () => {
    act(() => {
      root?.render(React.createElement(ChatInput, {
        onSend: vi.fn(),
        onAbort: vi.fn(),
        isLoading: false,
        models: ['deepseek-v4-flash'],
        selectedModel: 'deepseek-v4-flash',
        onModelChange: vi.fn(),
        onReasoningEffortChange: vi.fn(),
        activeProject: '/Users/demo/DeepSeek-App',
        isWelcome: false,
      }));
    });

    expect(container.querySelector('.composer-project-footer')).toBeNull();
  });

  it('moves Plan mode into the plus menu and shows a removable indicator beside the microphone', () => {
    const onModeChange = vi.fn();
    const renderInput = (mode: 'execute' | 'plan') => React.createElement(ChatInput, {
      onSend: vi.fn(),
      onAbort: vi.fn(),
      isLoading: false,
      models: ['deepseek-v4-flash'],
      selectedModel: 'deepseek-v4-flash',
      onModelChange: vi.fn(),
      onReasoningEffortChange: vi.fn(),
      mode,
      onModeChange,
    });

    act(() => root?.render(renderInput('execute')));
    const plus = container.querySelector('button[aria-label="附加选项"]') as HTMLButtonElement;
    act(() => plus.dispatchEvent(new window.Event('click', { bubbles: true })));

    const planMenuItem = [...container.querySelectorAll('[role="menuitem"]')]
      .find((item) => item.textContent?.includes('计划')) as HTMLButtonElement;
    expect(planMenuItem).not.toBeNull();
    act(() => planMenuItem.dispatchEvent(new window.Event('click', { bubbles: true })));
    expect(onModeChange).toHaveBeenCalledWith('plan');

    act(() => root?.render(renderInput('plan')));
    const indicator = container.querySelector('[data-testid="plan-mode-indicator"]') as HTMLElement;
    const microphone = container.querySelector('button[aria-label="语音输入"]') as HTMLButtonElement;
    expect(indicator.textContent).toContain('计划');
    const toolbarItems = [...(microphone.parentElement?.children ?? [])];
    expect(toolbarItems.indexOf(indicator)).toBe(toolbarItems.indexOf(microphone) + 1);
    expect(container.querySelector('[data-testid="plan-mode-toggle"]')).toBeNull();

    const close = container.querySelector('button[aria-label="关闭计划模式"]') as HTMLButtonElement;
    act(() => close.dispatchEvent(new window.Event('click', { bubbles: true })));
    expect(onModeChange).toHaveBeenLastCalledWith('execute');
  });

  it('places status content above the composer without expanding its surface', () => {
    act(() => {
      root?.render(React.createElement(ChatInput, {
        onSend: vi.fn(),
        onAbort: vi.fn(),
        isLoading: true,
        models: ['deepseek-v4-flash'],
        selectedModel: 'deepseek-v4-flash',
        onModelChange: vi.fn(),
        onReasoningEffortChange: vi.fn(),
        statusAccessory: React.createElement('div', { 'data-testid': 'status-accessory' }, '正在执行 · 1/3'),
      }));
    });

    const composer = container.querySelector('[data-testid="chat-input-composer"]');
    const status = container.querySelector('[data-testid="status-accessory"]');
    const textarea = container.querySelector('textarea');

    expect(composer?.contains(status)).toBe(false);
    expect(composer?.contains(textarea)).toBe(true);
    const inputRoot = composer?.parentElement;
    const children = Array.from(inputRoot?.children ?? []);
    expect(children.findIndex((child) => child.contains(status))).toBeLessThan(children.indexOf(composer as Element));
  });
});
