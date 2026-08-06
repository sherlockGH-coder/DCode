import { randomUUID } from 'node:crypto';
import type { Message, ProviderContentBlock, ServerToolUse, ToolCall } from '../../shared/types';
import { streamOpenAI } from '../openaiStreamClient';
import {
  MAX_STREAM_RETRIES,
  MAX_STREAM_RETRY_ATTEMPTS,
} from './constants';
import { convertMessagesToResponses, convertToolsToResponses } from './openaiFormat';
import { getRetryDelayMs, getRetryReason, isRetryableStreamError } from './retry';
import { mergeAbortSignals, waitForAbortableDelay } from './signals';
import type { RoundRunnerParams, RoundRunnerResult } from './roundTypes';

const STREAM_IDLE_TIMEOUT_MS = 90_000;

interface PartialFunctionCall {
  id: string;
  callId: string;
  name: string;
  arguments: string;
}

export async function runResponsesRound(params: RoundRunnerParams): Promise<RoundRunnerResult> {
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

  const converted = convertMessagesToResponses(pairedMessages);
  const responseTools = convertToolsToResponses(tools);
  const requestParams: Record<string, unknown> = {
    model,
    input: converted.input,
    max_output_tokens: reasoningEffort ? 32768 : 16384,
  };
  if (converted.instructions) requestParams.instructions = converted.instructions;
  if (responseTools.length > 0) requestParams.tools = responseTools;
  if (reasoningEffort) requestParams.reasoning = { effort: reasoningEffort };

  const idleController = new AbortController();
  const requestSignal = mergeAbortSignals(signal, idleController.signal);
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  const resetIdleTimer = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      log('⚠ Responses stream idle timeout (%ds); aborting automatically', STREAM_IDLE_TIMEOUT_MS / 1000);
      idleController.abort();
    }, STREAM_IDLE_TIMEOUT_MS);
  };

  let stream: AsyncGenerator<any> | undefined;
  for (let attempt = 0; attempt <= MAX_STREAM_RETRIES; attempt++) {
    try {
      stream = await streamOpenAI({
        apiKey: config.apiKey,
        baseUrl,
        protocol: 'responses',
        body: requestParams,
        signal: requestSignal,
      });
      break;
    } catch (err) {
      if (signal?.aborted) {
        log('⏹ Aborted while starting Responses request');
        break;
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
          log('⏹ Aborted while waiting to retry Responses request');
          break;
        }
        continue;
      }

      logErr('✗ Responses request failed:', error?.message ?? error);
      callbacks.onError(error instanceof Error ? error : new Error(String(error)));
      return { status: 'return', finalContent };
    }
  }

  if (!stream) return { status: 'break', finalContent };

  let assistantContent = '';
  let reasoningContent = '';
  let lastUsage: Message['usage'] | null = null;
  let stopReason: string | undefined;
  let chunkCount = 0;
  const providerBlockMap = new Map<number, ProviderContentBlock>();
  const functionCalls = new Map<number, PartialFunctionCall>();
  const serverToolUses: ServerToolUse[] = [];
  const serverToolUseById = new Map<string, ServerToolUse>();
  const completedServerToolIds = new Set<string>();

  const emitServerToolStart = (item: any) => {
    const id = typeof item?.call_id === 'string' ? item.call_id : typeof item?.id === 'string' ? item.id : '';
    if (!id || serverToolUseById.has(id)) return;
    const input = extractServerToolInput(item);
    const use: ServerToolUse = { id, name: 'web_search', input };
    serverToolUseById.set(id, use);
    serverToolUses.push(use);
    callbacks.onToolCallStart?.({
      id,
      type: 'function',
      serverTool: true,
      function: { name: 'web_search', arguments: JSON.stringify(input) },
    });
  };

  const emitServerToolEnd = (id: string, resultCount = 0) => {
    if (!id || completedServerToolIds.has(id)) return;
    completedServerToolIds.add(id);
    const use = serverToolUseById.get(id);
    callbacks.onToolCallEnd?.({
      tool_call_id: id,
      name: use?.name ?? 'web_search',
      content: resultCount > 0
        ? `Web search completed (${resultCount} citation${resultCount === 1 ? '' : 's'})`
        : 'Web search completed.',
      metadata: {
        kind: 'web_search',
        query: typeof use?.input.query === 'string' ? use.input.query : '',
        resultCount,
      },
      serverTool: true,
    });
  };

  resetIdleTimer();
  try {
    for await (const event of stream) {
      chunkCount++;
      resetIdleTimer();

      if (event?.type === 'error' || event?.error) {
        const message = event?.message ?? event?.error?.message ?? JSON.stringify(event);
        throw new Error(`Responses stream error: ${message}`);
      }

      switch (event?.type) {
        case 'response.output_item.added': {
          const index = getOutputIndex(event, providerBlockMap.size);
          const item = event.item as ProviderContentBlock | undefined;
          if (item) {
            providerBlockMap.set(index, { ...item });
            handleOutputItem(item, index, functionCalls, emitServerToolStart);
          }
          break;
        }

        case 'response.output_item.done': {
          const index = getOutputIndex(event, providerBlockMap.size);
          const item = event.item as ProviderContentBlock | undefined;
          if (item) {
            providerBlockMap.set(index, { ...item });
            handleOutputItem(item, index, functionCalls, emitServerToolStart);
            if (item.type === 'web_search_call') {
              emitServerToolEnd(getServerToolId(item), countCitations(item));
            }
          }
          break;
        }

        case 'response.output_text.delta':
          if (typeof event.delta === 'string') {
            assistantContent += event.delta;
            callbacks.onChunk(event.delta);
          }
          break;

        case 'response.reasoning_text.delta':
        case 'response.reasoning_summary_text.delta':
          if (typeof event.delta === 'string') {
            reasoningContent += event.delta;
            callbacks.onReasoningChunk(event.delta);
          }
          break;

        case 'response.function_call_arguments.delta': {
          const index = getOutputIndex(event, functionCalls.size);
          const current = functionCalls.get(index) ?? {
            id: typeof event.item_id === 'string' ? event.item_id : randomUUID(),
            callId: '',
            name: '',
            arguments: '',
          };
          current.arguments += typeof event.delta === 'string' ? event.delta : '';
          functionCalls.set(index, current);
          const block = providerBlockMap.get(index);
          if (block) block.arguments = current.arguments;
          break;
        }

        case 'response.function_call_arguments.done': {
          const index = getOutputIndex(event, functionCalls.size);
          const current = functionCalls.get(index) ?? {
            id: typeof event.item_id === 'string' ? event.item_id : randomUUID(),
            callId: '',
            name: '',
            arguments: '',
          };
          if (typeof event.arguments === 'string') current.arguments = event.arguments;
          if (typeof event.name === 'string') current.name = event.name;
          functionCalls.set(index, current);
          const block = providerBlockMap.get(index);
          if (block) {
            block.arguments = current.arguments;
            if (current.name) block.name = current.name;
          }
          break;
        }

        case 'response.web_search_call.in_progress':
        case 'response.web_search_call.searching':
          emitServerToolStart({ id: event.item_id, action: event.action });
          break;

        case 'response.web_search_call.completed':
          emitServerToolStart({ id: event.item_id, action: event.action });
          emitServerToolEnd(event.item_id, countCitations(event));
          break;

        case 'response.completed': {
          const response = event.response ?? {};
          stopReason = response.status === 'incomplete'
            ? response.incomplete_details?.reason ?? 'incomplete'
            : response.status ?? 'completed';
          if (response.usage) lastUsage = normalizeResponsesUsage(response.usage);
          if (Array.isArray(response.output)) {
            for (let i = 0; i < response.output.length; i++) {
              const item = response.output[i] as ProviderContentBlock;
              providerBlockMap.set(i, { ...item });
              handleOutputItem(item, i, functionCalls, emitServerToolStart);
              if (item.type === 'web_search_call') {
                emitServerToolEnd(getServerToolId(item), countCitations(item));
              }
            }
          }
          break;
        }

        case 'response.incomplete':
          stopReason = event.response?.incomplete_details?.reason ?? 'incomplete';
          break;
      }
    }
  } catch (err) {
    if (idleTimer) clearTimeout(idleTimer);

    if (idleController.signal.aborted && !signal?.aborted) {
      log(`⚠ Responses stream idle timeout; chunks received=${chunkCount}`);
      emitPartialAssistant(callbacks, assistantContent, reasoningContent, lastUsage, roundStart);
      callbacks.onError(new Error(`Stream idle timeout (${STREAM_IDLE_TIMEOUT_MS / 1000}s without a response)`));
      return { status: 'return', finalContent: assistantContent };
    }

    if ((err as Error)?.name === 'AbortError' || signal?.aborted) {
      log(`⏹ Aborted while reading Responses stream; chunks received=${chunkCount}`);
      emitPartialAssistant(callbacks, assistantContent, reasoningContent, lastUsage, roundStart);
      return { status: 'break', finalContent: assistantContent };
    }

    const error = err as Error;
    logErr(`✗ Responses stream interrupted: ${error.message}`);
    emitPartialAssistant(callbacks, assistantContent, reasoningContent, lastUsage, roundStart);
    callbacks.onError(new Error(`[Stream interrupted] ${error.message} (${chunkCount} chunks received)`));
    return { status: 'return', finalContent };
  }

  if (idleTimer) clearTimeout(idleTimer);

  const providerContentBlocks = [...providerBlockMap.entries()]
    .sort(([left], [right]) => left - right)
    .map(([, block]) => block);

  if (!assistantContent) {
    const finalText = extractOutputText(providerContentBlocks);
    if (finalText) {
      assistantContent = finalText;
      callbacks.onChunk(finalText);
    }
  }
  if (!reasoningContent) {
    reasoningContent = extractReasoningText(providerContentBlocks);
    if (reasoningContent) callbacks.onReasoningChunk(reasoningContent);
  }

  const toolCalls: ToolCall[] = [...functionCalls.entries()]
    .sort(([left], [right]) => left - right)
    .map(([, functionCall]) => ({
      id: functionCall.callId || functionCall.id || randomUUID(),
      type: 'function' as const,
      function: {
        name: functionCall.name,
        arguments: functionCall.arguments || '{}',
      },
    }))
    .filter((toolCall) => toolCall.function.name.length > 0);

  if (toolCalls.length > 0) stopReason = 'tool_calls';

  return {
    status: 'ok',
    assistantContent,
    reasoningContent,
    lastUsage,
    stopReason,
    chunkCount,
    toolCalls,
    serverToolUses,
    providerContentBlocks,
  };
}

