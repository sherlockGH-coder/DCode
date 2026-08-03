import type { AgentLoopCallbacks, ToolCall } from '../../shared/types';
import type { ToolExecutionContext, ToolRegistry } from '../tools/types';

interface ToolExecutionPair {
  toolCall: ToolCall;
  result: any;
}

/**
 * Execute one round of tool calls in the order provided by the model.
 *
 * Design:
 *   - Consecutive concurrency-safe tools run in parallel as a batch.
 *   - Writes, terminal commands, and tools without a safety declaration run individually as sequential barriers.
 *   - Results always correspond one-to-one with the toolCalls input.
 *   - Abort signals reach the underlying tools so side effects do not continue after only the UI wait stops.
 */
export async function executeToolCallsParallel(
  toolCalls: ToolCall[],
  toolRegistry: ToolRegistry,
  toolCtx: Omit<ToolExecutionContext, 'toolCallId'>,
  callbacks: AgentLoopCallbacks,
  signal?: AbortSignal,
  log?: (...args: unknown[]) => void,
): Promise<ToolExecutionPair[]> {
  if (toolCalls.length === 0) return [];

  const executeOne = async (toolCall: ToolCall): Promise<ToolExecutionPair> => {
    const toolStart = Date.now();
    if (log) log(`  → Executing tool: ${toolCall.function.name} (id=${toolCall.id.slice(0, 8)})`);

    callbacks.onToolCallStart(toolCall);

    const result = signal?.aborted
      ? {
          tool_call_id: toolCall.id,
          name: toolCall.function.name,
          content: '[Aborted] The user stopped execution',
          error: true,
        }
      : await toolRegistry.execute(toolCall, { ...toolCtx, signal });

    callbacks.onToolCallEnd(result);
    const aborted = signal?.aborted === true;
    const status = aborted ? '⏹ Aborted' : result.error ? '✗ Failed' : '✓ Succeeded';
    if (log) log(`  ← Tool completed ${result.name} | ${status} | duration=${Date.now() - toolStart}ms`);

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
