import Database from 'better-sqlite3';
import path from 'path';
import { mkdirSync } from 'fs';
import { app } from 'electron';
import { randomUUID } from 'crypto';
import type {
  ToolResultMetadata,
  ToolResultContentBlock,
  Attachment,
  AgentRunStatus,
  ConversationMode,
} from '../shared/types';
import { initializeSchema } from './database/schema';
import { prepareStatements } from './database/statements';

let _db: Database.Database | null = null;
let _dbDir: string | null = null;
let _dbPath: string | null = null;
let _stmts: ReturnType<typeof prepareStatements> | null = null;

function ensureInitialized(): void {
  if (_db) return;

  _dbDir = app.getPath('userData');
  mkdirSync(_dbDir, { recursive: true });
  _dbPath = path.join(_dbDir, 'chat.db');

  _db = new Database(_dbPath);

  _db.pragma('journal_mode = WAL');

  initializeSchema(_db);

  _stmts = prepareStatements(_db);
}

function db(): Database.Database { ensureInitialized(); return _db!; }
function stmts() { ensureInitialized(); return _stmts!; }

export function getDbDir(): string { ensureInitialized(); return _dbDir!; }
export function getDbPath(): string { ensureInitialized(); return _dbPath!; }
export function getRawDatabase(): Database.Database { ensureInitialized(); return _db!; }

export interface CreateConversationOptions {
  parentConversationId?: string | null;
  rootConversationId?: string | null;
  agentRole?: string | null;
  agentStatus?: AgentRunStatus | null;
  agentTaskName?: string | null;
}

/** 创建新对话，返回对话 ID。projectPath 可为 null（未归类）。 */
export function createConversation(
  title: string,
  projectPath: string | null,
  source: string = 'manual',
  sourceJobId?: string | null,
  options: CreateConversationOptions = {},
): string {
  ensureInitialized();
  const id = randomUUID();
  stmts().createConversation.run(
    id,
    title,
    projectPath,
    source,
    sourceJobId ?? null,
    null,
    options.parentConversationId ?? null,
    options.rootConversationId ?? null,
    options.agentRole ?? null,
    options.agentStatus ?? null,
    options.agentTaskName ?? null,
  );
  return id;
}

/**
 * 获取对话列表。
 * - 不传参数 = 全部对话
 * - 传项目路径 = 只取该项目下的对话
 * - 传 null = 只取未归类对话
 */
export function getConversations(projectPath?: string | null) {
  ensureInitialized();
  let rows: any[];
  if (projectPath === undefined) rows = stmts().getConversations.all() as any[];
  else if (projectPath === null) rows = stmts().getConversationsWithoutProject.all() as any[];
  else rows = stmts().getConversationsByProject.all(projectPath) as any[];
  return rows.map(r => ({
    ...r,
    activeAttempts: r.active_attempts ? safeParseJsonObject(r.active_attempts) : {},
  }));
}

export function getCronConversations(_jobId?: string | null) {

  return [];
}

export function getAgentConversations(rootConversationId: string) {
  ensureInitialized();
  const rows = stmts().getAgentConversationsByRoot.all(rootConversationId) as any[];
  return rows.map(r => ({
    ...r,
    activeAttempts: r.active_attempts ? safeParseJsonObject(r.active_attempts) : {},
  }));
}

/** 取单条对话（用于从 IPC 中读 project_path） */
export function getConversationById(id: string) {
  ensureInitialized();
  const row = stmts().getConversationById.get(id) as any;
  if (!row) return undefined;
  return {
    ...row,
    activeAttempts: row.active_attempts ? safeParseJsonObject(row.active_attempts) : {},
  } as {
    id: string;
    title: string;
    project_path: string | null;
    created_at: string;
    updated_at: string;
    activeAttempts: Record<string, number>;
    summary?: string | null;
    compacted_to_message_id?: string | null;
    collaboration_mode: ConversationMode;
    mode_revision: number;
    content_revision: number;
    current_context_epoch: number;
    active_plan_artifact_id?: string | null;
    source?: string | null;
    source_job_id?: string | null;
    parent_conversation_id?: string | null;
    root_conversation_id?: string | null;
    agent_role?: string | null;
    agent_status?: AgentRunStatus | null;
    agent_task_name?: string | null;
  };
}

function safeParseJsonObject(s: string): Record<string, number> {
  try {
    const v = JSON.parse(s);
    return v && typeof v === 'object' ? v : {};
  } catch { return {}; }
}

function safeJsonParse<T>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch (err) {
    console.warn('[database] JSON parse failed, using fallback:', err instanceof Error ? err.message : String(err));
    return fallback;
  }
}

/** 更新对话标题 */
export function updateConversationTitle(id: string, title: string) {
  ensureInitialized();
  stmts().updateConversationTitle.run(title, id);
}

/** 更新对话的上下文摘要和压缩截止消息 ID */
export function updateConversationSummary(id: string, summary: string | null, compactedToMessageId: string | null): void {
  ensureInitialized();
  stmts().updateConversationSummary.run(summary, compactedToMessageId, id);
}

