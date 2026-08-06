import { randomUUID } from 'node:crypto';
import type { Message, ToolCall } from '../../shared/types';
import { streamOpenAI } from '../openaiStreamClient';
import {
  MAX_STREAM_RETRIES,
  MAX_STREAM_RETRY_ATTEMPTS,
} from './constants';
import { convertMessagesToChatCompletions, convertToolsToChatCompletions } from './openaiFormat';
import { getRetryDelayMs, getRetryReason, isRetryableStreamError } from './retry';
import { mergeAbortSignals, waitForAbortableDelay } from './signals';
import type { RoundRunnerParams, RoundRunnerResult } from './roundTypes';

const STREAM_IDLE_TIMEOUT_MS = 90_000;

interface PartialToolCall {
  id: string;
  name: string;
  arguments: string;
}

export async function runChatCompletionsRound(params: RoundRunnerParams): Promise<RoundRunnerResult> {
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

  const requestParams: Record<string, unknown> = {
    model,
    max_tokens: reasoningEffort ? 32768 : 16384,
    messages: convertMessagesToChatCompletions(pairedMessages),
    stream_options: { include_usage: true },
  };
  const chatTools = convertToolsToChatCompletions(tools);
  if (chatTools.length > 0) requestParams.tools = chatTools;
  if (reasoningEffort) requestParams.reasoning_effort = reasoningEffort;

  const idleController = new AbortController();
  const requestSignal = mergeAbortSignals(signal, idleController.signal);
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  const resetIdleTimer = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      log('⚠ Chat Completions stream idle timeout (%ds); aborting automatically', STREAM_IDLE_TIMEOUT_MS / 1000);
      idleController.abort();
    }, STREAM_IDLE_TIMEOUT_MS);
  };
  const clearIdleTimer = () => {
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = undefined;
    }
  };

  let stream: AsyncGenerator<any> | undefined;
  for (let attempt = 0; attempt <= MAX_STREAM_RETRIES; attempt++) {
    // Start the watchdog before fetch resolves. Some OpenAI-compatible gateways
    // do not send response headers until the model has produced its first token.
    resetIdleTimer();
    try {
      stream = await streamOpenAI({
        apiKey: config.apiKey,
        baseUrl,
        protocol: 'chat-completions',
        body: requestParams,
        signal: requestSignal,
      });
      // Give the body a full idle window after the response headers arrive.
      resetIdleTimer();
      break;
    } catch (err) {
      clearIdleTimer();
      if (signal?.aborted) {
        log('⏹ Aborted while starting Chat Completions request');
        break;
      }

      if (idleController.signal.aborted) {
        const timeoutError = new Error(`Chat Completions request timeout (${STREAM_IDLE_TIMEOUT_MS / 1000}s without a response)`);
        logErr('✗ Chat Completions request timed out:', timeoutError.message);
        callbacks.onError(timeoutError);
        return { status: 'return', finalContent };
      }

      const error = err as any;
      if (isRetryableStreamError(error, attempt)) {
        const delay = getRetryDelayMs(attempt);
        callbacks.onStreamRetry?.({
          attempt: attempt + 1,
          maxAttempts: MAX_STREAM_RETRY_ATTEMPTS,
          delayMs: delay,
          reason: getRetryReason(error),
        });
        const completedDelay = await waitForAbortableDelay(delay, signal);
        if (!completedDelay) {
          log('⏹ Aborted while waiting to retry Chat Completions request');
          break;
        }
        continue;
      }

      logErr('✗ Chat Completions request failed:', error?.message ?? error);
      callbacks.onError(error instanceof Error ? error : new Error(String(error)));
      return { status: 'return', finalContent };
    }
  }

  if (!stream) {
    clearIdleTimer();
    return { status: 'break', finalContent };
  }

  let assistantContent = '';
  let reasoningContent = '';
  let lastUsage: any = null;
  let stopReason: string | undefined;
  let chunkCount = 0;
  const partialToolCalls = new Map<number, PartialToolCall>();

  try {
    for await (const event of stream) {
      chunkCount++;
      resetIdleTimer();

      if (event?.error) {
        throw new Error(event.error.message ?? JSON.stringify(event.error));
      }

      if (event?.usage) lastUsage = normalizeChatUsage(event.usage);

      for (const choice of Array.isArray(event?.choices) ? event.choices : []) {
        if (choice.finish_reason) stopReason = choice.finish_reason;
        const delta = choice.delta ?? choice.message ?? {};

        if (typeof delta.content === 'string') {
          assistantContent += delta.content;
          callbacks.onChunk(delta.content);
        }

        const reasoning = extractReasoningDelta(delta);
        if (reasoning) {
          reasoningContent += reasoning;
          callbacks.onReasoningChunk(reasoning);
        }

        if (Array.isArray(delta.tool_calls)) {
          for (const toolDelta of delta.tool_calls) {
            const index = typeof toolDelta.index === 'number' ? toolDelta.index : partialToolCalls.size;
            const current = partialToolCalls.get(index) ?? { id: '', name: '', arguments: '' };
            if (typeof toolDelta.id === 'string') current.id = toolDelta.id;
            if (typeof toolDelta.function?.name === 'string') current.name += toolDelta.function.name;
            if (typeof toolDelta.function?.arguments === 'string') current.arguments += toolDelta.function.arguments;
            partialToolCalls.set(index, current);
          }
        }
      }
    }
  } catch (err) {
    clearIdleTimer();

    if (idleController.signal.aborted && !signal?.aborted) {
      log(`⚠ Chat Completions stream idle timeout; chunks received=${chunkCount}`);
      emitPartialAssistant(callbacks, assistantContent, reasoningContent, lastUsage, roundStart);
      callbacks.onError(new Error(`Stream idle timeout (${STREAM_IDLE_TIMEOUT_MS / 1000}s without a response)`));
      return { status: 'return', finalContent: assistantContent };
    }

    if ((err as Error)?.name === 'AbortError' || signal?.aborted) {
      log(`⏹ Aborted while reading Chat Completions stream; chunks received=${chunkCount}`);
      emitPartialAssistant(callbacks, assistantContent, reasoningContent, lastUsage, roundStart);
      return { status: 'break', finalContent: assistantContent };
    }

    const error = err as Error;
    logErr(`✗ Chat Completions stream interrupted: ${error.message}`);
    emitPartialAssistant(callbacks, assistantContent, reasoningContent, lastUsage, roundStart);
    callbacks.onError(new Error(`[Stream interrupted] ${error.message} (${chunkCount} chunks received)`));
    return { status: 'return', finalContent };
  }

  clearIdleTimer();

  const toolCalls: ToolCall[] = [...partialToolCalls.entries()]
    .sort(([left], [right]) => left - right)
    .map(([, toolCall]) => ({
      id: toolCall.id || randomUUID(),
      type: 'function' as const,
      function: {
        name: toolCall.name,
        arguments: toolCall.arguments || '{}',
      },
    }))
    .filter((toolCall) => toolCall.function.name.length > 0);

  if (toolCalls.length > 0 && !stopReason) stopReason = 'tool_calls';

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

