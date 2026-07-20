import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { parseHTML } from 'linkedom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useConversations } from './useConversations';

describe('useConversations', () => {
  let root: Root | null = null;
  let container: HTMLElement;
  let current: ReturnType<typeof useConversations> | undefined;

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

    (window as any).dcodeApi = {
      createConversation: vi.fn(async () => 'conv_empty'),
      getConversations: vi.fn(async () => [
        {
          id: 'conv_empty',
          title: '新对话',
          project_path: '/project',
          created_at: '2026-06-17 00:00:00',
          updated_at: '2026-06-17 00:00:00',
        },
      ]),
      getMessages: vi.fn(async () => []),
      getActiveAttempts: vi.fn(async () => ({})),
      setActiveAttempts: vi.fn(async () => undefined),
      approvalListPending: vi.fn(async () => []),
      deleteConversation: vi.fn(async () => undefined),
      deleteMessagesFromTurn: vi.fn(async () => undefined),
    };
    (window as any).conversationsApi = {
      onChanged: vi.fn(() => vi.fn()),
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

  it('persists and selects a new empty conversation immediately', async () => {
    const Harness = () => {
      current = useConversations('/project');
      return null;
    };

    await act(async () => {
      root?.render(React.createElement(Harness));
    });

    await act(async () => {
      await current?.handleNewConversation('/project');
    });

    expect(window.dcodeApi.createConversation).toHaveBeenCalledWith('新对话', '/project');
    expect(window.dcodeApi.getConversations).toHaveBeenCalledTimes(2);
    expect(current?.conversationId).toBe('conv_empty');
    expect(current?.messages).toEqual([]);
  });

  it('removes messages from a turn onward after undo deletion', async () => {
    const Harness = () => {
      current = useConversations('/project');
      return null;
    };
    const messages = [
      { id: 'user_1', role: 'user', content: 'one', turnId: 'user_1', attemptNo: 0 },
      { id: 'assistant_1', role: 'assistant', content: 'one done', turnId: 'user_1', attemptNo: 1 },
      { id: 'user_2', role: 'user', content: 'two', turnId: 'user_2', attemptNo: 0 },
      { id: 'assistant_2', role: 'assistant', content: 'two done', turnId: 'user_2', attemptNo: 1 },
      { id: 'user_3', role: 'user', content: 'three', turnId: 'user_3', attemptNo: 0 },
    ] as any;

    await act(async () => {
      root?.render(React.createElement(Harness));
    });
    await act(async () => {
      await current?.handleNewConversation('/project');
    });
    act(() => {
      current?.setMessages('conv_empty', () => messages);
    });

    expect(current?.messages).toHaveLength(5);

    await act(async () => {
      await current?.deleteMessagesFromTurn('conv_empty', 'user_2');
    });

    expect(window.dcodeApi.deleteMessagesFromTurn).toHaveBeenCalledWith('conv_empty', 'user_2');
    expect(current?.messages.map((message) => message.id)).toEqual(['user_1', 'assistant_1']);
  });

  it('evicts least recently loaded conversation messages beyond the cache limit', async () => {
    (window.dcodeApi.getMessages as ReturnType<typeof vi.fn>).mockImplementation(async (convId: string) => [
      { id: `message_${convId}`, role: 'user', content: convId, turnId: convId, attemptNo: 0 },
    ]);
    const Harness = () => {
      current = useConversations('/project');
      return null;
    };

    await act(async () => {
      root?.render(React.createElement(Harness));
    });

    for (let index = 1; index <= 6; index += 1) {
      await act(async () => {
        await current?.loadMessages(`conv_${index}`);
      });
    }

    expect(window.dcodeApi.getMessages).toHaveBeenCalledTimes(6);

    await act(async () => {
      current?.handleSelectConversation('conv_1');
    });

    expect(window.dcodeApi.getMessages).toHaveBeenCalledTimes(7);
  });
});
