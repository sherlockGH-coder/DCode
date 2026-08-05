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
  ProviderContentBlock,
  ServerToolUse,
} from '../shared/types';
import { initializeSchema } from './database/schema';
import { prepareStatements } from './database/statements';
import { applyConnectionPragmas, checkpointWal } from './database/pragmas';
import { applyMigrations } from './database/migrations';

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

  applyConnectionPragmas(_db);

  initializeSchema(_db);

  // Remove legacy orphan rows before enabling foreign-key enforcement so old data does not violate constraints.
  applyMigrations(_db);

  // This must be set outside a transaction, after schema creation and cleanup.
  _db.pragma('foreign_keys = ON');

  _stmts = prepareStatements(_db);
}

function db(): Database.Database { ensureInitialized(); return _db!; }
function stmts() { ensureInitialized(); return _stmts!; }

export function getDbDir(): string { ensureInitialized(); return _dbDir!; }
export function getDbPath(): string { ensureInitialized(); return _dbPath!; }
export function getRawDatabase(): Database.Database { ensureInitialized(); return _db!; }

/**
 * Flush the WAL and close the connection before exit.
 * Data is not lost when this is not called, but the WAL file remains in userData and keeps growing.
 */
export function closeDatabase(): void {
  if (!_db) return;
  checkpointWal(_db);
  try {
    _db.close();
  } catch (err) {
    console.warn('[database] close failed:', err instanceof Error ? err.message : String(err));
  }
  _db = null;
  _stmts = null;
}

interface CreateConversationOptions {
  parentConversationId?: string | null;
  rootConversationId?: string | null;
  agentRole?: string | null;
  agentStatus?: AgentRunStatus | null;
  agentTaskName?: string | null;
}

/** Create a conversation and return its ID. projectPath may be null for an unassigned conversation. */
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
 * Get the conversation list.
 * - no argument = all conversations;
 * - project path = conversations in that project;
 * - null = unassigned conversations only.
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

/** Get one conversation, used to read project_path from IPC. */
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

/** Update a conversation title. */
export function updateConversationTitle(id: string, title: string) {
  ensureInitialized();
  stmts().updateConversationTitle.run(title, id);
}

/** Update a conversation's context summary and compaction boundary message ID. */
export function updateConversationSummary(id: string, summary: string | null, compactedToMessageId: string | null): void {
  ensureInitialized();
  stmts().updateConversationSummary.run(summary, compactedToMessageId, id);
}

export function updateAgentConversationStatus(id: string, status: AgentRunStatus): void {
  ensureInitialized();
  stmts().updateAgentConversationStatus.run(status, id);
}

/**
 * Delete a conversation and all dependent data.
 *
 * Foreign-key cascading is enabled, but deletion remains explicit and transactional:
 * the explicit order keeps intent readable, and the transaction prevents a crash from leaving a half-deleted conversation.
 */
export function deleteConversation(id: string) {
  ensureInitialized();

  db().transaction(() => {
    stmts().deletePlanExecutionRuns.run(id);
    stmts().deletePlanArtifacts.run(id);
    stmts().deleteMessages.run(id);
    stmts().deleteConversation.run(id);
  })();
}

/** Add a message. An external ID may be supplied to keep renderer, main, and DB IDs aligned; otherwise generate one. */
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
  serverToolUses?: ServerToolUse[],
  providerContentBlocks?: ProviderContentBlock[],
): string {
  ensureInitialized();
  const finalId = id ?? randomUUID();
  const toolCallsJson = toolCalls ? JSON.stringify(toolCalls) : null;
  const metadataJson = metadata ? JSON.stringify(metadata) : null;
  const attachmentsJson = attachments && attachments.length > 0 ? JSON.stringify(attachments) : null;
  const usageJson = usage ? JSON.stringify(usage) : null;
  const contentBlocksJson = contentBlocks && contentBlocks.length > 0 ? JSON.stringify(contentBlocks) : null;
  const serverToolUsesJson = serverToolUses && serverToolUses.length > 0 ? JSON.stringify(serverToolUses) : null;
  const providerContentBlocksJson = providerContentBlocks && providerContentBlocks.length > 0
    ? JSON.stringify(providerContentBlocks)
    : null;

  db().transaction(() => {
    const conversation = stmts().getConversationById.get(conversationId) as { current_context_epoch?: number } | undefined;
    const epoch = contextEpoch ?? conversation?.current_context_epoch ?? 0;
    stmts().addMessage.run(finalId, conversationId, role, content, toolCallsJson, toolCallId || null, metadataJson, reasoningContent || null, attachmentsJson, name || null, error ? 1 : null, usageJson, duration || null, turnId || null, attemptNo ?? null, seq ?? null, contentBlocksJson, epoch, origin, planArtifactId ?? null, serverToolUsesJson, providerContentBlocksJson);
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

/** Get all messages for a conversation. */
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
    serverToolUses: safeJsonParse(row.server_tool_uses, undefined),
    providerContentBlocks: safeJsonParse(row.provider_content_blocks, undefined),
    contextEpoch: row.context_epoch ?? 0,
    origin: row.origin ?? 'chat',
    planArtifactId: row.plan_artifact_id ?? undefined,
    error: row.error === 1 ? true : undefined,
    turnId: row.turn_id ?? undefined,
    attemptNo: row.attempt_no ?? undefined,
    seq: row.seq ?? undefined,
  }));
}

/** Read the conversation's active-attempt mapping. */
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

/** Replace the conversation's active-attempt mapping. */
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

/** Delete a message and all following messages, used to truncate edit-and-retry history. */
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

/** Delete a turn and all following messages, used to undo and roll back the later timeline. */
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
