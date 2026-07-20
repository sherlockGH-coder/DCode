import { describe, expect, it } from 'vitest';
import type { Message, PendingApprovalRequest, ToolItem } from '../../shared/types';
import type { ActiveRequest } from './useMessages';
import { applyApprovalToMessages, createFallbackToolItemFromApproval } from './useMessages';

function activeRequest(): ActiveRequest {
  return {
    conversationId: 'conv_1',
    fullContent: '',
    fullReasoning: '',
    setMessages: () => undefined,
    turnId: 'turn_1',
    attemptNo: 1,
    placeholderId: 'placeholder_1',
  };
}

function bashApproval(): PendingApprovalRequest {
  return {
    toolCallId: 'call_bash',
    kind: 'bash_exec',
    command: 'echo ok',
    description: '测试 bash_exec 工具',
    cwd: '/tmp',
    conversationId: 'conv_1',
    turnId: 'turn_1',
    attemptNo: 1,
  };
}

describe('approval recovery', () => {
  it('creates a fallback approval item for generic tool approvals', () => {
    const item = createFallbackToolItemFromApproval(bashApproval());

    expect(item.kind).toBe('exec');
    expect(item.status).toBe('awaiting_approval');
    expect(item.name).toBe('bash_exec');
    expect(item.toolCallId).toBe('call_bash');
    expect(item.kind === 'exec' ? item.command : '').toBe('echo ok');
  });

  it('appends fallback UI when hot reload restores approval before tool item is rebuilt', () => {
    const messages = applyApprovalToMessages([], bashApproval(), activeRequest());

    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe('assistant');
    expect(messages[0].toolItems?.[0]?.status).toBe('awaiting_approval');
    expect(messages[0].toolItems?.[0]?.kind).toBe('exec');
  });

  it('updates an existing running tool item to awaiting approval', () => {
    const runningItem: ToolItem = {
      id: 'ti_call_bash',
      toolCallId: 'call_bash',
      name: 'bash_exec',
      kind: 'exec',
      status: 'running',
      timestamp: 1,
      command: 'echo ok',
    };
    const messages: Message[] = [{
      id: 'assistant_1',
      role: 'assistant',
      content: '',
      toolItems: [runningItem],
      turnId: 'turn_1',
      attemptNo: 1,
    }];

    const restored = applyApprovalToMessages(messages, bashApproval(), activeRequest());
    const restoredItem = restored[0].toolItems?.[0];

    expect(restoredItem?.status).toBe('awaiting_approval');
    expect(restoredItem?.approvalDescription).toBe('测试 bash_exec 工具');
  });
});
