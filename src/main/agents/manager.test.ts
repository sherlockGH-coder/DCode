import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToolRegistry } from '../tools/types';
import type { Message } from '../../shared/types';

const mocks = vi.hoisted(() => {
  const conversations = new Map<string, any>();
  const messages = new Map<string, Message[]>();
  let conversationSeq = 0;

  return {
    conversations,
    messages,
    agentLoop: vi.fn(),
    resetDb: () => {
      conversations.clear();
      messages.clear();
      conversationSeq = 0;
    },
    createConversation: vi.fn((title: string, projectPath: string | null, source: string, _sourceJobId: string | null, options: any) => {
      conversationSeq += 1;
      const id = `conversation-${conversationSeq}`;
      conversations.set(id, {
        id,
        title,
        project_path: projectPath,
        source,
        ...options,
      });
      messages.set(id, []);
      return id;
    }),
    addMessage: vi.fn((conversationId: string, role: Message['role'], content: string | null) => {
      const next: Message = {
        id: `${conversationId}-${messages.get(conversationId)?.length ?? 0}`,
        role,
        content: content ?? '',
      };
      messages.set(conversationId, [...(messages.get(conversationId) ?? []), next]);
      return next.id;
    }),
    getMessages: vi.fn((conversationId: string) => messages.get(conversationId) ?? []),
    getConversationById: vi.fn((conversationId: string) => conversations.get(conversationId)),
    updateAgentConversationStatus: vi.fn((conversationId: string, status: string) => {
      const current = conversations.get(conversationId);
      if (current) conversations.set(conversationId, { ...current, agent_status: status });
    }),
  };
});

vi.mock('../agentLoop', () => ({
  agentLoop: mocks.agentLoop,
}));

vi.mock('../database', () => ({
  createConversation: mocks.createConversation,
  addMessage: mocks.addMessage,
  getMessages: mocks.getMessages,
  getConversationById: mocks.getConversationById,
  updateAgentConversationStatus: mocks.updateAgentConversationStatus,
}));

import { SubAgentManager, type SubAgentRuntime } from './manager';

function runtime(): SubAgentRuntime {
  return {
    apiKey: 'test-key',
    systemPrompt: 'system',
    conversationId: 'root-conversation',
    projectPath: '/project',
    toolRegistry: new ToolRegistry(),
  };
}

describe('SubAgentManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resetDb();
    mocks.agentLoop.mockReset();
    mocks.conversations.set('root-conversation', {
      id: 'root-conversation',
      root_conversation_id: null,
    });
  });

  it('spawns and waits for a read-only sub-agent run', async () => {
    mocks.agentLoop.mockImplementation(async (_messages, _toolRegistry, callbacks, _config) => {
      callbacks.onDone('agent result');
      return 'agent result';
    });

    const manager = new SubAgentManager();
    const summary = manager.spawn({ taskName: 'Inspect tools', prompt: 'Read tool code.' }, runtime());
    const waited = await manager.wait(summary.id, 100);

    expect(waited.timedOut).toBe(false);
    expect(waited.summary.status).toBe('completed');
    expect(waited.summary.result).toBe('agent result');
    const config = mocks.agentLoop.mock.calls[0][3];
    expect(config.subAgent).toBe(true);
    expect(config.toolAccessMode).toBe('subagent_readonly');
    expect(config.approvalPolicy).toBe('auto-deny');
  });

  it('builds a focused read-only task prompt for the sub-agent', () => {
    mocks.agentLoop.mockImplementation(() => new Promise(() => {}));

    const manager = new SubAgentManager();
    const summary = manager.spawn({
      taskName: 'Inspect tools',
      prompt: 'Read tool code.',
      role: 'test-scout',
      contextSummary: 'Previous tools were aligned with Claude Code.',
    }, runtime());
    const firstMessage = mocks.messages.get(summary.conversationId)?.[0];

    expect(firstMessage?.content).toContain('You are a read-only sub-agent');
    expect(firstMessage?.content).toContain('Task: Inspect tools');
    expect(firstMessage?.content).toContain('Specialty: test-scout');
    expect(firstMessage?.content).toContain('Context summary:');
    expect(firstMessage?.content).toContain('Do not ask the user questions or delegate to another agent.');
    expect(firstMessage?.content).toContain('cite relevant files, functions, or commands inspected');
  });

  it('enforces the concurrent run limit', () => {
    mocks.agentLoop.mockImplementation(() => new Promise(() => {}));

    const manager = new SubAgentManager({ maxConcurrent: 1 });
    manager.spawn({ taskName: 'First', prompt: 'Read A.' }, runtime());

    expect(() => {
      manager.spawn({ taskName: 'Second', prompt: 'Read B.' }, runtime());
    }).toThrow('Sub-agent concurrency limit reached');
  });

  it('closes a running agent', () => {
    mocks.agentLoop.mockImplementation(() => new Promise(() => {}));

    const manager = new SubAgentManager();
    const summary = manager.spawn({ taskName: 'Long read', prompt: 'Keep reading.' }, runtime());
    const closed = manager.close(summary.id);

    expect(closed.status).toBe('closed');
    expect(mocks.updateAgentConversationStatus).toHaveBeenCalledWith(summary.conversationId, 'closed');
  });

  it('stops waiting immediately when the parent request is aborted', async () => {
    mocks.agentLoop.mockImplementation(() => new Promise(() => {}));

    const manager = new SubAgentManager();
    const summary = manager.spawn({ taskName: 'Long read', prompt: 'Keep reading.' }, runtime());
    const controller = new AbortController();
    const waiting = manager.wait(summary.id, 60_000, controller.signal);
    controller.abort();

    await expect(waiting).rejects.toMatchObject({ name: 'AbortError' });
  });

});
