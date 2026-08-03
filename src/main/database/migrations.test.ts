import { describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type Database from 'better-sqlite3';
import { initializeSchema } from './schema';
import { applyMigrations } from './migrations';
import { applyConnectionPragmas } from './pragmas';
import { createTestDatabase } from './__testing__/sqliteTestDriver';

function freshDb(): Database.Database {
  const database = createTestDatabase();
  applyConnectionPragmas(database);
  initializeSchema(database);
  return database;
}

function insertConversation(database: Database.Database, id: string): void {
  database.prepare('INSERT INTO conversations (id, title) VALUES (?, ?)').run(id, `conv ${id}`);
}

function insertPlanArtifact(database: Database.Database, id: string, conversationId: string): void {
  database
    .prepare(
      `INSERT INTO plan_artifacts
       (id, conversation_id, version, source_turn_id, source_attempt_no, base_content_revision,
        title, summary, implementation_steps, test_plan, assumptions, markdown, content_hash, status)
       VALUES (?, ?, 1, 't1', 1, 0, 'title', 'summary', '[]', '[]', '[]', '# plan', 'hash', 'approved')`,
    )
    .run(id, conversationId);
}

function insertPlanRun(
  database: Database.Database,
  id: string,
  conversationId: string,
  artifactId: string,
): void {
  database
    .prepare(
      `INSERT INTO plan_execution_runs
       (id, conversation_id, plan_artifact_id, execution_turn_id, strategy, status, context_epoch)
       VALUES (?, ?, ?, 't1', 'direct', 'completed', 0)`,
    )
    .run(id, conversationId, artifactId);
}

describe('applyConnectionPragmas', () => {
  // In-memory databases do not support WAL, so use a real file to verify journal_mode.
  it('pairs WAL with synchronous=NORMAL on a file-backed database', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'deepseek-db-'));
    try {
      const database = createTestDatabase(join(dir, 'chat.db'));
      applyConnectionPragmas(database);

      expect(String(database.pragma('journal_mode', { simple: true })).toLowerCase()).toBe('wal');
      // NORMAL == 1
      expect(database.pragma('synchronous', { simple: true })).toBe(1);

      database.close();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe('orphan purge migration', () => {
  it('removes plan rows whose conversation is gone and keeps live ones', () => {
    const database = freshDb();

    insertConversation(database, 'live');
    insertPlanArtifact(database, 'artifact-live', 'live');
    insertPlanRun(database, 'run-live', 'live', 'artifact-live');

    // Simulate legacy behavior: a conversation was deleted with foreign keys disabled, leaving plan rows behind.
    insertConversation(database, 'ghost');
    insertPlanArtifact(database, 'artifact-ghost', 'ghost');
    insertPlanRun(database, 'run-ghost', 'ghost', 'artifact-ghost');
    database.prepare('DELETE FROM conversations WHERE id = ?').run('ghost');
    database.prepare('INSERT INTO messages (id, conversation_id, role) VALUES (?, ?, ?)').run(
      'msg-ghost',
      'ghost',
      'user',
    );

    expect(database.prepare('SELECT COUNT(*) c FROM plan_artifacts').get()).toMatchObject({ c: 2 });

    applyMigrations(database);

    expect(database.prepare('SELECT COUNT(*) c FROM plan_artifacts').get()).toMatchObject({ c: 1 });
    expect(database.prepare('SELECT COUNT(*) c FROM plan_execution_runs').get()).toMatchObject({ c: 1 });
    expect(database.prepare('SELECT COUNT(*) c FROM messages').get()).toMatchObject({ c: 0 });
    expect(database.prepare('SELECT id FROM plan_artifacts').get()).toMatchObject({ id: 'artifact-live' });

    database.close();
  });

  it('is idempotent and records its version', () => {
    const database = freshDb();
    applyMigrations(database);
    applyMigrations(database);

    const versions = (database.prepare('SELECT version FROM schema_migrations ORDER BY version').all() as Array<{
      version: number;
    }>).map((row) => row.version);
    expect(versions).toContain(2);
    expect(new Set(versions).size).toBe(versions.length);

    database.close();
  });
});

describe('foreign key enforcement', () => {
  it('cascades plan rows once foreign_keys is on', () => {
    const database = freshDb();
    applyMigrations(database);
    database.pragma('foreign_keys = ON');

    insertConversation(database, 'c1');
    insertPlanArtifact(database, 'a1', 'c1');
    insertPlanRun(database, 'r1', 'c1', 'a1');
    database.prepare('INSERT INTO messages (id, conversation_id, role) VALUES (?, ?, ?)').run('m1', 'c1', 'user');

    database.prepare('DELETE FROM conversations WHERE id = ?').run('c1');

    expect(database.prepare('SELECT COUNT(*) c FROM messages').get()).toMatchObject({ c: 0 });
    expect(database.prepare('SELECT COUNT(*) c FROM plan_artifacts').get()).toMatchObject({ c: 0 });
    expect(database.prepare('SELECT COUNT(*) c FROM plan_execution_runs').get()).toMatchObject({ c: 0 });

    database.close();
  });

  it('rejects a plan artifact pointing at a missing conversation', () => {
    const database = freshDb();
    applyMigrations(database);
    database.pragma('foreign_keys = ON');

    expect(() => insertPlanArtifact(database, 'a1', 'does-not-exist')).toThrow(/FOREIGN KEY/i);

    database.close();
  });
});
