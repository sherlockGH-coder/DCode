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
    content: '我先分析一下代码结构。',
    turnId: 'turn_1',
    attemptNo: 1,
  };
}

describe('applyAssistantMessageToMessages', () => {
  it('纯工具轮的空串 content 不得覆盖已流式输出的正文', () => {
    const req = activeRequest({ assistantAnchorId: 'assistant_1' });
    const prev: Message[] = [assistantWithText()];

    const result = applyAssistantMessageToMessages(prev, req, {
      id: 'db_1',
      content: '',
      duration: 1200,
      completed_at: 1720000000000,
    });

    expect(result[0].content).toBe('我先分析一下代码结构。');
    expect(result[0].id).toBe('db_1');
    expect(result[0].duration).toBe(1200);
  });

  it('非空 content 正常覆盖锚点消息', () => {
    const req = activeRequest({ assistantAnchorId: 'assistant_1' });
    const prev: Message[] = [assistantWithText()];

    const result = applyAssistantMessageToMessages(prev, req, {
      id: 'db_1',
      content: '我先分析一下代码结构。完整版。',
    });

    expect(result[0].content).toBe('我先分析一下代码结构。完整版。');
  });

  it('锚点不是 assistant 且 content 非空时插入新消息', () => {
    const toolMsg: Message = {
      id: 'tool_result_1',
      role: 'tool',
      content: 'ok',
      tool_call_id: 'call_1',
      turnId: 'turn_1',
      attemptNo: 1,
    };
    const req = activeRequest({ assistantAnchorId: 'tool_result_1', insertAfterId: 'tool_result_1' });

    const result = applyAssistantMessageToMessages([toolMsg], req, { content: '最终回答' });

    expect(result).toHaveLength(2);
    expect(result[1].role).toBe('assistant');
    expect(result[1].content).toBe('最终回答');
  });
});
