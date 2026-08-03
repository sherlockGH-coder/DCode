import type { Message, ToolItem } from '../../../shared/types';
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
 * Rebuild toolItems for messages loaded from the database and inject them back into the message objects.
 * Return a new shallow-cloned message array with toolItems populated on assistant messages.
 * This addresses the fact that splitBySegment depends on msg.toolItems while the database does not persist that field.
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
