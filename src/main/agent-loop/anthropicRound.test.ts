import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentLoopCallbacks } from '../../shared/types';
import { ToolRegistry } from '../tools/types';
import { runAnthropicRound } from './anthropicRound';
import type { RoundRunnerParams } from './roundTypes';

const mocks = vi.hoisted(() => ({
  streamAnthropicMessages: vi.fn(),
}));

vi.mock('../anthropicStreamClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../anthropicStreamClient')>();
  return {
    ...actual,
    streamAnthropicMessages: mocks.streamAnthropicMessages,
  };
});

function callbacks(): AgentLoopCallbacks {
  return {
    onChunk: () => undefined,
    onReasoningChunk: () => undefined,
    onToolCallStart: () => undefined,
    onToolCallEnd: () => undefined,
    onDone: () => undefined,
    onError: () => undefined,
  };
}

function roundParams(overrides: {
  tools?: any[];
  callbacks?: AgentLoopCallbacks;
  pairedMessages?: any[];
} = {}): RoundRunnerParams {
  const registry = new ToolRegistry();
  return {
    pairedMessages: overrides.pairedMessages ?? [{ id: 'user-1', role: 'user', content: 'Search the web' }],
    tools: overrides.tools ?? [],
    model: 'test-model',
    baseUrl: 'https://example.test',
    callbacks: overrides.callbacks ?? callbacks(),
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

describe('runAnthropicRound tool scheduling boundary', () => {
  beforeEach(() => {
    mocks.streamAnthropicMessages.mockReset();
  });

  it('does not execute a safe tool before the complete model tool sequence is known', async () => {
    const registry = new ToolRegistry();
    let readStarted = false;
    let readStartedBeforeWriteArrived = false;

    registry.register({
      definition: {
        name: 'read_file',
        description: 'Read a file',
        input_schema: { type: 'object', properties: {} },
      },
      isConcurrencySafe: true,
      execute: async () => {
        readStarted = true;
        return { content: 'old contents' };
      },
    });
    registry.register({
      definition: {
        name: 'edit_file',
        description: 'Edit a file',
        input_schema: { type: 'object', properties: {} },
      },
      isConcurrencySafe: false,
      execute: async () => ({ content: 'edited' }),
    });

    mocks.streamAnthropicMessages.mockResolvedValue((async function* () {
      yield { type: 'message_start', message: { usage: { input_tokens: 1, output_tokens: 0 } } };
      yield { type: 'content_block_start', content_block: { type: 'tool_use', id: 'read-1', name: 'read_file' } };
      yield { type: 'content_block_delta', delta: { type: 'input_json_delta', partial_json: '{}' } };
      yield { type: 'content_block_stop' };

      readStartedBeforeWriteArrived = readStarted;

      yield { type: 'content_block_start', content_block: { type: 'tool_use', id: 'edit-1', name: 'edit_file' } };
      yield { type: 'content_block_delta', delta: { type: 'input_json_delta', partial_json: '{}' } };
      yield { type: 'content_block_stop' };
      yield { type: 'message_delta', delta: { stop_reason: 'tool_use' }, usage: { output_tokens: 1 } };
      yield { type: 'message_stop' };
    })());

    const result = await runAnthropicRound({
      pairedMessages: [{ id: 'user-1', role: 'user', content: 'Update the file' }],
      tools: registry.getDefinitions(),
      model: 'test-model',
      baseUrl: 'https://example.test',
      callbacks: callbacks(),
      config: { apiKey: 'test-key', systemPrompt: '' },
      roundCount: 1,
      roundStart: Date.now(),
      finalContent: '',
      toolRegistry: registry,
      toolCtx: { projectPath: '/tmp/project', approvalPolicy: 'auto-approve' },
      log: () => undefined,
      logErr: () => undefined,
    });

    expect(result.status).toBe('ok');
    expect(readStartedBeforeWriteArrived).toBe(false);
    expect(readStarted).toBe(false);
  });

  it('captures server-side web search blocks and emits synthetic tool activity', async () => {
    const onToolCallStart = vi.fn();
    const onToolCallEnd = vi.fn();
    const searchInput = { query: 'DeepSeek Anthropic API web search' };
    const searchResult = {
      type: 'web_search_tool_result',
      tool_use_id: 'web-1',
      content: [
        {
          type: 'web_search_result',
          title: 'DeepSeek Docs',
          url: 'https://api-docs.deepseek.com',
          encrypted_content: 'opaque-result',
          page_age: null,
        },
      ],
    };

    mocks.streamAnthropicMessages.mockResolvedValue((async function* () {
      yield { type: 'message_start', message: { usage: { input_tokens: 1, output_tokens: 0 } } };
      yield { type: 'content_block_start', index: 0, content_block: { type: 'server_tool_use', id: 'web-1', name: 'web_search' } };
      yield { type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: JSON.stringify(searchInput) } };
      yield { type: 'content_block_stop', index: 0 };
      yield { type: 'content_block_start', index: 1, content_block: searchResult };
      yield { type: 'content_block_stop', index: 1 };
      yield { type: 'content_block_start', index: 2, content_block: { type: 'text', text: '' } };
      yield { type: 'content_block_delta', index: 2, delta: { type: 'text_delta', text: 'Here are the results.' } };
      yield { type: 'content_block_stop', index: 2 };
      yield { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 5 } };
      yield { type: 'message_stop' };
    })());

    const result = await runAnthropicRound(roundParams({
      callbacks: { ...callbacks(), onToolCallStart, onToolCallEnd },
    }));

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.stopReason).toBe('end_turn');
    expect(result.toolCalls).toEqual([]);
    expect(result.serverToolUses).toEqual([{ id: 'web-1', name: 'web_search', input: searchInput }]);
    expect(result.providerContentBlocks).toEqual([
      { type: 'server_tool_use', id: 'web-1', name: 'web_search', input: searchInput },
      searchResult,
      { type: 'text', text: 'Here are the results.' },
    ]);
    expect(result.assistantContent).toBe('Here are the results.');
    expect(onToolCallStart).toHaveBeenCalledWith(expect.objectContaining({
      id: 'web-1',
      serverTool: true,
      function: { name: 'web_search', arguments: JSON.stringify(searchInput) },
    }));
    expect(onToolCallEnd).toHaveBeenCalledWith(expect.objectContaining({
      tool_call_id: 'web-1',
      name: 'web_search',
      metadata: { kind: 'web_search', query: searchInput.query, resultCount: 1 },
      serverTool: true,
    }));
  });

  it('emits the tool completion for inline search results on server_tool_use (Anthropic-native format)', async () => {
    const onToolCallStart = vi.fn();
    const onToolCallEnd = vi.fn();
    const inlineInput = {
      query: 'DeepSeek docs',
      search_result: [
        {
          type: 'web_search_result',
          title: 'DeepSeek Docs',
          url: 'https://api-docs.deepseek.com',
          content: 'Documentation',
        },
      ],
    };

    mocks.streamAnthropicMessages.mockResolvedValue((async function* () {
      yield { type: 'message_start', message: { usage: { input_tokens: 1, output_tokens: 0 } } };
      yield { type: 'content_block_start', index: 0, content_block: { type: 'server_tool_use', id: 'web-1', name: 'web_search' } };
      yield { type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: JSON.stringify(inlineInput) } };
      yield { type: 'content_block_stop', index: 0 };
      yield { type: 'content_block_start', index: 1, content_block: { type: 'text', text: '' } };
      yield { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: 'Here are the results.' } };
      yield { type: 'content_block_stop', index: 1 };
      yield { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 5 } };
      yield { type: 'message_stop' };
    })());

    const result = await runAnthropicRound(roundParams({
      callbacks: { ...callbacks(), onToolCallStart, onToolCallEnd },
    }));

    expect(result.status).toBe('ok');
    expect(onToolCallStart).toHaveBeenCalledTimes(1);
    expect(onToolCallEnd).toHaveBeenCalledTimes(1);
    expect(onToolCallEnd).toHaveBeenCalledWith(expect.objectContaining({
      tool_call_id: 'web-1',
      name: 'web_search',
      metadata: { kind: 'web_search', query: 'DeepSeek docs', resultCount: 1 },
      serverTool: true,
    }));
  });

  it('does not emit a duplicate tool completion when both inline results and a result block arrive', async () => {
    const onToolCallEnd = vi.fn();
    const inlineInput = {
      query: 'DeepSeek docs',
      search_result: [
        {
          type: 'web_search_result',
          title: 'DeepSeek Docs',
          url: 'https://api-docs.deepseek.com',
          content: 'Documentation',
        },
      ],
    };
    const resultBlock = {
      type: 'web_search_tool_result',
      tool_use_id: 'web-1',
      content: [
        {
          type: 'web_search_result',
          title: 'DeepSeek Docs',
          url: 'https://api-docs.deepseek.com',
          encrypted_content: 'opaque-result',
        },
      ],
    };

    mocks.streamAnthropicMessages.mockResolvedValue((async function* () {
      yield { type: 'message_start', message: { usage: { input_tokens: 1, output_tokens: 0 } } };
      yield { type: 'content_block_start', index: 0, content_block: { type: 'server_tool_use', id: 'web-1', name: 'web_search' } };
      yield { type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: JSON.stringify(inlineInput) } };
      yield { type: 'content_block_stop', index: 0 };
      yield { type: 'content_block_start', index: 1, content_block: resultBlock };
      yield { type: 'content_block_stop', index: 1 };
      yield { type: 'message_stop' };
    })());

    await runAnthropicRound(roundParams({
      callbacks: { ...callbacks(), onToolCallEnd },
    }));

    expect(onToolCallEnd).toHaveBeenCalledTimes(1);
    expect(onToolCallEnd).toHaveBeenCalledWith(expect.objectContaining({
      tool_call_id: 'web-1',
      metadata: { kind: 'web_search', query: 'DeepSeek docs', resultCount: 1 },
    }));
  });

  it('completes a web search whose result content arrives after content_block_start', async () => {
    const onToolCallEnd = vi.fn();
    const resultContent = [
      {
        type: 'web_search_result',
        title: 'DeepSeek Docs',
        url: 'https://api-docs.deepseek.com',
        encrypted_content: 'opaque-result',
      },
    ];

    mocks.streamAnthropicMessages.mockResolvedValue((async function* () {
      yield { type: 'message_start', message: { usage: { input_tokens: 1, output_tokens: 0 } } };
      yield { type: 'content_block_start', index: 0, content_block: { type: 'server_tool_use', id: 'web-1', name: 'web_search' } };
      yield { type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: '{"query":"DeepSeek docs"}' } };
      yield { type: 'content_block_stop', index: 0 };
      yield { type: 'content_block_start', index: 1, content_block: { type: 'web_search_tool_result', tool_use_id: 'web-1' } };
      yield { type: 'content_block_delta', index: 1, delta: { type: 'input_json_delta', partial_json: JSON.stringify(resultContent) } };
      yield { type: 'content_block_stop', index: 1 };
      yield { type: 'message_stop' };
    })());

    await runAnthropicRound(roundParams({
      callbacks: { ...callbacks(), onToolCallEnd },
    }));

    expect(onToolCallEnd).toHaveBeenCalledTimes(1);
    expect(onToolCallEnd).toHaveBeenCalledWith(expect.objectContaining({
      tool_call_id: 'web-1',
      metadata: { kind: 'web_search', query: 'DeepSeek docs', resultCount: 1 },
    }));
  });
});
