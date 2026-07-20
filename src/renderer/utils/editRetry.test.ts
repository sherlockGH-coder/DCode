import { describe, expect, it, vi } from 'vitest';
import type { Attachment, Message } from '../../shared/types';
import { submitEditedMessageRetry } from './editRetry';

describe('submitEditedMessageRetry', () => {
  it('still sends the edited message with truncated context when persistent truncation fails', async () => {
    const userMessage: Message = {
      id: 'u1',
      role: 'user',
      content: 'old',
      turnId: 'u1',
      attemptNo: 0,
    };
    const messages: Message[] = [
      userMessage,
      {
        id: 'a1',
        role: 'assistant',
        content: 'auth error',
        error: true,
        turnId: 'u1',
        attemptNo: 1,
      },
    ];
    const setMessages = vi.fn();
    const sendMessage = vi.fn(async () => undefined);

    const result = await submitEditedMessageRetry({
      conversationId: 'conv_1',
      messages,
      lastUserMessage: userMessage,
      editedContent: 'new',
      truncateMessages: vi.fn(async () => {
        throw new Error('No handler registered');
      }),
      setMessages,
      sendMessage,
      onTruncateError: vi.fn(),
    });

    expect(result.submitted).toBe(true);
    expect(result.truncateFailed).toBe(true);
    expect(setMessages).toHaveBeenCalledWith([]);
    expect(sendMessage).toHaveBeenCalledWith('new', undefined, []);
  });

  it('uses edited attachments when the inline composer changes them', async () => {
    const originalAttachment: Attachment = {
      id: 'att_old',
      kind: 'file',
      name: 'old.txt',
      path: '/tmp/old.txt',
      size: 12,
      mimeType: 'text/plain',
    };
    const editedAttachment: Attachment = {
      id: 'att_new',
      kind: 'file',
      name: 'new.txt',
      path: '/tmp/new.txt',
      size: 18,
      mimeType: 'text/plain',
    };
    const userMessage: Message = {
      id: 'u1',
      role: 'user',
      content: 'old',
      attachments: [originalAttachment],
      turnId: 'u1',
      attemptNo: 0,
    };
    const setMessages = vi.fn();
    const sendMessage = vi.fn(async () => undefined);

    const result = await submitEditedMessageRetry({
      conversationId: 'conv_1',
      messages: [userMessage],
      lastUserMessage: userMessage,
      editedContent: 'new',
      editedAttachments: [editedAttachment],
      truncateMessages: vi.fn(async () => undefined),
      setMessages,
      sendMessage,
    });

    expect(result.submitted).toBe(true);
    expect(sendMessage).toHaveBeenCalledWith('new', [editedAttachment], []);
  });
});
