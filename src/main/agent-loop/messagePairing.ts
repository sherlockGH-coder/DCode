import { randomUUID } from 'node:crypto';
import type { Message } from '../../shared/types';

/**
 * Repair orphan tool_use/tool_result pairs in message history.
 *
 * The OpenAI and Anthropic tool protocols require the matching tool_result window to immediately follow assistant.tool_calls.
 * A crash or power loss can leave a half-committed history where the assistant is stored but tool results are missing or out of order.
 * Normalize history at the request boundary so malformed history cannot permanently block the conversation.
 */
export function ensureToolResultPairing(messages: Message[]): Message[] {
  const result: Message[] = [];
  const toolMessagesByCallId = new Map<string, Message[]>();
  const consumedToolMessageIds = new Set<string>();

  for (const msg of messages) {
    if (msg.role === 'tool' && msg.tool_call_id) {
      const bucket = toolMessagesByCallId.get(msg.tool_call_id) ?? [];
      bucket.push(msg);
      toolMessagesByCallId.set(msg.tool_call_id, bucket);
    }
  }

  for (const msg of messages) {
    if (msg.role === 'tool') {
      if (consumedToolMessageIds.has(msg.id)) continue;

      continue;
    }

    result.push(msg);

    if (msg.role !== 'assistant' || !msg.tool_calls?.length) continue;

    for (const tc of msg.tool_calls) {
      const candidates = toolMessagesByCallId.get(tc.id) ?? [];
      const existing = candidates.find((candidate) => !consumedToolMessageIds.has(candidate.id));

      if (existing) {
        result.push(existing);
        consumedToolMessageIds.add(existing.id);
        continue;
      }

      result.push({
        id: randomUUID(),
        role: 'tool',
        content: '[Interrupted tool_result] The tool result is missing, usually because the app closed or the system lost power while the tool was running. Decide whether to call the tool again based on the current context.',
        tool_call_id: tc.id,
        name: tc.function.name,
        error: true,
      });
    }
  }

  return result;
}
