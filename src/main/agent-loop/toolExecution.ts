import type { AgentLoopCallbacks, ToolCall } from '../../shared/types';
import type { ToolExecutionContext, ToolRegistry } from '../tools/types';
import { logChatEvent } from '../logger';

export interface ToolExecutionPair {
  toolCall: ToolCall;
  result: any;
}

/**
 * 按模型给出的顺序执行同一轮工具调用。
 *
 * 设计：
 *   - 连续的并发安全工具组成批次并行执行
 *   - 写入、终端和其他未声明安全的工具作为顺序屏障单独执行
 *   - 返回结果始终与 toolCalls 入参一一对应
 *   - 中止信号同时传入底层工具，避免只停止 UI 等待而让副作用继续发生
 */
export async function executeToolCallsParallel(
  toolCalls: ToolCall[],
  toolRegistry: ToolRegistry,
  toolCtx: Omit<ToolExecutionContext, 'toolCallId'>,
  callbacks: AgentLoopCallbacks,
  signal?: AbortSignal,
  log?: (...args: unknown[]) => void,
  traceId?: string,
  conversationId?: string | null,
  roundNumber?: number,
): Promise<ToolExecutionPair[]> {
  if (toolCalls.length === 0) return [];

  const executeOne = async (toolCall: ToolCall): Promise<ToolExecutionPair> => {
    const toolStart = Date.now();
    if (log) log(`  → 执行工具: ${toolCall.function.name} (id=${toolCall.id.slice(0, 8)})`);

    callbacks.onToolCallStart(toolCall);

    const result = signal?.aborted
      ? {
          tool_call_id: toolCall.id,
          name: toolCall.function.name,
          content: '[Aborted] 用户中止了执行',
          error: true,
        }
      : await toolRegistry.execute(toolCall, { ...toolCtx, signal });

    callbacks.onToolCallEnd(result);
    const aborted = signal?.aborted === true;
    const status = aborted ? '⏹ 中止' : result.error ? '✗ 失败' : '✓ 成功';
    if (log) log(`  ← 工具完成 ${result.name} | ${status} | 耗时=${Date.now() - toolStart}ms`);

    if (traceId) {
      logChatEvent('tool_call', {
        traceId,
        conversationId: conversationId ?? null,
        round: roundNumber,
        name: toolCall.function.name,
        toolCallId: toolCall.id,
        argumentKeys: (() => {
          try {
            const parsed = JSON.parse(toolCall.function.arguments);
            return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
              ? Object.keys(parsed)
              : [];
          } catch {
            return [];
          }
        })(),
        contentLength: typeof result.content === 'string' ? result.content.length : 0,
        error: !!result.error,
        aborted,
        durationMs: Date.now() - toolStart,
        metadataKind: result.metadata?.kind ?? null,
      });
    }

    return { toolCall, result };
  };

  const results = new Map<string, ToolExecutionPair>();
  let safeBatch: ToolCall[] = [];

  const flushSafeBatch = async () => {
    if (safeBatch.length === 0) return;
    const currentBatch = safeBatch;
    safeBatch = [];
    const batchResults = await Promise.all(currentBatch.map(executeOne));
    for (const pair of batchResults) results.set(pair.toolCall.id, pair);
  };

  for (const toolCall of toolCalls) {
    if (toolRegistry.isConcurrencySafe(toolCall.function.name)) {
      safeBatch.push(toolCall);
      continue;
    }
    await flushSafeBatch();
    const pair = await executeOne(toolCall);
    results.set(toolCall.id, pair);
  }
  await flushSafeBatch();

  return toolCalls.map((toolCall) => results.get(toolCall.id)!);
}
