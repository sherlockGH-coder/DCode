import { createAnthropicClient } from './anthropicClient';
import { settingsManager } from './settings';
import * as db from './database';
import type { Message } from '../shared/types';

export interface CompactResult {
  /** 更新后的滚动摘要（若本次 no-op 则为已有摘要） */
  summary: string;
  /** 压缩边界：该 id 及其之前的消息在发送给模型时会被摘要替换 */
  boundaryMessageId: string | null;
  /** 本次实际被压缩（折叠进摘要）的消息条数；0 表示 no-op */
  compactedCount: number;
}

const SUMMARY_SYSTEM_PROMPT = `你是一个对话摘要助手，负责把较长的对话历史压缩成简洁、结构化的摘要，供后续对话作为上下文使用。

要求保留：
1. 用户的主要需求和目标
2. 已完成的关键操作和结果（包括文件路径、代码变更等具体细节）
3. 重要的技术决策和上下文
4. 未完成的任务或待解决的问题

如果用户额外提供了"已有摘要"，请把新增对话的要点合并进去，输出一份连贯的、更新后的完整摘要，不要丢弃此前摘要里的关键信息，也不要重复罗列。

请用中文输出，格式为结构化的要点列表，保持简洁（不超过 500 字）。`;

/**
 * 选择要压缩的消息（增量）。
 *
 * 策略：
 * 1. 只考虑上一次压缩边界 `sinceBoundaryId` 之后的消息（更早的已被旧摘要覆盖，不再重复压缩）。
 * 2. 在剩余消息里按 turnId 保留最近 N 个用户轮次及其关联的 assistant/tool 消息。
 * 3. 其余的进入 toCompact。无 turnId 的消息（system、legacy）始终保留。
 *
 * 当边界之后新增内容不足（toCompact 为空）时调用方应视为 no-op。
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
 * 根据滚动摘要裁剪消息列表，供发送给模型时使用。
 *
 * - 没有摘要 / 边界时：原样返回副本。
 * - 有摘要时：丢弃 boundaryId 及其之前的消息，并在头部插入一条摘要 system 消息。
 *
 * 纯函数，无副作用；agentLoop 的首轮与自动压缩后都复用它，避免逻辑漂移。
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
    content: `[上下文摘要]\n以下是先前对话的摘要信息，保留了关键背景和决定。请基于此摘要及后续新对话进行回复：\n${summary}`,
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
    const roleLabel = msg.role === 'user' ? '用户' : msg.role === 'assistant' ? '助手' : '工具';
    const content = msg.content || '';

    if (msg.role === 'assistant' && msg.tool_calls?.length) {
      const toolNames = msg.tool_calls.map((tc) => tc.function.name).join(', ');
      if (content) {
        lines.push(`[${roleLabel}]: ${content}\n[调用工具: ${toolNames}]`);
      } else {
        lines.push(`[${roleLabel}]: [调用工具: ${toolNames}]`);
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
 * 生成（或滚动更新）摘要。
 * 传入 previousSummary 时，模型会把新增消息合并进旧摘要，输出更新后的单份摘要。
 */
async function generateSummary(
  messagesToCompact: Message[],
  previousSummary?: string | null,
): Promise<string> {
  const model = settingsManager.getCompactModel();

  const formatted = formatMessagesForSummary(messagesToCompact);

  const userContent = previousSummary
    ? `这是目前为止的对话摘要（请在此基础上更新）：\n${previousSummary}\n\n以下是上次摘要之后新增的对话内容，请把其中的要点合并进摘要：\n\n${formatted}`
    : `请压缩以下对话历史：\n\n${formatted}`;

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
 * 压缩对话上下文（滚动增量）。
 * 流程：加载消息 → 选择（边界之后的新增）→ 基于旧摘要生成更新摘要 → 写回 DB。
 * 摘要生成在 DB 修改之前，失败则 DB 不受影响。旧消息从不物理删除。
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
 * 判断是否应触发自动压缩。
 * 当 prompt_tokens >= contextLimit * autoThreshold 时返回 true。
 */
export function shouldAutoCompact(promptTokens: number): boolean {
  const threshold = settingsManager.getCompactAutoThreshold();
  const contextLimit = settingsManager.getCompactContextLimit();
  return promptTokens >= contextLimit * threshold;
}
