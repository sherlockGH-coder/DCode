import type { Message, ToolCall, ToolItem } from '../../../shared/types';
import { reconstructToolItems } from '../toolItemHelpers';

export function extractToolItems(messages: Message[]): ToolItem[] {
  const items: ToolItem[] = [];

  const toolMessages = messages.filter((m) => m.role === 'tool');

  for (const msg of messages) {
    if (msg.role !== 'assistant') continue;

    if (msg.toolItems?.length) {
      items.push(...msg.toolItems);
      continue;
    }

    if (msg.tool_calls?.length) {
      items.push(...reconstructToolItems(msg.tool_calls, toolMessages));
    }
  }

  return items;
}

/**
 * 为从数据库加载的消息重建 toolItems 并注入回消息对象。
 * 返回一个新的消息数组（浅克隆），assistant 消息的 toolItems 字段已填充。
 * 解决 splitBySegment 依赖 msg.toolItems 但数据库不持久化该字段的问题。
 */
export function injectToolItems(messages: Message[]): Message[] {
  const toolMessages = messages.filter((m) => m.role === 'tool');
  let changed = false;

  const result = messages.map((msg) => {
    if (msg.role !== 'assistant') return msg;
    if (msg.toolItems?.length) return msg;
    if (!msg.tool_calls?.length) return msg;

    const items = reconstructToolItems(msg.tool_calls, toolMessages);
    if (items.length === 0) return msg;
    changed = true;
    return { ...msg, toolItems: items };
  });

  return changed ? result : messages;
}
