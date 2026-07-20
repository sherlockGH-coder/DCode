import type { Attachment, Message } from '../../shared/types';

interface SubmitEditedMessageRetryArgs {
  conversationId: string | null;
  messages: Message[];
  lastUserMessage: Message | undefined;
  editedContent: string;
  editedAttachments?: Attachment[];
  truncateMessages?: (conversationId: string, messageId: string) => Promise<void>;
  setMessages: (messages: Message[]) => void;
  sendMessage: (
    editedContent: string,
    attachments: Attachment[] | undefined,
    existingMessagesOverride: Message[],
  ) => Promise<void>;
  onTruncateError?: (error: unknown) => void;
}

export interface SubmitEditedMessageRetryResult {
  submitted: boolean;
  truncateFailed: boolean;
}

export async function submitEditedMessageRetry({
  conversationId,
  messages,
  lastUserMessage,
  editedContent,
  editedAttachments,
  truncateMessages,
  setMessages,
  sendMessage,
  onTruncateError,
}: SubmitEditedMessageRetryArgs): Promise<SubmitEditedMessageRetryResult> {
  if (!lastUserMessage || !conversationId) {
    return { submitted: false, truncateFailed: false };
  }

  const msgId = lastUserMessage.id;
  const messageIndex = messages.findIndex((m) => m.id === msgId);
  if (messageIndex === -1) {
    return { submitted: false, truncateFailed: false };
  }

  const nextMessages = messages.slice(0, messageIndex);
  let truncateFailed = false;
  try {
    if (!truncateMessages) {
      throw new Error('truncateMessages bridge is unavailable');
    }
    await truncateMessages(conversationId, msgId);
  } catch (error) {
    truncateFailed = true;
    onTruncateError?.(error);
  }

  setMessages(nextMessages);
  await sendMessage(editedContent, editedAttachments ?? lastUserMessage.attachments, nextMessages);

  return { submitted: true, truncateFailed };
}
