import { createAnthropicClient } from './anthropicClient';
import { settingsManager } from './settings';
import * as db from './database';
import type { Message } from '../shared/types';

interface CompactResult {
  /** Updated rolling summary, or the existing summary when this run is a no-op. */
  summary: string;
  /** Compaction boundary: this ID and earlier messages are replaced by the summary when sent to the model. */
  boundaryMessageId: string | null;
  /** Number of messages compacted into the summary; 0 means no-op. */
  compactedCount: number;
}

const SUMMARY_SYSTEM_PROMPT = `You are a conversation summarization assistant. Compress long conversation history into a concise, structured summary for use as context in later turns.

Preserve:
1. The user's main needs and goals.
2. Important completed actions and results, including file paths and code changes.
3. Important technical decisions and context.
4. Unfinished tasks and unresolved issues.

If the user provides an existing summary, merge the key points from the new conversation into it and output one coherent, complete updated summary. Do not discard important information from the previous summary or repeat items.

Write the output in English as a structured bullet list and keep it concise (no more than 500 words).`;

/**
 * Select messages for incremental compaction.
 *
 * Strategy:
 * 1. Consider only messages after the previous compaction boundary `sinceBoundaryId`; earlier messages are covered by the old summary.
 * 2. Among the remaining messages, keep the latest N user turns and their associated assistant/tool messages by turnId.
 * 3. Put the rest in toCompact. Always keep messages without turnId, including system and legacy messages.
 *
 * The caller should treat an empty toCompact list as a no-op when there is not enough new content after the boundary.
 */
export function selectMessagesToCompact(
  messages: Message[],
  keepRecentTurns: number,
  sinceBoundaryId?: string | null,
): { toCompact: Message[]; toKeep: Message[] } {

  let pool = messages;
  if (sinceBoundaryId) {
    const idx = messages.findIndex((m) => m.id === sinceBoundaryId);
    if (idx !== -1) pool = messages.slice(idx + 1);
  }

  const userTurnIds: string[] = [];
  for (const msg of pool) {
    if (msg.role === 'user' && msg.turnId && !userTurnIds.includes(msg.turnId)) {
      userTurnIds.push(msg.turnId);
    }
  }
  const keepTurnIds = new Set(userTurnIds.slice(-keepRecentTurns));

  const toCompact: Message[] = [];
  const toKeep: Message[] = [];
  for (const msg of pool) {
    if (!msg.turnId || msg.role === 'system') {
      toKeep.push(msg);
      continue;
    }
    if (keepTurnIds.has(msg.turnId)) {
      toKeep.push(msg);
    } else {
      toCompact.push(msg);
    }
  }

  return { toCompact, toKeep };
}

/**
 * Prune messages with the rolling summary before sending them to the model.
 *
 * - Without a summary or boundary: return a copy unchanged.
 * - With a summary: discard boundaryId and earlier messages, then prepend a summary system message.
 *
 * Pure and side-effect-free; the first agentLoop turn and post-auto-compaction path both reuse it to avoid logic drift.
 */
export function pruneWithSummary(
  messages: Message[],
  summary: string | null | undefined,
  boundaryId: string | null | undefined,
): Message[] {
  if (!summary || !boundaryId) return [...messages];

  const idx = messages.findIndex((m) => m.id === boundaryId);
  const pruned = idx !== -1 ? messages.slice(idx + 1) : [...messages];

  const summaryMessage: Message = {
    id: 'context_summary',
    role: 'system',
    content: `[Context summary]\nHere is a summary of the previous conversation, including important context and decisions. Use it together with the subsequent conversation to respond:\n${summary}`,
  };

  return [summaryMessage, ...pruned];
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + '...';
}

function formatMessagesForSummary(messages: Message[]): string {
  const lines: string[] = [];
  for (const msg of messages) {
    const roleLabel = msg.role === 'user' ? 'User' : msg.role === 'assistant' ? 'Assistant' : 'Tool';
    const content = msg.content || '';

    if (msg.role === 'assistant' && msg.tool_calls?.length) {
      const toolNames = msg.tool_calls.map((tc) => tc.function.name).join(', ');
      if (content) {
        lines.push(`[${roleLabel}]: ${content}\n[Tool calls: ${toolNames}]`);
      } else {
        lines.push(`[${roleLabel}]: [Tool calls: ${toolNames}]`);
      }
    } else if (msg.role === 'tool') {
      lines.push(`[${roleLabel}${msg.name ? ':' + msg.name : ''}]: ${truncate(content, 500)}`);
    } else {
      lines.push(`[${roleLabel}]: ${truncate(content, 1000)}`);
    }
  }
  return lines.join('\n');
}

/**
 * Generate or roll the summary forward.
 * When previousSummary is provided, the model merges new messages into it and returns one updated summary.
 */
async function generateSummary(
  messagesToCompact: Message[],
  previousSummary?: string | null,
): Promise<string> {
  const model = settingsManager.getCompactModel();

  const formatted = formatMessagesForSummary(messagesToCompact);

  const userContent = previousSummary
    ? `Here is the conversation summary so far; update it based on the following:\n${previousSummary}\n\nHere is the new conversation after the previous summary. Merge its key points into the summary:\n\n${formatted}`
    : `Compress the following conversation history:\n\n${formatted}`;

  const client = createAnthropicClient();
  const response = await client.messages.create({
    model,
    max_tokens: 1024,
    system: SUMMARY_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userContent }],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  const content = textBlock?.text;
  if (!content) {
    throw new Error('Compact model returned empty response');
  }
  return content;
}

/**
 * Compact conversation context incrementally.
 * Flow: load messages -> select new messages after the boundary -> generate an updated summary from the old summary -> write it to the DB.
 * Summary generation happens before the DB is modified, so failures leave the DB unchanged. Old messages are never physically deleted.
 */
export async function compactConversation(conversationId: string): Promise<CompactResult> {
  const messages = db.getMessages(conversationId) as Message[];
  const keepRecentTurns = settingsManager.getCompactKeepRecentTurns();

  const conv = db.getConversationById(conversationId);
  const prevSummary = conv?.summary ?? null;
  const prevBoundary = conv?.compacted_to_message_id ?? null;

  const { toCompact } = selectMessagesToCompact(messages, keepRecentTurns, prevBoundary);

  if (toCompact.length === 0) {
    return { summary: prevSummary ?? '', boundaryMessageId: prevBoundary, compactedCount: 0 };
  }

  const summary = await generateSummary(toCompact, prevSummary);
  const boundaryMessageId = toCompact[toCompact.length - 1].id;

  db.updateConversationSummary(conversationId, summary, boundaryMessageId);

  return { summary, boundaryMessageId, compactedCount: toCompact.length };
}

/**
 * Determine whether automatic compaction should run.
 * Return true when prompt_tokens >= contextLimit * autoThreshold.
 */
export function shouldAutoCompact(promptTokens: number): boolean {
  const threshold = settingsManager.getCompactAutoThreshold();
  const contextLimit = settingsManager.getCompactContextLimit();
  return promptTokens >= contextLimit * threshold;
}
