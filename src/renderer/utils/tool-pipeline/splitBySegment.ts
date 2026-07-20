import type { Message } from '../../../shared/types';
import type { ToolSegment } from './types';

export function splitBySegment(messages: Message[]): ToolSegment[] {
  const segments: ToolSegment[] = [];
  let currentItems: Message['toolItems'] = [];
  let currentStartMessageId = '';
  let segmentIndex = 0;

  let lastToolItemMsgIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'assistant' && messages[i].toolItems?.length) {
      lastToolItemMsgIdx = i;
      break;
    }
  }

  let lastToolItemSeenAt = -1;

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.role === 'assistant' && msg.toolItems?.length) {

      if (currentItems.length > 0) {
        segments.push({
          index: segmentIndex++,
          items: currentItems,
          startMessageId: currentStartMessageId,
          isLastSegment: false,
        });
        currentItems = [];
      }
      currentItems = [...msg.toolItems];
      currentStartMessageId = msg.id;
      lastToolItemSeenAt = i;
    } else if (msg.role === 'assistant' && !msg.toolItems?.length && currentItems.length > 0) {

      segments.push({
        index: segmentIndex++,
        items: currentItems,
        startMessageId: currentStartMessageId,
        isLastSegment: false,
      });
      currentItems = [];
      currentStartMessageId = '';
    }
  }

  if (currentItems.length > 0) {
    segments.push({
      index: segmentIndex++,
      items: currentItems,
      startMessageId: currentStartMessageId,
      isLastSegment: lastToolItemSeenAt === lastToolItemMsgIdx,
    });
  }

  if (segments.length > 0) {
    segments[segments.length - 1].isLastSegment = true;
  }

  return segments;
}
