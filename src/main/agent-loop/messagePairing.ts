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
  const consumedToolMessages = new Set<Message>();

  for (const msg of messages) {
    if (msg.role === 'tool' && msg.tool_call_id) {
      const bucket = toolMessagesByCallId.get(msg.tool_call_id) ?? [];
      bucket.push(msg);
      toolMessagesByCallId.set(msg.tool_call_id, bucket);
    }
  }

  for (const msg of messages) {
    if (msg.role === 'tool') {
      if (consumedToolMessages.has(msg)) continue;

      continue;
    }

    let normalizedMessage = msg;
    if (msg.role === 'assistant' && msg.tool_calls?.length) {
      // Tool-start events and persisted assistant messages describe the same provider
      // call. Treat the provider ID as the identity at this final request boundary.
      const seenCallIds = new Set<string>();
      const uniqueToolCalls = msg.tool_calls.filter((toolCall) => {
        if (seenCallIds.has(toolCall.id)) return false;
        seenCallIds.add(toolCall.id);
        return true;
      });
      if (uniqueToolCalls.length !== msg.tool_calls.length) {
        normalizedMessage = { ...msg, tool_calls: uniqueToolCalls };
      }
    }

    result.push(normalizedMessage);

    if (normalizedMessage.role !== 'assistant' || !normalizedMessage.tool_calls?.length) continue;

    for (const tc of normalizedMessage.tool_calls) {
      const candidates = toolMessagesByCallId.get(tc.id) ?? [];
      const existing = candidates.find((candidate) => !consumedToolMessages.has(candidate));

      if (existing) {
        result.push(existing);
        consumedToolMessages.add(existing);
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