/** 更新对话时间（用于排序） */
export function updateConversationTime(id: string) {
  ensureInitialized();
  stmts().updateConversationTime.run(id);
}

export function updateAgentConversationStatus(id: string, status: AgentRunStatus): void {
  ensureInitialized();
  stmts().updateAgentConversationStatus.run(status, id);
}

/** 删除对话（级联删除消息） */
export function deleteConversation(id: string) {
  ensureInitialized();

  stmts().deleteMessages.run(id);
  stmts().deleteConversation.run(id);
}

/** 添加消息。可传入 id 让外部预生成（保持 renderer / main / DB 三方 id 一致）；不传则自生成。 */
export function addMessage(
  conversationId: string,
  role: 'user' | 'assistant' | 'tool',
  content: string | null,
  toolCalls?: any[],
  toolCallId?: string,
  metadata?: ToolResultMetadata,
  reasoningContent?: string,
  attachments?: Attachment[],
  name?: string,
  error?: boolean,
  usage?: any,
  duration?: number,
  turnId?: string,
  attemptNo?: number,
  seq?: number,
  id?: string,
  contentBlocks?: ToolResultContentBlock[],
  contextEpoch?: number,
  origin: string = 'chat',
  planArtifactId?: string,
): string {
  ensureInitialized();
  const finalId = id ?? randomUUID();
  const toolCallsJson = toolCalls ? JSON.stringify(toolCalls) : null;
  const metadataJson = metadata ? JSON.stringify(metadata) : null;
  const attachmentsJson = attachments && attachments.length > 0 ? JSON.stringify(attachments) : null;
  const usageJson = usage ? JSON.stringify(usage) : null;
  const contentBlocksJson = contentBlocks && contentBlocks.length > 0 ? JSON.stringify(contentBlocks) : null;

  db().transaction(() => {
    const conversation = stmts().getConversationById.get(conversationId) as { current_context_epoch?: number } | undefined;
    const epoch = contextEpoch ?? conversation?.current_context_epoch ?? 0;
    stmts().addMessage.run(finalId, conversationId, role, content, toolCallsJson, toolCallId || null, metadataJson, reasoningContent || null, attachmentsJson, name || null, error ? 1 : null, usageJson, duration || null, turnId || null, attemptNo ?? null, seq ?? null, contentBlocksJson, epoch, origin, planArtifactId ?? null);
    if (role === 'user' && origin !== 'plan_execution') {
      db().prepare(`
        UPDATE plan_artifacts
        SET status = 'superseded', invalidation_reason = 'user_feedback', decided_at = CURRENT_TIMESTAMP
        WHERE conversation_id = ? AND status = 'pending_approval'
      `).run(conversationId);
      db().prepare(`
        UPDATE conversations
        SET content_revision = COALESCE(content_revision, 0) + 1,
            active_plan_artifact_id = NULL
        WHERE id = ?
      `).run(conversationId);
    }
    stmts().updateConversationTime.run(conversationId);
  })();

  return finalId;
}

/** 获取某对话的所有消息 */
export function getMessages(conversationId: string) {
  ensureInitialized();
  const rows = stmts().getMessages.all(conversationId) as any[];
  return rows.map(row => ({
    ...row,
    tool_calls: safeJsonParse(row.tool_calls, undefined),
    metadata: safeJsonParse(row.metadata, undefined),
    attachments: safeJsonParse(row.attachments, undefined),
    usage: safeJsonParse(row.usage, undefined),
    contentBlocks: safeJsonParse(row.content_blocks, undefined),
    contextEpoch: row.context_epoch ?? 0,
    origin: row.origin ?? 'chat',
    planArtifactId: row.plan_artifact_id ?? undefined,
    error: row.error === 1 ? true : undefined,
    turnId: row.turn_id ?? undefined,
    attemptNo: row.attempt_no ?? undefined,
    seq: row.seq ?? undefined,
  }));
}

/** 计算指定 turn 下已有的最大 attempt_no（不存在则返回 0） */
export function getMaxAttemptNo(conversationId: string, turnId: string): number {
  ensureInitialized();
  const row = stmts().getMaxAttemptNo.get(conversationId, turnId) as { maxNo: number | null } | undefined;
  return row?.maxNo ?? 0;
}

/** 读取对话的激活 attempt 映射 */
export function getActiveAttempts(conversationId: string): Record<string, number> {
  ensureInitialized();
  const row = stmts().getConversationById.get(conversationId) as { active_attempts?: string | null } | undefined;
  if (!row?.active_attempts) return {};
  try {
    return JSON.parse(row.active_attempts) as Record<string, number>;
  } catch {
    return {};
  }
}

