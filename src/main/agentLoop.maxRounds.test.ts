import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentLoopCallbacks } from '../shared/types';
import { ToolRegistry, type ToolExecutor } from './tools/types';

const mocks = vi.hoisted(() => ({
  runAnthropicRound: vi.fn(),
  runChatCompletionsRound: vi.fn(),
  runResponsesRound: vi.fn(),
}));

vi.mock('./agent-loop/anthropicRound', () => ({
  runAnthropicRound: mocks.runAnthropicRound,
}));
vi.mock('./agent-loop/chatCompletionsRound', () => ({
  runChatCompletionsRound: mocks.runChatCompletionsRound,
}));
vi.mock('./agent-loop/responsesRound', () => ({
  runResponsesRound: mocks.runResponsesRound,
}));

import { agentLoop } from './agentLoop';

describe('agentLoop maxToolRounds', () => {
  beforeEach(() => {
    mocks.runAnthropicRound.mockReset();
    mocks.runChatCompletionsRound.mockReset();
    mocks.runResponsesRound.mockReset();
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

  it.each([
    ['chat-completions', mocks.runChatCompletionsRound],
    ['responses', mocks.runResponsesRound],
  ] as const)('executes %s tool calls and pairs their results', async (protocol, roundMock) => {
    roundMock.mockImplementation(async ({ roundCount }: { roundCount: number }) => roundCount === 1
      ? {
          status: 'ok',
          assistantContent: '',
          reasoningContent: '',
          lastUsage: null,
          stopReason: 'tool_calls',
          chunkCount: 1,
          toolCalls: [{
            id: 'call-1',
            type: 'function',
            function: { name: 'test_tool', arguments: '{}' },
          }],
        }
      : {
          status: 'ok',
          assistantContent: 'done',
          reasoningContent: '',
          lastUsage: null,
          stopReason: 'end_turn',
          chunkCount: 1,
          toolCalls: [],
        });

    const execute = vi.fn(async () => ({ content: 'tool output' }));
    const registry = new ToolRegistry();
    registry.register({
      definition: {
        name: 'test_tool',
        description: 'Test tool',
        input_schema: { type: 'object', properties: {}, additionalProperties: false },
      },
      execute,
    });

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
        protocol,
        systemPrompt: 'test prompt',
        maxToolRounds: 2,
        approvalPolicy: 'auto-approve',
      },
    );

    expect(result).toBe('done');
    expect(execute).toHaveBeenCalledTimes(1);
    expect(roundMock).toHaveBeenCalledTimes(2);
    const secondRoundMessages = roundMock.mock.calls[1][0].pairedMessages;
    expect(secondRoundMessages).toEqual(expect.arrayContaining([
      expect.objectContaining({
        role: 'assistant',
        tool_calls: [expect.objectContaining({ id: 'call-1' })],
      }),
      expect.objectContaining({
        role: 'tool',
        tool_call_id: 'call-1',
        content: 'tool output',
      }),
    ]));
  });

  it('keeps persisted assistant transport errors out of provider history', async () => {
    mocks.runAnthropicRound.mockResolvedValue({
      status: 'ok',
      assistantContent: 'Recovered',
      reasoningContent: '',
      lastUsage: null,
      stopReason: 'end_turn',
      chunkCount: 1,
      toolCalls: [],
      providerContentBlocks: [{ type: 'text', text: 'Recovered' }],
    });

    const registry = new ToolRegistry();
    const callbacks: AgentLoopCallbacks = {
      onChunk: vi.fn(),
      onReasoningChunk: vi.fn(),
      onToolCallStart: vi.fn(),
      onToolCallEnd: vi.fn(),
      onDone: vi.fn(),
      onError: vi.fn(),
    };

    await agentLoop(
      [
        { id: 'user-1', role: 'user', content: 'Fix the issue' },
        { id: 'transport-error', role: 'assistant', content: 'HTTP 400 invalid_request_error', error: true },
        { id: 'user-2', role: 'user', content: 'Continue' },
      ],
      registry,
      callbacks,
      { apiKey: 'test-key', model: 'test-model', systemPrompt: '', approvalPolicy: 'auto-approve' },
    );

    const pairedMessages = mocks.runAnthropicRound.mock.calls[0][0].pairedMessages;
    expect(pairedMessages.some((message: { id: string }) => message.id === 'transport-error')).toBe(false);
  });

  it('continues a provider-managed server tool after pause_turn', async () => {
    mocks.runAnthropicRound
      .mockResolvedValueOnce({
        status: 'ok',
        assistantContent: '',
        reasoningContent: '',
        lastUsage: null,
        stopReason: 'pause_turn',
        chunkCount: 1,
        toolCalls: [],
        serverToolUses: [{ id: 'search_1', name: 'web_search', input: { query: 'DeepSeek docs' } }],
        providerContentBlocks: [
          { type: 'server_tool_use', id: 'search_1', name: 'web_search', input: { query: 'DeepSeek docs' } },
        ],
      })
      .mockResolvedValueOnce({
        status: 'ok',
        assistantContent: 'Search complete',
        reasoningContent: '',
        lastUsage: null,
        stopReason: 'end_turn',
        chunkCount: 1,
        toolCalls: [],
        providerContentBlocks: [{ type: 'text', text: 'Search complete' }],
      });

    const callbacks: AgentLoopCallbacks = {
      onChunk: vi.fn(),
      onReasoningChunk: vi.fn(),
      onToolCallStart: vi.fn(),
      onToolCallEnd: vi.fn(),
      onDone: vi.fn(),
      onError: vi.fn(),
      onAssistantMessage: vi.fn(),
    };

    const result = await agentLoop(
      [{ id: 'user-1', role: 'user', content: 'Search the web' }],
      new ToolRegistry(),
      callbacks,
      { apiKey: 'test-key', model: 'test-model', systemPrompt: '', approvalPolicy: 'auto-approve' },
    );

    expect(result).toBe('Search complete');
    expect(mocks.runAnthropicRound).toHaveBeenCalledTimes(2);
    const secondRoundMessages = mocks.runAnthropicRound.mock.calls[1][0].pairedMessages;
    expect(secondRoundMessages.some((message: { providerContentBlocks?: unknown[] }) => (
      message.providerContentBlocks?.[0] &&
      (message.providerContentBlocks[0] as { type?: string }).type === 'server_tool_use'
    ))).toBe(true);
  });
});
