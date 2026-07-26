import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentLoopCallbacks } from '../shared/types';
import { ToolRegistry, type ToolExecutor } from './tools/types';

const mocks = vi.hoisted(() => ({
  runAnthropicRound: vi.fn(),
}));

vi.mock('./agent-loop/anthropicRound', () => ({
  runAnthropicRound: mocks.runAnthropicRound,
}));

import { agentLoop } from './agentLoop';

describe('agentLoop maxToolRounds', () => {
  beforeEach(() => {
    mocks.runAnthropicRound.mockReset();
  });

  it('stops after executing the configured number of tool rounds', async () => {
    mocks.runAnthropicRound.mockImplementation(async ({ roundCount }: { roundCount: number }) => ({
      status: 'ok',
      assistantContent: `round-${roundCount}`,
      reasoningContent: '',
      lastUsage: null,
      stopReason: 'tool_use',
      chunkCount: 1,
      toolCalls: [{
        id: `tool-${roundCount}`,
        type: 'function',
        function: { name: 'test_tool', arguments: '{}' },
      }],
    }));

    const execute = vi.fn(async () => ({ content: 'ok' }));
    const tool: ToolExecutor = {
      definition: {
        name: 'test_tool',
        description: 'Test tool',
        input_schema: { type: 'object', properties: {}, additionalProperties: false },
      },
      execute,
    };
    const registry = new ToolRegistry();
    registry.register(tool);

    const callbacks: AgentLoopCallbacks = {
      onChunk: vi.fn(),
      onReasoningChunk: vi.fn(),
      onToolCallStart: vi.fn(),
      onToolCallEnd: vi.fn(),
      onDone: vi.fn(),
      onError: vi.fn(),
    };

    const result = await agentLoop(
      [{ id: 'user-1', role: 'user', content: 'run tools' }],
      registry,
      callbacks,
      {
        apiKey: 'test-key',
        model: 'test-model',
        systemPrompt: 'test prompt',
        maxToolRounds: 2,
        approvalPolicy: 'auto-approve',
      },
    );

    expect(result).toBe('round-2');
    expect(mocks.runAnthropicRound).toHaveBeenCalledTimes(2);
    expect(execute).toHaveBeenCalledTimes(2);
    expect(callbacks.onDone).toHaveBeenCalledWith('round-2');
  });
});
