import { randomUUID } from 'node:crypto';
import type { Message, ToolCall } from '../../shared/types';
import { streamAnthropicMessages } from '../anthropicStreamClient';
import {
  MAX_STREAM_RETRIES,
  MAX_STREAM_RETRY_ATTEMPTS,
} from './constants';
import { convertMessagesToAnthropic, convertToolsToAnthropic } from './anthropicFormat';
import { getRetryDelayMs, getRetryReason, isRetryableStreamError } from './retry';
import { mergeAbortSignals, waitForAbortableDelay } from './signals';
import type { RoundRunnerParams, RoundRunnerResult } from './roundTypes';

const MAX_CACHE_BREAKPOINTS = 4;

export function applyCacheBreakpoints(
  systemBlocks: any[],
  messages: any[],
  tools: any[],
): void {
  let remaining = MAX_CACHE_BREAKPOINTS;
  const marked = new Set<object>();
  const mark = (value: unknown) => {
    if (!value || typeof value !== 'object' || remaining <= 0 || marked.has(value)) return;
    (value as any).cache_control = { type: 'ephemeral' };
    marked.add(value);
    remaining--;
  };
  const markLastContentBlock = (message: any) => {
    if (!message || !Array.isArray(message.content) || message.content.length === 0) return;
    mark(message.content[message.content.length - 1]);
  };

  mark(tools[tools.length - 1]);
  mark(systemBlocks[systemBlocks.length - 1]);
  markLastContentBlock(messages[0]);
  markLastContentBlock(messages[messages.length - 1]);
}