function getOutputIndex(event: any, fallback: number): number {
  return typeof event?.output_index === 'number'
    ? event.output_index
    : fallback;
}

function handleOutputItem(
  item: ProviderContentBlock,
  index: number,
  functionCalls: Map<number, PartialFunctionCall>,
  onServerTool: (item: ProviderContentBlock) => void,
): void {
  if (item.type === 'function_call') {
    const current = functionCalls.get(index) ?? {
      id: typeof item.id === 'string' ? item.id : randomUUID(),
      callId: typeof item.call_id === 'string' ? item.call_id : '',
      name: '',
      arguments: '',
    };
    if (typeof item.id === 'string') current.id = item.id;
    if (typeof item.call_id === 'string') current.callId = item.call_id;
    if (typeof item.name === 'string') current.name = item.name;
    if (typeof item.arguments === 'string') current.arguments = item.arguments;
    functionCalls.set(index, current);
  } else if (item.type === 'web_search_call') {
    onServerTool(item);
  }
}

function extractServerToolInput(item: any): Record<string, unknown> {
  const action = item?.action;
  if (action && typeof action === 'object') return { ...(action as Record<string, unknown>) };
  return {};
}

function getServerToolId(item: any): string {
  return typeof item?.call_id === 'string' ? item.call_id : typeof item?.id === 'string' ? item.id : '';
}

