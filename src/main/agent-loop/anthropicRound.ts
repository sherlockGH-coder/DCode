import { randomUUID } from 'node:crypto';
import type { Message, ProviderContentBlock, ServerToolUse, ToolCall } from '../../shared/types';
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

/** Summarize a server-side web search result block for the tool activity UI. */
function describeWebSearchResult(content: unknown): { resultCount: number; summary: string } {
  const rawResults = Array.isArray(content) ? content : [];
  const results = rawResults.slice(0, 10);
  const lines = results.map((raw, i) => {
    const rec = (raw ?? {}) as Record<string, unknown>;
    const title = typeof rec.title === 'string' ? rec.title : '';
    const url = typeof rec.url === 'string' ? rec.url : '';
    const pageAge = typeof rec.page_age === 'string' ? rec.page_age : '';
    const display = title || url || 'Untitled result';
    const link = url ? `[${display}](${url})` : display;
    return `${i + 1}. ${link}${pageAge ? `\n   Page age: ${pageAge}` : ''}`;
  });
  const error = !Array.isArray(content) && content && typeof content === 'object'
    ? (content as Record<string, unknown>).error_code
    : undefined;
  return {
    resultCount: rawResults.length,
    summary: lines.length > 0
      ? `Web search results (${rawResults.length} total, server-side search)\n\n${lines.join('\n\n')}`
      : error
        ? `Web search failed: ${String(error)}`
        : 'Web search returned no results.',
  };
}

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
  const serverToolUses: ServerToolUse[] = [];
  const providerBlockMap = new Map<number, ProviderContentBlock>();
  const inputFragments = new Map<number, string>();
  const serverToolQueries = new Map<string, string>();

  for (const message of pairedMessages) {
    for (const use of message.serverToolUses ?? []) {
      const query = typeof use.input.query === 'string' ? use.input.query : '';
      serverToolQueries.set(use.id, query);
    }
    for (const block of message.providerContentBlocks ?? []) {
      if (block.type !== 'server_tool_use' || typeof block.id !== 'string') continue;
      const input = block.input && typeof block.input === 'object'
        ? block.input as Record<string, unknown>
        : {};
      serverToolQueries.set(block.id, typeof input.query === 'string' ? input.query : '');
    }
  }

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
  let currentBlockIndex = -1;
  let fallbackBlockIndex = -1;
  const describedToolResultIds = new Set<string>();

  const emitWebSearchResult = (toolUseId: string, content: unknown) => {
    const { resultCount, summary } = describeWebSearchResult(content);
    callbacks.onToolCallEnd?.({
      tool_call_id: toolUseId,
      name: 'web_search',
      content: summary,
      metadata: {
        kind: 'web_search',
        query: serverToolQueries.get(toolUseId) ?? '',
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
          const block = event.content_block as ProviderContentBlock;
          const blockIndex = typeof event.index === 'number' ? event.index : ++fallbackBlockIndex;
          fallbackBlockIndex = Math.max(fallbackBlockIndex, blockIndex);
          currentBlockIndex = blockIndex;
          providerBlockMap.set(blockIndex, { ...block });

          if (block.type === 'tool_use' || block.type === 'server_tool_use') {
            inputFragments.set(blockIndex, '');
          } else if (block.type === 'web_search_tool_result') {
            const toolUseId = typeof block.tool_use_id === 'string' ? block.tool_use_id : '';
            // DeepSeek delivers the results inline at content_block_start. If content is not
            // present yet it may arrive via deltas, so defer to content_block_stop in that case.
            if (!describedToolResultIds.has(toolUseId) && Array.isArray(block.content) && block.content.length > 0) {
              describedToolResultIds.add(toolUseId);
              emitWebSearchResult(toolUseId, block.content);
            }
          }
          break;
        }

        case 'content_block_delta': {
          const delta = event.delta;
          const blockIndex = typeof event.index === 'number' ? event.index : currentBlockIndex;
          const block = providerBlockMap.get(blockIndex);
          if (delta.type === 'text_delta') {
            assistantContent += delta.text;
            callbacks.onChunk(delta.text);
            if (block) block.text = `${typeof block.text === 'string' ? block.text : ''}${delta.text}`;
          } else if (delta.type === 'thinking_delta') {
            reasoningContent += delta.thinking;
            callbacks.onReasoningChunk(delta.thinking);
            if (block) block.thinking = `${typeof block.thinking === 'string' ? block.thinking : ''}${delta.thinking}`;
          } else if (delta.type === 'signature_delta') {
            if (block) block.signature = `${typeof block.signature === 'string' ? block.signature : ''}${delta.signature}`;
          } else if (delta.type === 'input_json_delta') {
            inputFragments.set(blockIndex, `${inputFragments.get(blockIndex) ?? ''}${delta.partial_json}`);
          } else if (delta.type === 'citations_delta' && block) {
            const citations = Array.isArray(block.citations) ? block.citations : [];
            block.citations = [...citations, delta.citation];
          }
          break;
        }

        case 'content_block_stop': {
          const blockIndex = typeof event.index === 'number' ? event.index : currentBlockIndex;
          const block = providerBlockMap.get(blockIndex);
          if (block?.type === 'tool_use') {
            const inputJson = inputFragments.get(blockIndex) ?? '';
            let input: Record<string, unknown> = {};
            try {
              input = inputJson ? JSON.parse(inputJson) : (block.input as Record<string, unknown> ?? {});
            } catch {
              log('⚠ Failed to parse tool_use input JSON');
            }
            block.input = input;
            toolUseBlocks.push({
              id: typeof block.id === 'string' ? block.id : '',
              name: typeof block.name === 'string' ? block.name : '',
              input: JSON.stringify(input),
            });
          } else if (block?.type === 'server_tool_use') {
            const inputJson = inputFragments.get(blockIndex) ?? '';
            let input: Record<string, unknown> = {};
            try {
              input = inputJson ? JSON.parse(inputJson) : (block.input as Record<string, unknown> ?? {});
            } catch {
              log('⚠ Failed to parse server_tool_use input JSON');
            }
            block.input = input;
            const id = typeof block.id === 'string' ? block.id : '';
            const name = typeof block.name === 'string' ? block.name : '';
            serverToolUses.push({
              id,
              name,
              input,
            });
            serverToolQueries.set(id, typeof input.query === 'string' ? input.query : '');
            callbacks.onToolCallStart?.({
              id,
              type: 'function',
              serverTool: true,
              function: { name, arguments: JSON.stringify(input) },
            });
            // Anthropic-native providers include the search results inline in the
            // server_tool_use input; DeepSeek delivers them in a separate
            // web_search_tool_result block. Emit the completion once either arrives.
            const inlineResults = Array.isArray(input.search_result) ? input.search_result : [];
            if (inlineResults.length > 0 && !describedToolResultIds.has(id)) {
              describedToolResultIds.add(id);
              emitWebSearchResult(id, inlineResults);
            }
          } else if (block?.type === 'web_search_tool_result') {
            const toolUseId = typeof block.tool_use_id === 'string' ? block.tool_use_id : '';
            if (!describedToolResultIds.has(toolUseId)) {
              describedToolResultIds.add(toolUseId);
              let content = block.content;
              if (!Array.isArray(content)) {
                const inputJson = inputFragments.get(blockIndex) ?? '';
                if (inputJson) {
                  try {
                    const parsed = JSON.parse(inputJson) as unknown;
                    if (Array.isArray(parsed)) {
                      content = parsed;
                    } else if (parsed && typeof parsed === 'object') {
                      const rec = parsed as Record<string, unknown>;
                      content = Array.isArray(rec.content) ? rec.content : Array.isArray(rec.search_result) ? rec.search_result : content;
                    }
                  } catch {
                    log('⚠ Failed to parse web_search_tool_result input JSON');
                  }
                  block.content = content;
                }
              }
              emitWebSearchResult(toolUseId, content);
            }
          }
          inputFragments.delete(blockIndex);
          currentBlockIndex = -1;
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
  const providerContentBlocks = [...providerBlockMap.entries()]
    .sort(([left], [right]) => left - right)
    .map(([, block]) => block);

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
