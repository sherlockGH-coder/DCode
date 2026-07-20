import { randomUUID } from 'node:crypto';
import type { Message } from '../../shared/types';

/**
 * 修复消息历史中 orphan tool_use/tool_result 对
 *
 * OpenAI/Anthropic 工具协议要求 assistant.tool_calls 后面紧跟对应的
 * tool_result 窗口。应用崩溃或断电可能留下"assistant 已落库、tool 结果
 * 未落库 / 乱序落库"的半事务历史；这里在请求边界规范化历史，避免坏历史
 * 永久卡住继续对话。
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
        content: '[Interrupted tool_result] 工具执行结果丢失，通常是应用在工具运行中被关闭或系统断电导致。请根据当前上下文决定是否重新调用该工具。',
        tool_call_id: tc.id,
        name: tc.function.name,
        error: true,
      });
    }
  }

  return result;
}
