import { randomUUID } from 'node:crypto';
import type { Message, ToolCall } from '../../shared/types';
import { buildAnthropicMessagesUrl, streamAnthropicMessages } from '../anthropicStreamClient';
import { logChatEvent } from '../logger';
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
    if (!value || typeof value !== 'object' || remaining <= 0 || marked.has(value as object)) return;
    (value as any).cache_control = { type: 'ephemeral' };
    marked.add(value as object);
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
    traceId,
    conversationId,
    roundCount,
    roundStart,
    finalContent,
    toolRegistry,
    toolCtx,
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

    (requestParams as any).output_config = { effort: reasoningEffort };

    requestParams.max_tokens = 32768;
  } else {
    requestParams.thinking = { type: 'disabled' };
  }
  const requestUrl = buildAnthropicMessagesUrl(baseUrl);

  logChatEvent('round_request', {
    traceId,
    conversationId,
    round: roundCount,
    url: requestUrl,
    model,
    maxTokens: requestParams.max_tokens,
    messageCount: anthropicMessages.length,
    systemBlockCount: combinedSystem.length,
    toolNames: anthropicTools.map((tool) => tool.name),
    thinkingEnabled: !!reasoningEffort,
  });

  const STREAM_IDLE_TIMEOUT_MS = 90_000;
  const idleController = new AbortController();
  const requestSignal = mergeAbortSignals(signal, idleController.signal);
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  const resetIdleTimer = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      log('⚠ 流空闲超时 (%ds)，自动中断', STREAM_IDLE_TIMEOUT_MS / 1000);
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
        log('⏹ 已中断（请求发起阶段）');
        break;
      }

      const e = err as any;
      const isRetryable = isRetryableStreamError(e, attempt);

      if (isRetryable) {
        const delay = getRetryDelayMs(attempt);
        const reason = getRetryReason(e);
        log(`⚠ 请求失败 (attempt ${attempt + 1}/${MAX_STREAM_RETRY_ATTEMPTS}), ${delay}ms 后重试: ${e.message}`);
        callbacks.onStreamRetry?.({
          attempt: attempt + 1,
          maxAttempts: MAX_STREAM_RETRY_ATTEMPTS,
          delayMs: delay,
          reason,
        });
        const completedDelay = await waitForAbortableDelay(delay, signal);
        if (!completedDelay) {
          log('⏹ 已中断（重试等待阶段）');
          break;
        }
        continue;
      }

      logErr(`✗ 请求失败:`, e.message);
      logChatEvent('error', {
        traceId,
        conversationId,
        round: roundCount,
        stage: 'fetch',
        message: e.message,
      });
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

              prompt_cache_hit_tokens: (msg.usage as any).cache_read_input_tokens ?? 0,
              prompt_cache_miss_tokens: Math.max(0, msg.usage.input_tokens - ((msg.usage as any).cache_read_input_tokens ?? 0) - ((msg.usage as any).cache_creation_input_tokens ?? 0)),
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
          const delta = event.delta as any;
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
          const delta = event.delta as any;
          if (delta.stop_reason) {
            stopReason = delta.stop_reason;
          }
          if ((event as any).usage) {
            const u = (event as any).usage;
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
      log(`⚠ 流空闲超时中断 | 已收 chunks=${chunkCount} | 已输出=${assistantContent.length}字`);
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
      callbacks.onError(new Error(`流空闲超时（${STREAM_IDLE_TIMEOUT_MS / 1000}s 无响应）`));
      return { status: 'return', finalContent: assistantContent };
    }

    if ((err as Error)?.name === 'AbortError' || signal?.aborted) {
      log(`⏹ 已中断（流式读取中）| 已收 chunks=${chunkCount} | 已输出=${assistantContent.length}字`);
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
      logChatEvent('round_response', {
        traceId,
        conversationId,
        round: roundCount,
        finishReason: stopReason ?? 'aborted',
        chunkCount,
        assistantContentLength: assistantContent.length,
        reasoningContentLength: reasoningContent.length,
        usage: lastUsage,
        aborted: true,
        durationMs: Date.now() - roundStart,
      });
      return { status: 'break', finalContent: assistantContent };
    }

    const e = err as Error & { cause?: { message?: string; code?: string } };
    const detail = [
      `已收到 chunks=${chunkCount}`,
      `已输出文本=${assistantContent.length}字`,
      `已输出思维=${reasoningContent.length}字`,
      `本轮耗时=${Date.now() - roundStart}ms`,
      `cause=${e.cause?.message ?? 'N/A'}`,
    ].join(' | ');
    logErr(`✗ [流式中断] ${e.name}: ${e.message} | ${detail}`);
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
    logChatEvent('error', {
      traceId,
      conversationId,
      round: roundCount,
      stage: 'stream',
      message: e.message,
      cause: e.cause?.message ?? null,
      eventName: (e as any).eventName ?? null,
      payloadLength: (e as any).payloadLength ?? null,
      chunkCount,
      assistantContentLength: assistantContent.length,
      reasoningContentLength: reasoningContent.length,
    });
    const surfaced = new Error(`[流式中断] ${e.message}（已接收 ${chunkCount} 个 chunk）`);
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