function countCitations(item: any): number {
  const annotations = Array.isArray(item?.annotations) ? item.annotations : [];
  if (annotations.length > 0) return annotations.length;
  const content = Array.isArray(item?.content) ? item.content : [];
  return content.reduce((count: number, part: any) => count + (Array.isArray(part?.annotations) ? part.annotations.length : 0), 0);
}

function normalizeResponsesUsage(usage: any): Message['usage'] {
  const promptTokens = Number(usage?.input_tokens ?? 0);
  const completionTokens = Number(usage?.output_tokens ?? 0);
  const cachedTokens = Number(usage?.input_tokens_details?.cached_tokens ?? 0);
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

function extractOutputText(blocks: ProviderContentBlock[]): string {
  const texts: string[] = [];
  for (const block of blocks) {
    if (block.type !== 'message' || !Array.isArray(block.content)) continue;
    for (const part of block.content) {
      if (part?.type === 'output_text' && typeof part.text === 'string') texts.push(part.text);
    }
  }
  return texts.join('');
}

function extractReasoningText(blocks: ProviderContentBlock[]): string {
  const texts: string[] = [];
  for (const block of blocks) {
    if (block.type !== 'reasoning') continue;
    const summary = Array.isArray(block.summary) ? block.summary : [];
    for (const part of summary) {
      if (typeof part?.text === 'string') texts.push(part.text);
    }
  }
  return texts.join('');
}

function emitPartialAssistant(
  callbacks: RoundRunnerParams['callbacks'],
  content: string,
  reasoning: string,
  usage: Message['usage'] | null,
  roundStart: number,
): void {
  if (!content && !reasoning) return;
  const partial: Message = {
    id: randomUUID(),
    role: 'assistant',
    content,
    usage: usage ?? undefined,
    duration: Date.now() - roundStart,
    completed_at: Date.now(),
  };
  if (reasoning) partial.reasoning_content = reasoning;
  callbacks.onAssistantMessage?.(partial);
}