function normalizeChatUsage(usage: any): Message['usage'] {
  const promptTokens = Number(usage?.prompt_tokens ?? 0);
  const completionTokens = Number(usage?.completion_tokens ?? 0);
  const cachedTokens = Number(usage?.prompt_tokens_details?.cached_tokens ?? 0);
  return {
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    total_tokens: Number(usage?.total_tokens ?? promptTokens + completionTokens),
    ...(cachedTokens > 0 ? {
      prompt_cache_hit_tokens: cachedTokens,
      prompt_cache_miss_tokens: Math.max(0, promptTokens - cachedTokens),
    } : {}),
  };
}

function extractReasoningDelta(delta: any): string {
  if (typeof delta?.reasoning_content === 'string') return delta.reasoning_content;
  if (typeof delta?.reasoning === 'string') return delta.reasoning;
  if (Array.isArray(delta?.reasoning_details)) {
    return delta.reasoning_details
      .map((detail: any) => typeof detail?.text === 'string' ? detail.text : '')
      .join('');
  }
  return '';
}

function emitPartialAssistant(
  callbacks: RoundRunnerParams['callbacks'],
  content: string,
  reasoning: string,
  usage: Message['usage'],
  roundStart: number,
): void {
  if (!content && !reasoning) return;
  const partial: Message = {
    id: randomUUID(),
    role: 'assistant',
    content,
    usage,
    duration: Date.now() - roundStart,
    completed_at: Date.now(),
  };
  if (reasoning) partial.reasoning_content = reasoning;
  callbacks.onAssistantMessage?.(partial);
}
