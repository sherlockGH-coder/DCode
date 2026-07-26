import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentLoopCallbacks } from '../../shared/types';
import { ToolRegistry } from '../tools/types';
import { runAnthropicRound } from './anthropicRound';

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
});
