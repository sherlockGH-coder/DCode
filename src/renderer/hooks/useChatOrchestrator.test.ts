import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { parseHTML } from 'linkedom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Message } from '../../shared/types';
import { useChatOrchestrator } from './useChatOrchestrator';

describe('useChatOrchestrator', () => {
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

  it('can send with an explicit message history after editing truncates the current turn', async () => {
    const originalMessages: Message[] = [
      { id: 'u1', role: 'user', content: 'old', turnId: 'u1', attemptNo: 0 },
      { id: 'a1', role: 'assistant', content: 'error', error: true, turnId: 'u1', attemptNo: 1 },
    ];
    const truncatedMessages: Message[] = [];
    const sendMessage = vi.fn(async (_options: { existingMessages: Message[] }) => undefined);
    let current: ReturnType<typeof useChatOrchestrator> | undefined;

    const Harness = () => {
      current = useChatOrchestrator({
        chat: {
          sendMessage,
          abortSend: vi.fn(),
          isConversationActive: vi.fn(() => false),
          rebindActiveRequests: vi.fn(),
        },
        conv: {
          conversationId: 'conv_1',
          messages: originalMessages,
          setMessages: vi.fn(),
          setConversationId: vi.fn(),
          loadConversations: vi.fn(async () => undefined),
          activeAttempts: {},
          setActiveAttempts: vi.fn(),
        },
        selectedModel: 'model_1',
        activeProject: null,
      });
      return null;
    };

    await act(async () => {
      root?.render(React.createElement(Harness));
    });

    await act(async () => {
      await (current?.handleSend as any)('edited', [], truncatedMessages);
    });

    expect(sendMessage).toHaveBeenCalledTimes(1);
    const firstCall = sendMessage.mock.calls[0];
    expect(firstCall).toBeDefined();
    expect(firstCall?.[0].existingMessages).toBe(truncatedMessages);
  });
});
