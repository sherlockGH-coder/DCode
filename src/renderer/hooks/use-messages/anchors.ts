import type { Message } from '../../../shared/types';
import type { ActiveRequest } from './types';

export function assistantAnchorId(req: ActiveRequest): string {
  return req.assistantAnchorId ?? req.placeholderId;
}

export function insertionAnchorId(req: ActiveRequest): string {
  return req.insertAfterId ?? req.assistantAnchorId ?? req.placeholderId;
}

export function findMessageIndex(messages: Message[], id: string): number {
  return messages.findIndex((message) => message.id === id);
}

export function insertIndexAfter(messages: Message[], id: string): number {
  const idx = findMessageIndex(messages, id);
  return idx === -1 ? messages.length : idx + 1;
}

export function setCurrentAssistant(req: ActiveRequest, id: string): void {
  req.placeholderId = id;
  req.assistantAnchorId = id;
  req.insertAfterId = id;
}

export function updateAssistantId(req: ActiveRequest, oldId: string, newId: string): void {
  if (req.placeholderId === oldId) req.placeholderId = newId;
  if (req.assistantAnchorId === oldId) req.assistantAnchorId = newId;
  if (req.insertAfterId === oldId) req.insertAfterId = newId;
}