/** 整体覆盖对话的激活 attempt 映射 */
export function setActiveAttempts(conversationId: string, map: Record<string, number>): void {
  ensureInitialized();
  db().transaction(() => {
    stmts().updateActiveAttempts.run(JSON.stringify(map ?? {}), conversationId);
    const conversation = stmts().getConversationById.get(conversationId) as { active_plan_artifact_id?: string | null } | undefined;
    if (!conversation?.active_plan_artifact_id) return;
    const plan = db().prepare(
      "SELECT source_turn_id, source_attempt_no FROM plan_artifacts WHERE id = ? AND status = 'pending_approval'",
    ).get(conversation.active_plan_artifact_id) as { source_turn_id: string; source_attempt_no: number } | undefined;
    if (!plan) return;
    const activeAttempt = map?.[plan.source_turn_id];
    if (activeAttempt !== undefined && activeAttempt !== plan.source_attempt_no) {
      db().prepare(`
        UPDATE plan_artifacts
        SET status = 'superseded', invalidation_reason = 'branch_changed', decided_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(conversation.active_plan_artifact_id);
      db().prepare('UPDATE conversations SET active_plan_artifact_id = NULL WHERE id = ?').run(conversationId);
    }
  })();
}

/** 删除某对话的所有消息 */
export function deleteMessages(conversationId: string) {
  ensureInitialized();
  stmts().deleteMessages.run(conversationId);
}

/** 删除指定消息及之后所有消息（用于编辑重试截断） */
export function deleteMessagesFromId(conversationId: string, messageId: string): void {
  ensureInitialized();
  const stmt = db().prepare(`
    DELETE FROM messages
    WHERE conversation_id = ?
    AND rowid >= (SELECT rowid FROM messages WHERE id = ? AND conversation_id = ?)
  `);
  stmt.run(conversationId, messageId, conversationId);
  stmts().updateConversationTime.run(conversationId);
}

/** 删除指定 turn 及之后所有消息（用于撤销并回滚后续时间线） */
export function deleteMessagesFromTurn(conversationId: string, turnId: string): void {
  ensureInitialized();

  db().transaction(() => {
    const deletedTurnIds = new Set<string>();
    const rows = db().prepare(`
      SELECT DISTINCT turn_id as turnId FROM messages
      WHERE conversation_id = ?
      AND rowid >= (
        SELECT MIN(rowid) FROM messages
        WHERE conversation_id = ? AND turn_id = ?
      )
      AND turn_id IS NOT NULL
    `).all(conversationId, conversationId, turnId) as Array<{ turnId: string | null }>;

    for (const row of rows) {
      if (row.turnId) deletedTurnIds.add(row.turnId);
    }

    const stmt = db().prepare(`
      DELETE FROM messages
      WHERE conversation_id = ?
      AND rowid >= (
        SELECT MIN(rowid) FROM messages
        WHERE conversation_id = ? AND turn_id = ?
      )
    `);
    stmt.run(conversationId, conversationId, turnId);

    if (deletedTurnIds.size > 0) {
      const placeholders = Array.from(deletedTurnIds).map(() => '?').join(',');
      db().prepare(`
        UPDATE plan_artifacts
        SET status = 'superseded', invalidation_reason = 'history_truncated', decided_at = CURRENT_TIMESTAMP
        WHERE conversation_id = ? AND source_turn_id IN (${placeholders})
          AND status = 'pending_approval'
      `).run(conversationId, ...deletedTurnIds);
      db().prepare(`
        UPDATE conversations SET active_plan_artifact_id = NULL
        WHERE id = ? AND active_plan_artifact_id IN (
          SELECT id FROM plan_artifacts WHERE conversation_id = ? AND status = 'superseded'
        )
      `).run(conversationId, conversationId);
    }

    if (deletedTurnIds.size > 0) {
      const activeAttempts = getActiveAttempts(conversationId);
      for (const deletedTurnId of deletedTurnIds) {
        delete activeAttempts[deletedTurnId];
      }
      stmts().updateActiveAttempts.run(JSON.stringify(activeAttempts), conversationId);
    }

    stmts().updateConversationTime.run(conversationId);
  })();
}

/** 按 ID 删除指定消息（用于 compact 压缩旧消息） */
export function deleteMessagesByIds(conversationId: string, ids: string[]): void {
  ensureInitialized();
  if (ids.length === 0) return;
  const deleteStmt = db().prepare('DELETE FROM messages WHERE id = ? AND conversation_id = ?');
  db().transaction(() => {
    for (const id of ids) {
      deleteStmt.run(id, conversationId);
    }
    stmts().updateConversationTime.run(conversationId);
  })();
}

export function findConversationIdByTaskId(taskId: string): string | null {
  ensureInitialized();
  try {
    const row = _db!.prepare(`
      SELECT conversation_id FROM messages
      WHERE content LIKE ? OR tool_calls LIKE ?
      LIMIT 1
    `).get(`%${taskId}%`, `%${taskId}%`) as { conversation_id: string } | undefined;
    return row?.conversation_id ?? null;
  } catch (err) {
    console.warn(`[db] findConversationIdByTaskId error for task ${taskId}:`, err);
    return null;
  }
}

export function closeDatabase() {
  if (_db) {
    _db.close();
    _db = null;
    _stmts = null;
  }
}
