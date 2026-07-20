import type Database from 'better-sqlite3';

export function prepareStatements(database: Database.Database): Record<string, Database.Statement> {
  return {
    createConversation: database.prepare(`
      INSERT INTO conversations (
        id,
        title,
        project_path,
        source,
        source_job_id,
        character_id,
        parent_conversation_id,
        root_conversation_id,
        agent_role,
        agent_status,
        agent_task_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),

    getConversations: database.prepare(`
      SELECT * FROM conversations
      WHERE character_id IS NULL AND (source IS NULL OR source != 'agent')
      ORDER BY updated_at DESC
    `),

    getConversationsByProject: database.prepare(`
      SELECT * FROM conversations
      WHERE project_path = ? AND character_id IS NULL AND (source IS NULL OR source != 'agent')
      ORDER BY updated_at DESC
    `),

    getConversationsWithoutProject: database.prepare(`
      SELECT * FROM conversations
      WHERE project_path IS NULL AND character_id IS NULL AND (source IS NULL OR source != 'agent')
      ORDER BY updated_at DESC
    `),

    getConversationById: database.prepare(`
      SELECT * FROM conversations WHERE id = ?
    `),

    updateConversationTitle: database.prepare(`
      UPDATE conversations SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `),

    updateConversationSummary: database.prepare(`
      UPDATE conversations SET summary = ?, compacted_to_message_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `),

    updateConversationTime: database.prepare(`
      UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `),

    updateAgentConversationStatus: database.prepare(`
      UPDATE conversations SET agent_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `),

    deleteConversation: database.prepare(`
      DELETE FROM conversations WHERE id = ?
    `),

    addMessage: database.prepare(`
      INSERT INTO messages (id, conversation_id, role, content, tool_calls, tool_call_id, metadata, reasoning_content, attachments, name, error, usage, duration, turn_id, attempt_no, seq, content_blocks, context_epoch, origin, plan_artifact_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),

    getMessages: database.prepare(`
      SELECT * FROM messages WHERE conversation_id = ? ORDER BY rowid ASC
    `),

    deleteMessages: database.prepare(`
      DELETE FROM messages WHERE conversation_id = ?
    `),

    getMaxAttemptNo: database.prepare(`
      SELECT MAX(attempt_no) as maxNo FROM messages WHERE conversation_id = ? AND turn_id = ?
    `),

    updateActiveAttempts: database.prepare(`
      UPDATE conversations SET active_attempts = ? WHERE id = ?
    `),

    getAgentConversationsByRoot: database.prepare(`
      SELECT * FROM conversations WHERE source = 'agent' AND root_conversation_id = ? ORDER BY updated_at DESC
    `),
  };
}
