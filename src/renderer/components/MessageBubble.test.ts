import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { parseHTML } from 'linkedom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Message } from '../../shared/types';
import MessageBubble from './MessageBubble';
import { initPathContext } from '../utils/collapsePath';

const appContextMocks = vi.hoisted(() => ({
  setPreview: vi.fn(),
  handleModelChange: vi.fn(),
}));

vi.mock('../contexts/AppContext', () => ({
  usePreviewActions: () => ({
    setPreview: appContextMocks.setPreview,
  }),
  useModelsContext: () => ({
    models: ['deepseek-v4-flash'],
    selectedModel: 'deepseek-v4-flash',
    handleModelChange: appContextMocks.handleModelChange,
  }),
}));

vi.mock('../hooks/useSettings', () => ({
  useSettings: () => ({
    settings: {
      speech: {
        maxDurationSeconds: 60,
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

describe('MessageBubble', () => {
  let root: Root | null = null;
  let container: HTMLElement;

  const message: Message = {
    id: 'user_1',
    role: 'user',
    content: '你是谁?',
    created_at: '2026-06-14 14:00:00',
    turnId: 'user_1',
    attemptNo: 0,
  };

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
    appContextMocks.setPreview.mockReset();
    window.dcodeApi = {
      readFileContent: vi.fn().mockResolvedValue({
        content: 'line one\nline two\nline three\n',
        name: 'example.ts',
        path: '/Users/conan/project/src/example.ts',
      }),
    } as any;
    initPathContext('/Users/conan/project', '/Users/conan');
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

  it('does not enter edit mode while the latest user message is still loading', () => {
    const onEditSubmit = vi.fn();

    act(() => {
      root?.render(React.createElement(MessageBubble, {
        message,
        onEditSubmit,
        isEditAvailable: false,
        isConvLoading: true,
      }));
    });

    const bubble = container.querySelector('[data-testid="user-message-bubble"]') as HTMLElement | null;
    expect(bubble).not.toBeNull();

    act(() => {
      bubble?.dispatchEvent(new window.Event('click', { bubbles: true }));
    });

    expect(container.querySelector('textarea[placeholder="编辑消息..."]')).toBeNull();
    expect(container.querySelector('button[title="编辑消息"]')).toBeNull();
    expect(container.querySelector('button[title="复制内容"]')).toBeNull();
  });

  it('enters edit mode by clicking the latest editable user bubble', () => {
    const onEditSubmit = vi.fn();

    act(() => {
      root?.render(React.createElement(MessageBubble, {
        message,
        onEditSubmit,
        isEditAvailable: true,
        isConvLoading: false,
      }));
    });

    const bubble = container.querySelector('[data-testid="user-message-bubble"]') as HTMLElement | null;
    expect(bubble).not.toBeNull();
    expect(container.querySelector('button[title="编辑消息"]')).toBeNull();
    expect(container.querySelector('button[title="复制内容"]')).toBeNull();

    act(() => {
      bubble?.dispatchEvent(new window.Event('click', { bubbles: true }));
    });

    const textarea = container.querySelector('textarea[placeholder="编辑消息..."]') as HTMLTextAreaElement | null;
    expect(textarea).not.toBeNull();
    expect(textarea?.value).toBe('你是谁?');

    const composer = container.querySelector('[data-testid="chat-input-composer"]') as HTMLElement | null;
    const sendButton = container.querySelector('button[aria-label="发送"]') as HTMLButtonElement | null;
    expect(composer).not.toBeNull();
    expect(composer?.textContent).toContain('deepseek-v4-flash');
    expect(sendButton).not.toBeNull();
    expect(composer?.contains(textarea)).toBe(true);
    expect(composer?.contains(sendButton)).toBe(true);
    expect(container.querySelector('[data-testid="user-message-edit-box"]')).toBeNull();
  });

  it('cancels inline edit when clicking outside the composer', () => {
    const onEditSubmit = vi.fn();

    act(() => {
      root?.render(React.createElement(MessageBubble, {
        message,
        onEditSubmit,
        isEditAvailable: true,
        isConvLoading: false,
      }));
    });

    const bubble = container.querySelector('[data-testid="user-message-bubble"]') as HTMLElement | null;
    expect(bubble).not.toBeNull();

    act(() => {
      bubble?.dispatchEvent(new window.Event('click', { bubbles: true }));
    });

    const composer = container.querySelector('[data-testid="chat-input-composer"]') as HTMLElement | null;
    expect(composer).not.toBeNull();

    act(() => {
      composer?.dispatchEvent(new window.Event('mousedown', { bubbles: true }));
    });
    expect(container.querySelector('textarea[placeholder="编辑消息..."]')).not.toBeNull();

    act(() => {
      window.document.body.dispatchEvent(new window.Event('mousedown', { bubbles: true }));
    });

    expect(container.querySelector('textarea[placeholder="编辑消息..."]')).toBeNull();
    expect(container.querySelector('[data-testid="user-message-bubble"]')).not.toBeNull();
  });

  it('collapses reasoning after an assistant message has completed', () => {
    const assistantMessage: Message = {
      id: 'assistant_1',
      role: 'assistant',
      content: '最终答案',
      reasoning_content: '这里是思考过程',
      duration: 1200,
    };

    act(() => {
      root?.render(React.createElement(MessageBubble, {
        message: assistantMessage,
        isGenerating: false,
      }));
    });

    expect(container.textContent).toContain('最终答案');
    expect(container.textContent).toContain('已深度思考');
    expect(container.textContent).not.toContain('这里是思考过程');
  });

  it('insets assistant messages without changing user-message alignment', () => {
    const assistantMessage: Message = {
      id: 'assistant_inset',
      role: 'assistant',
      content: '左右对称缩进',
    };

    act(() => {
      root?.render(React.createElement(MessageBubble, { message: assistantMessage }));
    });
    expect(container.querySelector('[data-message-role="assistant"]')?.className).toContain('assistant-message-inset');

    act(() => {
      root?.render(React.createElement(MessageBubble, { message }));
    });
    expect(container.querySelector('[data-message-role="user"]')?.className).not.toContain('assistant-message-inset');
  });

  it('marks markdown lists so reset styles do not remove bullets or numbering', () => {
    const assistantMessage: Message = {
      id: 'assistant_list',
      role: 'assistant',
      content: [
        '根据变更分析：',
        '',
        '- App.tsx：移除推理区',
        '- App.test.ts：补充测试',
        '',
        '执行提交：',
        '',
        '1. git add',
        '2. git commit',
      ].join('\n'),
    };

    act(() => {
      root?.render(React.createElement(MessageBubble, {
        message: assistantMessage,
        isGenerating: false,
      }));
    });

    const unorderedList = container.querySelector('ul.markdown-list-unordered') as HTMLElement | null;
    const orderedList = container.querySelector('ol.markdown-list-ordered') as HTMLElement | null;
    expect(unorderedList).not.toBeNull();
    expect(orderedList).not.toBeNull();
    expect(unorderedList?.querySelectorAll('li')).toHaveLength(2);
    expect(orderedList?.querySelectorAll('li')).toHaveLength(2);
  });

  it('opens local file references with a line number at the requested line', async () => {
    const assistantMessage: Message = {
      id: 'assistant_file_ref',
      role: 'assistant',
      content: '查看 /Users/conan/project/src/example.ts:2',
    };

    await act(async () => {
      root?.render(React.createElement(MessageBubble, {
        message: assistantMessage,
        isGenerating: false,
      }));
    });

    const link = container.querySelector('a.markdown-local-ref') as HTMLAnchorElement | null;
    expect(link).not.toBeNull();
    expect(link?.getAttribute('href')).toBe('/Users/conan/project/src/example.ts:2');

    await act(async () => {
      link?.dispatchEvent(new window.Event('click', { bubbles: true, cancelable: true }));
    });

    expect(window.dcodeApi.readFileContent).toHaveBeenCalledWith('/Users/conan/project/src/example.ts');
    expect(appContextMocks.setPreview).toHaveBeenCalledWith(expect.objectContaining({
      type: 'code',
      title: 'example.ts',
      content: 'line one\nline two\nline three\n',
      filePath: '/Users/conan/project/src/example.ts',
      initialLine: 2,
    }));
  });
});