export async function runAnthropicRound(params: RoundRunnerParams): Promise<RoundRunnerResult> {
  const {
    pairedMessages,
    tools,
    model,
    baseUrl,
    reasoningEffort,
    signal,
    callbacks,
    config,
    roundStart,
    finalContent,
    log,
    logErr,
  } = params;

  let assistantContent = '';
  let reasoningContent = '';
  let lastUsage: any = null;
  let stopReason: string | undefined;
  let chunkCount = 0;
  let toolCalls: ToolCall[] = [];

  const { systemPrompt: combinedSystem, anthropicMessages } = convertMessagesToAnthropic(pairedMessages);
  const anthropicTools = convertToolsToAnthropic(tools);
  applyCacheBreakpoints(combinedSystem, anthropicMessages, anthropicTools);

  const requestParams: any = {
    model,
    max_tokens: 16384,
    messages: anthropicMessages,
  };

  if (combinedSystem.length > 0) {
    requestParams.system = combinedSystem;
  }

  if (anthropicTools.length > 0) {
    requestParams.tools = anthropicTools;
  }

  if (reasoningEffort) {
    requestParams.thinking = { type: 'enabled' };

    requestParams.output_config = { effort: reasoningEffort };

    requestParams.max_tokens = 32768;
  } else {
    requestParams.thinking = { type: 'disabled' };
  }
  const STREAM_IDLE_TIMEOUT_MS = 90_000;
  const idleController = new AbortController();
  const requestSignal = mergeAbortSignals(signal, idleController.signal);
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  const resetIdleTimer = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      log('⚠ Stream idle timeout (%ds); aborting automatically', STREAM_IDLE_TIMEOUT_MS / 1000);
      idleController.abort();
    }, STREAM_IDLE_TIMEOUT_MS);
  };

  let stream: AsyncGenerator<any> | undefined;
  for (let attempt = 0; attempt <= MAX_STREAM_RETRIES; attempt++) {
    try {
      stream = await streamAnthropicMessages({
        apiKey: config.apiKey,
        baseUrl,
        body: requestParams,
        signal: requestSignal,
      });
      break;
    } catch (err) {
      if (signal?.aborted) {
        log('⏹ Aborted while starting the request');
        break;
      }

      const e = err as any;
      const isRetryable = isRetryableStreamError(e, attempt);

      if (isRetryable) {
        const delay = getRetryDelayMs(attempt);
        const reason = getRetryReason(e);
      log(`⚠ Request failed (attempt ${attempt + 1}/${MAX_STREAM_RETRY_ATTEMPTS}); retrying in ${delay}ms: ${e.message}`);
        callbacks.onStreamRetry?.({
          attempt: attempt + 1,
          maxAttempts: MAX_STREAM_RETRY_ATTEMPTS,
          delayMs: delay,
          reason,
        });
        const completedDelay = await waitForAbortableDelay(delay, signal);
        if (!completedDelay) {
          log('⏹ Aborted while waiting to retry');
          break;
        }
        continue;
      }

      logErr(`✗ Request failed:`, e.message);
      callbacks.onError(e instanceof Error ? e : new Error(String(e)));
      return { status: 'return', finalContent };
    }
  }

  if (!stream) {

    return { status: 'break', finalContent };
  }

  const toolUseBlocks: Array<{ id: string; name: string; input: string }> = [];
  let currentBlockType: string | undefined;
  let currentBlockId = '';
  let currentBlockName = '';
  let currentBlockInput = '';

  resetIdleTimer();

  try {
    for await (const event of stream) {
      chunkCount++;
      resetIdleTimer();

      if (event.type === 'error') {
        const message = event.error?.message ?? event.message ?? JSON.stringify(event);
        throw new Error(`Anthropic stream error: ${message}`);
      }

      switch (event.type) {
        case 'message_start': {
          const msg = event.message;
          if (msg.usage) {
            lastUsage = {
              prompt_tokens: msg.usage.input_tokens,
              completion_tokens: msg.usage.output_tokens,
              total_tokens: msg.usage.input_tokens + msg.usage.output_tokens,

              prompt_cache_hit_tokens: msg.usage.cache_read_input_tokens ?? 0,
              prompt_cache_miss_tokens: Math.max(0, msg.usage.input_tokens - (msg.usage.cache_read_input_tokens ?? 0) - (msg.usage.cache_creation_input_tokens ?? 0)),
            };
          }
          break;
        }

        case 'content_block_start': {
          const block = event.content_block;
          if (block.type === 'text') {
            currentBlockType = 'text';
          } else if (block.type === 'tool_use') {
            currentBlockType = 'tool_use';
            currentBlockId = block.id;
            currentBlockName = block.name;
            currentBlockInput = '';
          } else if (block.type === 'thinking') {
            currentBlockType = 'thinking';
          }
          break;
        }

        case 'content_block_delta': {
          const delta = event.delta;
          if (delta.type === 'text_delta') {
            assistantContent += delta.text;
            callbacks.onChunk(delta.text);
          } else if (delta.type === 'thinking_delta') {
            reasoningContent += delta.thinking;
            callbacks.onReasoningChunk(delta.thinking);
          } else if (delta.type === 'input_json_delta') {
            currentBlockInput += delta.partial_json;
          }
          break;
        }

        case 'content_block_stop': {
          if (currentBlockType === 'tool_use') {
            toolUseBlocks.push({
              id: currentBlockId,
              name: currentBlockName,
              input: currentBlockInput,
            });
          }
          currentBlockType = undefined;
          break;
        }

        case 'message_delta': {
          const delta = event.delta;
          if (delta.stop_reason) {
            stopReason = delta.stop_reason;
          }
          if (event.usage) {
            const u = event.usage;
            lastUsage = {
              prompt_tokens: lastUsage?.prompt_tokens ?? 0,
              completion_tokens: u.output_tokens ?? lastUsage?.completion_tokens ?? 0,
              total_tokens: (lastUsage?.prompt_tokens ?? 0) + (u.output_tokens ?? 0),
              prompt_cache_hit_tokens: lastUsage?.prompt_cache_hit_tokens ?? 0,
              prompt_cache_miss_tokens: lastUsage?.prompt_cache_miss_tokens ?? 0,
            };
          }
          break;
        }

        case 'message_stop': {

          break;
        }
      }
    }
  } catch (err) {

    if (idleTimer) clearTimeout(idleTimer);

    if (idleController.signal.aborted && !signal?.aborted) {
      log(`⚠ Stream idle timeout; aborting | chunks received=${chunkCount} | output=${assistantContent.length} characters`);
      if (assistantContent || reasoningContent) {
        const partial: Message = {
          id: randomUUID(),
          role: 'assistant',
          content: assistantContent,
          usage: lastUsage,
          duration: Date.now() - roundStart,
          completed_at: Date.now(),
        };
        if (reasoningContent) partial.reasoning_content = reasoningContent;
        callbacks.onAssistantMessage?.(partial);
      }
      callbacks.onError(new Error(`Stream idle timeout (${STREAM_IDLE_TIMEOUT_MS / 1000}s without a response)`));
      return { status: 'return', finalContent: assistantContent };
    }

    if ((err as Error)?.name === 'AbortError' || signal?.aborted) {
      log(`⏹ Aborted while reading the stream | chunks received=${chunkCount} | output=${assistantContent.length} characters`);
      if (assistantContent || reasoningContent) {
        const partial: Message = {
          id: randomUUID(),
          role: 'assistant',
          content: assistantContent,
          usage: lastUsage,
          duration: Date.now() - roundStart,
          completed_at: Date.now(),
        };
        if (reasoningContent) partial.reasoning_content = reasoningContent;
        callbacks.onAssistantMessage?.(partial);
      }
      return { status: 'break', finalContent: assistantContent };
    }

    const e = err as Error & { cause?: { message?: string; code?: string } };
    const detail = [
      `chunks received=${chunkCount}`,
      `text output=${assistantContent.length} characters`,
      `reasoning output=${reasoningContent.length} characters`,
      `round duration=${Date.now() - roundStart}ms`,
      `cause=${e.cause?.message ?? 'N/A'}`,
    ].join(' | ');
    logErr(`✗ [Stream interrupted] ${e.name}: ${e.message} | ${detail}`);
    if (assistantContent || reasoningContent) {
      const partial: Message = {
        id: randomUUID(),
        role: 'assistant',
        content: assistantContent,
        usage: lastUsage,
        duration: Date.now() - roundStart,
        completed_at: Date.now(),
      };
      if (reasoningContent) partial.reasoning_content = reasoningContent;
      callbacks.onAssistantMessage?.(partial);
    }
    const surfaced = new Error(`[Stream interrupted] ${e.message} (${chunkCount} chunks received)`);
    callbacks.onError(surfaced);
    return { status: 'return', finalContent };
  }

  if (idleTimer) clearTimeout(idleTimer);

  toolCalls = toolUseBlocks.map((b) => ({
    id: b.id,
    type: 'function' as const,
    function: {
      name: b.name,
      arguments: b.input || '{}',
    },
  }));

  return {
    status: 'ok',
    assistantContent,
    reasoningContent,
    lastUsage,
    stopReason,
    chunkCount,
    toolCalls,
  };
}
