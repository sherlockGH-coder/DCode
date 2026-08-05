import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { parseHTML } from 'linkedom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Message } from '../../shared/types';
import { useMessages } from './useMessages';

describe('useMessages slash command handling', () => {
  let root: Root | null = null;
  let container: HTMLElement;
  let current: ReturnType<typeof useMessages> | undefined;

  beforeEach(() => {
    const { window } = parseHTML('<!doctype html><html><body><div id="root"></div></body></html>');
    Object.assign(globalThis, {
      window,
      document: window.document,
      HTMLElement: window.HTMLElement,
      Event: window.Event,
      CustomEvent: window.CustomEvent,
      Node: window.Node,
      IS_REACT_ACT_ENVIRONMENT: true,
    });

    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: {
        randomUUID: vi.fn(() => `uuid_${Math.random().toString(16).slice(2)}`),
      },
    });

    (window as any).deepseekApi = {
      createConversation: vi.fn(async () => 'conv_created'),
      updateConversationTitle: vi.fn(async () => undefined),
      addMessage: vi.fn(async () => 'persisted_user'),
      sendMessage: vi.fn(),
      abortChat: vi.fn(),
      compactConversation: vi.fn(),
      getMessages: vi.fn(async () => []),
      onChunk: vi.fn(() => vi.fn()),
      onReasoningChunk: vi.fn(() => vi.fn()),
      onDone: vi.fn(() => vi.fn()),
      onError: vi.fn(() => vi.fn()),
      onToolCallStart: vi.fn(() => vi.fn()),
      onToolCallEnd: vi.fn(() => vi.fn()),
      onAssistantMessage: vi.fn(() => vi.fn()),
      onToolMessagePersisted: vi.fn(() => vi.fn()),
      onStreamRetry: vi.fn(() => vi.fn()),
      onApprovalRequest: vi.fn(() => vi.fn()),
      approvalListPending: vi.fn(async () => []),
      approvalRespond: vi.fn(async () => true),
      agentsList: vi.fn(async () => []),
      onAgentsChanged: vi.fn(() => vi.fn()),
    };

    container = window.document.getElementById('root') as HTMLElement;
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    root = null;
    current = undefined;
    vi.restoreAllMocks();
  });

  it('sends /clear as a normal message instead of dispatching chat:clear', async () => {
    const clearListener = vi.fn();
    window.addEventListener('chat:clear', clearListener);
    const setMessages = vi.fn((updater: (prev: Message[]) => Message[]) => updater([]));

    const Harness = () => {
      current = useMessages();
      return null;
    };

    await act(async () => {
      root?.render(React.createElement(Harness));
    });

    await act(async () => {
      await current?.sendMessage({
        userInput: '/clear',
        attachments: [],
        conversationId: 'conv_slash_clear',
        existingMessages: [],
        activeAttempts: {},
        selectedModel: 'deepseek-chat',
        activeProject: null,
        bindSetMessages: () => setMessages,
      });
    });

    expect(clearListener).not.toHaveBeenCalled();
    const addMessageCall = (window.deepseekApi.addMessage as any).mock.calls[0];
    expect(addMessageCall.slice(0, 3)).toEqual(['conv_slash_clear', 'user', '/clear']);
    expect(addMessageCall[7]).toEqual([]);
    expect(addMessageCall[12]).toEqual(expect.any(String));
    expect(addMessageCall[13]).toBe(0);
    expect(addMessageCall[14]).toBe(0);
    expect(addMessageCall[15]).toEqual(addMessageCall[12]);
    expect(window.deepseekApi.sendMessage).toHaveBeenCalledTimes(1);
    expect((window.deepseekApi.sendMessage as any).mock.calls[0][0]).toEqual([
      { role: 'user', content: '/clear' },
    ]);
  });

  it('renames a pre-created empty conversation from the first user message', async () => {
    const setMessages = vi.fn((updater: (prev: Message[]) => Message[]) => updater([]));

    const Harness = () => {
      current = useMessages();
      return null;
    };

    await act(async () => {
      root?.render(React.createElement(Harness));
    });

    await act(async () => {
      await current?.sendMessage({
        userInput: 'Build a weather card for me',
        attachments: [],
        conversationId: 'conv_empty',
        existingMessages: [],
        activeAttempts: {},
        selectedModel: 'deepseek-chat',
        activeProject: null,
        bindSetMessages: () => setMessages,
      });
    });

    expect(window.deepseekApi.createConversation).not.toHaveBeenCalled();
    expect(window.deepseekApi.updateConversationTitle).toHaveBeenCalledWith('conv_empty', 'Build a weather card');
  });

  it('keeps multiple tool calls from one assistant response on a single assistant message', async () => {
    const handlers: Record<string, (...args: any[]) => void> = {};
    (window.deepseekApi.onChunk as any).mockImplementation((callback: (...args: any[]) => void) => {
      handlers.chunk = callback;
      return vi.fn();
    });
    (window.deepseekApi.onToolCallStart as any).mockImplementation((callback: (...args: any[]) => void) => {
      handlers.toolStart = callback;
      return vi.fn();
    });
    (window.deepseekApi.onToolCallEnd as any).mockImplementation((callback: (...args: any[]) => void) => {
      handlers.toolEnd = callback;
      return vi.fn();
    });
    (window.deepseekApi.onAssistantMessage as any).mockImplementation((callback: (...args: any[]) => void) => {
      handlers.assistant = callback;
      return vi.fn();
    });

    let messages: Message[] = [];
    const setMessages = vi.fn((updater: (prev: Message[]) => Message[]) => {
      messages = updater(messages);
    });
    const content = 'This PNG image is valid at `1254×1254` pixels.';

    const Harness = () => {
      current = useMessages();
      return null;
    };

    await act(async () => {
      root?.render(React.createElement(Harness));
    });

    await act(async () => {
      await current?.sendMessage({
        userInput: 'Read the image',
        attachments: [],
        conversationId: 'conv_multi_tool',
        existingMessages: [],
        activeAttempts: {},
        selectedModel: 'deepseek-chat',
        activeProject: null,
        bindSetMessages: () => setMessages,
      });
    });

    await act(async () => {
      handlers.chunk('conv_multi_tool', content);
      handlers.toolStart('conv_multi_tool', {
        id: 'call_read_main',
        name: 'read_file',
        arguments: '{"file_path":"/tmp/main.py"}',
      });
      handlers.toolEnd('conv_multi_tool', {
        tool_call_id: 'call_read_main',
        name: 'read_file',
        content: 'main.py content',
      });
      handlers.toolStart('conv_multi_tool', {
        id: 'call_read_notebook',
        name: 'read_file',
        arguments: '{"file_path":"/tmp/test.ipynb"}',
      });
      handlers.toolEnd('conv_multi_tool', {
        tool_call_id: 'call_read_notebook',
        name: 'read_file',
        content: 'notebook content',
      });
      handlers.assistant('conv_multi_tool', {
        id: 'assistant_db',
        content,
        duration: 10,
        completed_at: Date.now(),
      });
    });

    const assistantMessages = messages.filter((message) => message.role === 'assistant');
    const contentMessages = assistantMessages.filter((message) => message.content === content);

    expect(contentMessages).toHaveLength(1);
    expect(contentMessages[0].id).toBe('assistant_db');
    expect(contentMessages[0].toolItems).toHaveLength(2);
    expect(messages.filter((message) => message.role === 'tool')).toHaveLength(2);
  });

  it('does not resend a tool call twice when the persisted assistant event arrives before tool start', async () => {
    const handlers: Record<string, (...args: any[]) => void> = {};
    (window.deepseekApi.onToolCallStart as any).mockImplementation((callback: (...args: any[]) => void) => {
      handlers.toolStart = callback;
      return vi.fn();
    });
    (window.deepseekApi.onToolCallEnd as any).mockImplementation((callback: (...args: any[]) => void) => {
      handlers.toolEnd = callback;
      return vi.fn();
    });
    (window.deepseekApi.onAssistantMessage as any).mockImplementation((callback: (...args: any[]) => void) => {
      handlers.assistant = callback;
      return vi.fn();
    });
    (window.deepseekApi.onDone as any).mockImplementation((callback: (...args: any[]) => void) => {
      handlers.done = callback;
      return vi.fn();
    });

    let messages: Message[] = [];
    const setMessages = vi.fn((updater: (prev: Message[]) => Message[]) => {
      messages = updater(messages);
    });
    const toolCall = {
      id: 'call_read_file',
      type: 'function' as const,
      function: {
        name: 'read_file',
        arguments: '{"file_path":"/tmp/example.md"}',
      },
    };

    const Harness = () => {
      current = useMessages();
      return null;
    };

    await act(async () => {
      root?.render(React.createElement(Harness));
    });

    await act(async () => {
      await current?.sendMessage({
        userInput: 'Review this file',
        attachments: [],
        conversationId: 'conv_persisted_first',
        existingMessages: [],
        activeAttempts: {},
        selectedModel: 'deepseek-chat',
        activeProject: null,
        bindSetMessages: () => setMessages,
      });
    });

    await act(async () => {
      // This is the production IPC order: agentLoop persists/sends the assistant
      // message before executeToolCallsParallel emits tool_call_start.
      handlers.assistant('conv_persisted_first', {
        id: 'assistant_db',
        content: '',
        tool_calls: [toolCall],
        providerContentBlocks: [{
          type: 'tool_use',
          id: toolCall.id,
          name: toolCall.function.name,
          input: { file_path: '/tmp/example.md' },
        }],
      });
      handlers.toolStart('conv_persisted_first', {
        id: toolCall.id,
        name: toolCall.function.name,
        arguments: toolCall.function.arguments,
      });
      handlers.toolEnd('conv_persisted_first', {
        tool_call_id: toolCall.id,
        name: toolCall.function.name,
        content: 'file contents',
      });
      handlers.done('conv_persisted_first');
    });

    await act(async () => {
      await current?.sendMessage({
        userInput: 'Continue',
        attachments: [],
        conversationId: 'conv_persisted_first',
        existingMessages: messages,
        activeAttempts: {},
        selectedModel: 'deepseek-chat',
        activeProject: null,
        bindSetMessages: () => setMessages,
      });
    });

    const nextRequest = (window.deepseekApi.sendMessage as any).mock.calls[1][0] as Array<{
      role: string;
      tool_calls?: Array<{ id: string }>;
      tool_call_id?: string;
    }>;
    const replayedAssistant = nextRequest.find((message) => message.role === 'assistant' && message.tool_calls);
    expect(replayedAssistant?.tool_calls?.map((call) => call.id)).toEqual([toolCall.id]);
    expect(nextRequest.filter((message) => message.tool_call_id === toolCall.id)).toHaveLength(1);
  });
});
