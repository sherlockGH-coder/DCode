import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentLoopCallbacks } from '../../shared/types';
import { ToolRegistry } from '../tools/types';
import { runChatCompletionsRound } from './chatCompletionsRound';
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
    onAssistantMessage: vi.fn(),
  };
}

function roundParams(callbackOverrides?: Partial<AgentLoopCallbacks>): RoundRunnerParams {
  const registry = new ToolRegistry();
  return {
    pairedMessages: [{ id: 'user-1', role: 'user', content: 'Read a file' }],
    tools: [{ name: 'read_file', description: 'Read a file', input_schema: { type: 'object' } }],
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

describe('runChatCompletionsRound', () => {
  beforeEach(() => {
    mocks.streamOpenAI.mockReset();
  });

  it('retries a transient startup failure and reports the retry to the UI', async () => {
    vi.useFakeTimers();
    try {
      const retryInfo = vi.fn();
      const transientError = Object.assign(new Error('upstream overloaded'), { status: 503 });
      mocks.streamOpenAI
        .mockRejectedValueOnce(transientError)
        .mockResolvedValueOnce((async function* () {
          yield { choices: [{ delta: { content: 'Recovered.' }, finish_reason: 'stop' }] };
        })());

      const resultPromise = runChatCompletionsRound(roundParams({ onStreamRetry: retryInfo }));
      await vi.advanceTimersByTimeAsync(1000);
      const result = await resultPromise;

      expect(result).toMatchObject({ status: 'ok', assistantContent: 'Recovered.', stopReason: 'stop' });
      expect(retryInfo).toHaveBeenCalledWith(expect.objectContaining({
        attempt: 1,
        maxAttempts: 4,
        reason: 'HTTP 503',
      }));
      expect(mocks.streamOpenAI).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('times out when the provider never returns response headers', async () => {
    vi.useFakeTimers();
    try {
      const onError = vi.fn();
      mocks.streamOpenAI.mockImplementation(({ signal }: { signal?: AbortSignal }) => new Promise((_, reject) => {
        signal?.addEventListener('abort', () => {
          const error = new Error('The operation was aborted');
          error.name = 'AbortError';
          reject(error);
        }, { once: true });
      }));

      const resultPromise = runChatCompletionsRound(roundParams({ onError }));
      await vi.advanceTimersByTimeAsync(90_000);
      const result = await resultPromise;

      expect(result).toMatchObject({ status: 'return' });
      expect(onError).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Chat Completions request timeout (90s without a response)',
      }));
    } finally {
      vi.useRealTimers();
    }
  });

  it('streams text and reasoning, assembles indexed tool-call deltas, and maps usage', async () => {
    mocks.streamOpenAI.mockResolvedValue((async function* () {
      yield { choices: [{ delta: { role: 'assistant', content: 'I will ' } }] };
      yield { choices: [{ delta: { reasoning_content: 'Need the file first.' } }] };
      yield { choices: [{ delta: { tool_calls: [{ index: 0, id: 'call-1', function: { name: 'read_file', arguments: '{"path":' } }] } }] };
      yield { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '"a.txt"}' } }] } }] };
      yield {
        choices: [{ delta: {}, finish_reason: 'tool_calls' }],
        usage: { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14, prompt_tokens_details: { cached_tokens: 3 } },
      };
    })());

    const result = await runChatCompletionsRound(roundParams());

    expect(result).toMatchObject({
      status: 'ok',
      assistantContent: 'I will ',
      reasoningContent: 'Need the file first.',
      stopReason: 'tool_calls',
      lastUsage: {
        prompt_tokens: 10,
        completion_tokens: 4,
        total_tokens: 14,
        prompt_cache_hit_tokens: 3,
        prompt_cache_miss_tokens: 7,
      },
      toolCalls: [{
        id: 'call-1',
        type: 'function',
        function: { name: 'read_file', arguments: '{"path":"a.txt"}' },
      }],
    });
    expect(mocks.streamOpenAI).toHaveBeenCalledWith(expect.objectContaining({
      protocol: 'chat-completions',
      body: expect.objectContaining({
        model: 'test-model',
        stream_options: { include_usage: true },
        tools: [{ type: 'function', function: expect.objectContaining({ name: 'read_file' }) }],
      }),
    }));
  });
});
