import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentRunSummary } from '../../shared/types';
import type { ToolExecutionContext } from './types';

const mocks = vi.hoisted(() => ({
  spawn: vi.fn(),
  wait: vi.fn(),
  sendInput: vi.fn(),
  list: vi.fn(),
  close: vi.fn(),
}));

vi.mock('../agents', () => ({
  subAgentManager: mocks,
}));

import {
  closeAgentTool,
  listAgentsTool,
  sendAgentInputTool,
  spawnAgentTool,
  waitAgentTool,
} from './agentTools';

function summary(patch: Partial<AgentRunSummary> = {}): AgentRunSummary {
  return {
    id: 'agent-1',
    conversationId: 'conversation-1',
    parentConversationId: 'root',
    rootConversationId: 'root',
    taskName: 'Inspect agent tools',
    role: 'test-scout',
    prompt: 'Read the agent tool implementation.',
    status: 'completed',
    result: 'agent result',
    createdAt: 1,
    updatedAt: 2,
    ...patch,
  };
}

function context(): ToolExecutionContext {
  return {
    projectPath: '/project',
    toolCallId: 'call_agent',
    agentRuntime: {
      apiKey: 'key',
      systemPrompt: 'system',
      projectPath: '/project',
      toolRegistry: {} as never,
    },
  };
}

describe('agent tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses concise Claude-style spawn schema', () => {
    expect(spawnAgentTool.definition.description).toContain('Delegate a focused read-only task');
    expect(spawnAgentTool.definition.description).toContain('run_in_background');

    const schema = spawnAgentTool.definition.input_schema as {
      properties: Record<string, Record<string, unknown>>;
      required: string[];
      additionalProperties?: boolean;
    };
    expect(schema.required).toEqual(['description', 'prompt']);
    expect(schema.properties.subagent_type.type).toBe('string');
    expect(schema.properties.run_in_background.default).toBe(false);
    expect(schema.properties.timeout_ms.default).toBe(180000);
    expect(schema.properties.timeout_ms.maximum).toBe(180000);
    expect(schema.additionalProperties).toBe(false);
  });

  it('spawns with description/subagent_type and waits by default', async () => {
    mocks.spawn.mockReturnValue(summary({ status: 'running', result: undefined }));
    mocks.wait.mockResolvedValue({ summary: summary(), timedOut: false });

    const result = await spawnAgentTool.execute({
      description: 'Inspect agent tools',
      prompt: 'Read the implementation.',
      subagent_type: 'test-scout',
      context_summary: 'We are aligning tools with Claude Code.',
      timeout_ms: 5000,
    }, context());

    expect(mocks.spawn).toHaveBeenCalledWith({
      taskName: 'Inspect agent tools',
      prompt: 'Read the implementation.',
      role: 'test-scout',
      contextSummary: 'We are aligning tools with Claude Code.',
    }, context().agentRuntime);
    expect(mocks.wait).toHaveBeenCalledWith('agent-1', 5000);
    expect(result.metadata).toMatchObject({
      kind: 'agent',
      action: 'spawn',
      agentId: 'agent-1',
      status: 'completed',
      result: 'agent result',
      timedOut: false,
    });
  });

  it('uses a longer default foreground wait and reports background continuation on timeout', async () => {
    mocks.spawn.mockReturnValue(summary({ status: 'running', result: undefined }));
    mocks.wait.mockResolvedValue({
      summary: summary({ status: 'running', result: undefined }),
      timedOut: true,
    });

    const result = await spawnAgentTool.execute({
      description: 'Inspect agent tools',
      prompt: 'Read the implementation.',
    }, context());

    expect(mocks.wait).toHaveBeenCalledWith('agent-1', 180000);
    expect(result.content).toContain('still running in background');
    expect(result.metadata).toMatchObject({
      kind: 'agent',
      action: 'spawn',
      agentId: 'agent-1',
      status: 'running',
      timedOut: true,
      result: 'Sub-agent is still running in background. Use wait_agent with agent_id "agent-1" to retrieve results.',
    });
  });

  it('returns immediately for background agents', async () => {
    mocks.spawn.mockReturnValue(summary({ status: 'running', result: undefined }));

    const result = await spawnAgentTool.execute({
      description: 'Long inspection',
      prompt: 'Read everything relevant.',
      run_in_background: true,
    }, context());

    expect(mocks.wait).not.toHaveBeenCalled();
    expect(result.content).toContain('Sub-agent started in background');
    expect(result.metadata).toMatchObject({
      kind: 'agent',
      action: 'spawn',
      agentId: 'agent-1',
      status: 'running',
    });
    expect(result.metadata).not.toMatchObject({ timedOut: true });
  });

  it('filters list_agents by status', async () => {
    mocks.list.mockReturnValue([
      summary({ id: 'agent-1', status: 'running' }),
      summary({ id: 'agent-2', status: 'completed' }),
    ]);

    const result = await listAgentsTool.execute({ status: 'running' }, context());

    expect(result.content).toContain('agent-1');
    expect(result.content).not.toContain('agent-2');
    expect(result.metadata).toMatchObject({
      kind: 'agent',
      action: 'list',
      agentIds: ['agent-1'],
    });
  });

  it('keeps management tool schemas strict', () => {
    for (const tool of [waitAgentTool, sendAgentInputTool, listAgentsTool, closeAgentTool]) {
      expect(tool.definition.input_schema.additionalProperties).toBe(false);
    }
  });
});
