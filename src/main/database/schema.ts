import type Database from 'better-sqlite3';

function safeAddColumn(
  database: Database.Database,
  table: string,
  column: string,
  type: string,
): void {
  try {
    database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    if (!errMsg.toLowerCase().includes('duplicate column')) {
      console.warn(`[schema] Failed to add column ${table}.${column}:`, errMsg);
    }
  }
}

export function initializeSchema(database: Database.Database): void {
  database.exec(`
    -- 对话表
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 消息表
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT,
      tool_calls TEXT,
      tool_call_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );

    -- 索引：加速按对话查询消息
    CREATE INDEX IF NOT EXISTS idx_messages_conversation
      ON messages(conversation_id, created_at);
  `);

  safeAddColumn(database, 'messages', 'metadata', 'TEXT');
  safeAddColumn(database, 'messages', 'reasoning_content', 'TEXT');
  safeAddColumn(database, 'messages', 'attachments', 'TEXT');
  safeAddColumn(database, 'messages', 'name', 'TEXT');
  safeAddColumn(database, 'messages', 'error', 'INTEGER');
  safeAddColumn(database, 'messages', 'usage', 'TEXT');
  safeAddColumn(database, 'messages', 'duration', 'INTEGER');
  safeAddColumn(database, 'messages', 'turn_id', 'TEXT');
  safeAddColumn(database, 'messages', 'attempt_no', 'INTEGER');
  safeAddColumn(database, 'messages', 'seq', 'INTEGER');
  safeAddColumn(database, 'messages', 'content_blocks', 'TEXT');
  safeAddColumn(database, 'messages', 'context_epoch', 'INTEGER DEFAULT 0');
  safeAddColumn(database, 'messages', 'origin', "TEXT DEFAULT 'chat'");
  safeAddColumn(database, 'messages', 'plan_artifact_id', 'TEXT');

  safeAddColumn(database, 'conversations', 'active_attempts', 'TEXT');
  safeAddColumn(database, 'conversations', 'source', "TEXT DEFAULT 'manual'");
  safeAddColumn(database, 'conversations', 'source_job_id', 'TEXT');
  safeAddColumn(database, 'conversations', 'parent_conversation_id', 'TEXT');
  safeAddColumn(database, 'conversations', 'root_conversation_id', 'TEXT');
  safeAddColumn(database, 'conversations', 'agent_role', 'TEXT');
  safeAddColumn(database, 'conversations', 'agent_status', 'TEXT');
  safeAddColumn(database, 'conversations', 'agent_task_name', 'TEXT');
  safeAddColumn(database, 'conversations', 'character_id', 'TEXT');
  safeAddColumn(database, 'conversations', 'project_path', 'TEXT');
  safeAddColumn(database, 'conversations', 'summary', 'TEXT');
  safeAddColumn(database, 'conversations', 'compacted_to_message_id', 'TEXT');
  safeAddColumn(database, 'conversations', 'collaboration_mode', "TEXT DEFAULT 'execute'");
  safeAddColumn(database, 'conversations', 'mode_revision', 'INTEGER DEFAULT 0');
  safeAddColumn(database, 'conversations', 'content_revision', 'INTEGER DEFAULT 0');
  safeAddColumn(database, 'conversations', 'current_context_epoch', 'INTEGER DEFAULT 0');
  safeAddColumn(database, 'conversations', 'active_plan_artifact_id', 'TEXT');

  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS plan_artifacts (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      source_turn_id TEXT NOT NULL,
      source_attempt_no INTEGER NOT NULL,
      base_content_revision INTEGER NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      implementation_steps TEXT NOT NULL,
      test_plan TEXT NOT NULL,
      assumptions TEXT NOT NULL,
      markdown TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      status TEXT NOT NULL,
      invalidation_reason TEXT,
      decision_feedback TEXT,
      execution_strategy TEXT,
      execution_turn_id TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      presented_at DATETIME,
      decided_at DATETIME,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
      UNIQUE (conversation_id, version)
    );

    CREATE TABLE IF NOT EXISTS plan_execution_runs (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      plan_artifact_id TEXT NOT NULL,
      execution_turn_id TEXT NOT NULL,
      strategy TEXT NOT NULL,
      status TEXT NOT NULL,
      context_epoch INTEGER NOT NULL,
      error TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      started_at DATETIME,
      completed_at DATETIME,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
      FOREIGN KEY (plan_artifact_id) REFERENCES plan_artifacts(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_plan_artifacts_conversation
      ON plan_artifacts(conversation_id, version DESC);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_plan_artifacts_one_pending
      ON plan_artifacts(conversation_id) WHERE status = 'pending_approval';
    CREATE INDEX IF NOT EXISTS idx_plan_execution_runs_conversation
      ON plan_execution_runs(conversation_id, created_at DESC);
  `);

  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_conversations_source
      ON conversations(source, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_conversations_agent_root
      ON conversations(root_conversation_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_conversations_project
      ON conversations(project_path, updated_at DESC);

    -- 优化 deleteMessagesFromTurn 查询：turn_id 索引
    CREATE INDEX IF NOT EXISTS idx_messages_turn_id
      ON messages(conversation_id, turn_id);
    CREATE INDEX IF NOT EXISTS idx_messages_context_epoch
      ON messages(conversation_id, context_epoch);
  `);

  database.exec('INSERT OR IGNORE INTO schema_migrations(version) VALUES (1);');
}
