import { describe, expect, it } from 'vitest';
import type { Message } from '../../../shared/types';
import type { ActiveRequest } from './types';
import { applyAssistantMessageToMessages } from './useMessageStreamEvents';

function activeRequest(overrides: Partial<ActiveRequest> = {}): ActiveRequest {
  return {
    conversationId: 'conv_1',
    fullContent: '',
    fullReasoning: '',
    setMessages: () => undefined,
    turnId: 'turn_1',
    attemptNo: 1,
    placeholderId: 'assistant_1',
    ...overrides,
  };
}

function assistantWithText(): Message {
  return {
    id: 'assistant_1',
    role: 'assistant',
    content: 'I will first analyze the code structure.',
    turnId: 'turn_1',
    attemptNo: 1,
  };
}

describe('applyAssistantMessageToMessages', () => {
  it('does not let empty content from a tool-only turn overwrite streamed text', () => {
    const req = activeRequest({ assistantAnchorId: 'assistant_1' });
    const prev: Message[] = [assistantWithText()];

    const result = applyAssistantMessageToMessages(prev, req, {
      id: 'db_1',
      content: '',
      duration: 1200,
      completed_at: 1720000000000,
    });

    expect(result[0].content).toBe('I will first analyze the code structure.');
    expect(result[0].id).toBe('db_1');
    expect(result[0].duration).toBe(1200);
  });

  it('normalizes non-empty content on the anchor message', () => {
    const req = activeRequest({ assistantAnchorId: 'assistant_1' });
    const prev: Message[] = [assistantWithText()];

    const result = applyAssistantMessageToMessages(prev, req, {
      id: 'db_1',
      content: 'I will first analyze the code structure. Full version.',
    });

    expect(result[0].content).toBe('I will first analyze the code structure. Full version.');
  });

  it('merges provider blocks without turning server tools into client calls', () => {
    const req = activeRequest({ assistantAnchorId: 'assistant_1' });
    const prev: Message[] = [assistantWithText()];
    const providerContentBlocks = [
      {
        type: 'server_tool_use',
        id: 'search_1',
        name: 'web_search',
        input: { query: 'DeepSeek docs' },
      },
    ];

    const result = applyAssistantMessageToMessages(prev, req, {
      id: 'db_1',
      content: '',
      serverToolUses: [{ id: 'search_1', name: 'web_search', input: { query: 'DeepSeek docs' } }],
      providerContentBlocks,
    });

    expect(result[0].serverToolUses).toHaveLength(1);
    expect(result[0].providerContentBlocks).toEqual(providerContentBlocks);
    expect(result[0].tool_calls).toBeUndefined();
  });

  it('inserts a new message when the anchor is not an assistant and content is non-empty', () => {
    const toolMsg: Message = {
      id: 'tool_result_1',
      role: 'tool',
      content: 'ok',
      tool_call_id: 'call_1',
      turnId: 'turn_1',
      attemptNo: 1,
    };
    const req = activeRequest({ assistantAnchorId: 'tool_result_1', insertAfterId: 'tool_result_1' });

    const result = applyAssistantMessageToMessages([toolMsg], req, { content: 'Final answer' });

    expect(result).toHaveLength(2);
    expect(result[1].role).toBe('assistant');
    expect(result[1].content).toBe('Final answer');
  });
});
