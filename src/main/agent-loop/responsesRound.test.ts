import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentLoopCallbacks } from '../../shared/types';
import { ToolRegistry } from '../tools/types';
import { runResponsesRound } from './responsesRound';
import type { RoundRunnerParams } from './roundTypes';

const mocks = vi.hoisted(() => ({
  streamOpenAI: vi.fn(),
}));

vi.mock('../openaiStreamClient', async (importOriginal) => ({
  ...await importOriginal<typeof import('../openaiStreamClient')>(),
  streamOpenAI: mocks.streamOpenAI,
}));

function callbacks(): AgentLoopCallbacks {
  return {
    onChunk: vi.fn(),
    onReasoningChunk: vi.fn(),
    onToolCallStart: vi.fn(),
    onToolCallEnd: vi.fn(),
    onDone: vi.fn(),
    onError: vi.fn(),
  };
}

function roundParams(callbackOverrides?: Partial<AgentLoopCallbacks>): RoundRunnerParams {
  const registry = new ToolRegistry();
  return {
    pairedMessages: [{ id: 'user-1', role: 'user', content: 'Read a file and search the web' }],
    tools: [
      { name: 'read_file', description: 'Read a file', input_schema: { type: 'object' } },
      { name: 'web_search', description: 'Search the web', input_schema: {}, serverTool: true },
    ],
    model: 'test-model',
    baseUrl: 'https://example.test',
    callbacks: { ...callbacks(), ...callbackOverrides },
    config: { apiKey: 'test-key', systemPrompt: '' },
    roundCount: 1,
    roundStart: Date.now(),
    finalContent: '',
    toolRegistry: registry,
    toolCtx: { projectPath: '/tmp/project', approvalPolicy: 'auto-approve' },
    log: () => undefined,
    logErr: () => undefined,
  };
}

describe('runResponsesRound', () => {
  beforeEach(() => {
    mocks.streamOpenAI.mockReset();
  });

  it('handles native web search, streamed function arguments, output persistence, and usage', async () => {
    const onToolCallStart = vi.fn();
    const onToolCallEnd = vi.fn();
    mocks.streamOpenAI.mockResolvedValue((async function* () {
      yield {
        type: 'response.output_item.added',
        output_index: 0,
        item: { type: 'web_search_call', id: 'search-1', action: { type: 'search', query: 'OpenAI docs' } },
      };
      yield {
        type: 'response.web_search_call.completed',
        item_id: 'search-1',
      };
      yield {
        type: 'response.output_item.added',
        output_index: 1,
        item: { type: 'function_call', id: 'item-1', call_id: 'call-1', name: 'read_file', arguments: '' },
      };
      yield { type: 'response.function_call_arguments.delta', output_index: 1, item_id: 'item-1', delta: '{"path":' };
      yield { type: 'response.function_call_arguments.delta', output_index: 1, item_id: 'item-1', delta: '"a.txt"}' };
      yield { type: 'response.function_call_arguments.done', output_index: 1, item_id: 'item-1', name: 'read_file', arguments: '{"path":"a.txt"}' };
      yield { type: 'response.output_text.delta', output_index: 2, delta: 'I found it.' };
      yield {
        type: 'response.completed',
        response: {
          status: 'completed',
          usage: { input_tokens: 20, output_tokens: 8, total_tokens: 28, input_tokens_details: { cached_tokens: 5 } },
          output: [
            { type: 'web_search_call', id: 'search-1', action: { type: 'search', query: 'OpenAI docs' } },
            { type: 'function_call', id: 'item-1', call_id: 'call-1', name: 'read_file', arguments: '{"path":"a.txt"}' },
            { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'I found it.', annotations: [] }] },
          ],
        },
      };
    })());

    const result = await runResponsesRound(roundParams({ onToolCallStart, onToolCallEnd }));

    expect(result).toMatchObject({
      status: 'ok',
      assistantContent: 'I found it.',
      stopReason: 'tool_calls',
      lastUsage: {
        prompt_tokens: 20,
        completion_tokens: 8,
        total_tokens: 28,
        prompt_cache_hit_tokens: 5,
        prompt_cache_miss_tokens: 15,
      },
      toolCalls: [{ id: 'call-1', function: { name: 'read_file', arguments: '{"path":"a.txt"}' } }],
      serverToolUses: [{ id: 'search-1', name: 'web_search', input: { type: 'search', query: 'OpenAI docs' } }],
    });
    if (result.status !== 'ok') throw new Error('Expected an OK Responses round result');
    expect(result.providerContentBlocks).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'function_call', call_id: 'call-1' }),
      expect.objectContaining({ type: 'message' }),
    ]));
    expect(onToolCallStart).toHaveBeenCalledWith(expect.objectContaining({ id: 'search-1', serverTool: true }));
    expect(onToolCallEnd).toHaveBeenCalledWith(expect.objectContaining({
      tool_call_id: 'search-1',
      serverTool: true,
      metadata: { kind: 'web_search', query: 'OpenAI docs', resultCount: 0 },
    }));
    expect(mocks.streamOpenAI).toHaveBeenCalledWith(expect.objectContaining({
      protocol: 'responses',
      body: expect.objectContaining({
        tools: [
          { type: 'function', name: 'read_file', description: 'Read a file', parameters: { type: 'object' } },
          { type: 'web_search_preview' },
        ],
      }),
    }));
  });
});
