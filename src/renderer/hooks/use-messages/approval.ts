import type { Message, PendingApprovalRequest, ToolItem } from '../../../shared/types';
import { keyForApproval, matchesSessionAllow } from '../../utils/approvalSession';
import type { ActiveRequest } from './types';

export function shouldAutoApproveApproval(approvalReq: PendingApprovalRequest): boolean {
  if (approvalReq.outOfScope || approvalReq.kind === 'ask_user_question') return false;
  return matchesSessionAllow(keyForApproval(approvalReq.kind, approvalReq.command));
}

function applyApprovalToItem(item: ToolItem, approvalReq: PendingApprovalRequest): ToolItem {
  return {
    ...item,
    status: 'awaiting_approval',
    approvalDescription: approvalReq.description,
    approvalDiffPreview: approvalReq.diffPreview,
    approvalOutOfScope: approvalReq.outOfScope,
    ...(approvalReq.kind === 'ask_user_question' && approvalReq.questions
      ? { questions: approvalReq.questions }
      : {}),
  } as ToolItem;
}

export function createFallbackToolItemFromApproval(approvalReq: PendingApprovalRequest): ToolItem {
  const base = {
    id: `ti_${approvalReq.toolCallId}`,
    toolCallId: approvalReq.toolCallId,
    status: 'awaiting_approval' as const,
    timestamp: Date.now(),
    approvalDescription: approvalReq.description,
    approvalDiffPreview: approvalReq.diffPreview,
    approvalOutOfScope: approvalReq.outOfScope,
  };

  switch (approvalReq.kind) {
    case 'ask_user_question':
      return {
        ...base,
        name: 'ask_user_question',
        kind: 'ask_user_question',
        questions: approvalReq.questions ?? [],
      };
    case 'bash_exec':
      return { ...base, name: 'bash_exec', kind: 'exec', command: approvalReq.command };
    case 'read_file':
      return {
        ...base,
        name: 'read_file',
        kind: 'read',
        path: approvalReq.outOfScope?.absolutePath ?? approvalReq.command,
      };
    case 'write_file':
      return {
        ...base,
        name: 'write_file',
        kind: 'write',
        path: approvalReq.outOfScope?.absolutePath ?? approvalReq.command,
      };
    case 'edit_file':
      return {
        ...base,
        name: 'edit_file',
        kind: 'edit',
        path: approvalReq.outOfScope?.absolutePath ?? approvalReq.command,
      };
    case 'grep':
      return { ...base, name: 'grep', kind: 'grep', pattern: approvalReq.command };
    case 'glob':
      return { ...base, name: 'glob', kind: 'glob', pattern: approvalReq.command };
    case 'web_search':
      return { ...base, name: 'web_search', kind: 'web_search', query: approvalReq.command };
    case 'web_fetch':
      return { ...base, name: 'web_fetch', kind: 'web_fetch', url: approvalReq.command };
    case 'external_tool':
      return {
        ...base,
        name: approvalReq.command || 'external_tool',
        kind: 'tool',
        toolName: approvalReq.command || 'external_tool',
        input: approvalReq.description ?? approvalReq.command,
      };
  }
}

export function applyApprovalToMessages(
  messages: Message[],
  approvalReq: PendingApprovalRequest,
  activeReq: ActiveRequest,
): Message[] {
  const updated = [...messages];
  for (let i = updated.length - 1; i >= 0; i--) {
    const msg = updated[i];
    if (msg.role !== 'assistant' || !msg.toolItems?.length) continue;
    const itemIdx = msg.toolItems.findIndex((ti) => ti.toolCallId === approvalReq.toolCallId);
    if (itemIdx === -1) continue;

    const newItems = [...msg.toolItems];
    newItems[itemIdx] = applyApprovalToItem(newItems[itemIdx], approvalReq);
    updated[i] = { ...msg, toolItems: newItems };
    return updated;
  }

  return appendApprovalFallback(updated, approvalReq, activeReq);
}

function appendApprovalFallback(
  messages: Message[],
  approvalReq: PendingApprovalRequest,
  activeReq: ActiveRequest,
): Message[] {
  const fallbackItem = createFallbackToolItemFromApproval(approvalReq);
  const assistantIndex = findLastAssistantIndex(messages);
  if (assistantIndex === -1) {
    return [
      ...messages,
      {
        id: `approval_holder_${approvalReq.toolCallId}`,
        role: 'assistant',
        content: '',
        toolItems: [fallbackItem],
        turnId: activeReq.turnId,
        attemptNo: activeReq.attemptNo,
      },
    ];
  }

  const updated = [...messages];
  const assistant = updated[assistantIndex];
  updated[assistantIndex] = {
    ...assistant,
    toolItems: [...(assistant.toolItems ?? []), fallbackItem],
  };
  return updated;
}

function findLastAssistantIndex(messages: Message[]): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'assistant') return i;
  }
  return -1;
}
