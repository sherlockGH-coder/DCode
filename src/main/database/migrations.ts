import type Database from 'better-sqlite3';

/**
 * Versioned migrations.
 *
 * `initializeSchema` creates tables and adds columns idempotently; this file contains one-time data repairs.
 * Version 1 is the historical baseline written by `initializeSchema`.
 */

interface Migration {
  version: number;
  description: string;
  run: (database: Database.Database) => void;
}

/**
 * Clean up orphan rows.
 *
 * `plan_artifacts` and `plan_execution_runs` declare `ON DELETE CASCADE`, but the connection never
 * enabled `PRAGMA foreign_keys`. Cascading never ran, while `deleteConversation` only deleted
 * messages, leaving permanent orphan rows in these tables after every conversation deletion.
 */
function purgeOrphanedRows(database: Database.Database): void {
  database.exec(`
    DELETE FROM messages
    WHERE conversation_id NOT IN (SELECT id FROM conversations);

    DELETE FROM plan_artifacts
    WHERE conversation_id NOT IN (SELECT id FROM conversations);

    DELETE FROM plan_execution_runs
    WHERE conversation_id NOT IN (SELECT id FROM conversations)
       OR plan_artifact_id NOT IN (SELECT id FROM plan_artifacts);
  `);
}

const MIGRATIONS: Migration[] = [
  {
    version: 2,
    description: 'purge rows orphaned while foreign_keys enforcement was off',
    run: purgeOrphanedRows,
  },
];

export function applyMigrations(database: Database.Database): void {
  let applied: Set<number>;
  try {
    const rows = database.prepare('SELECT version FROM schema_migrations').all() as Array<{ version: number }>;
    applied = new Set(rows.map((row) => row.version));
  } catch (err) {
    console.warn('[migrations] Could not read schema_migrations:', err instanceof Error ? err.message : String(err));
    return;
  }

  const record = database.prepare('INSERT OR IGNORE INTO schema_migrations(version) VALUES (?)');

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.version)) continue;
    try {
      database.transaction(() => {
        migration.run(database);
        record.run(migration.version);
      })();
    } catch (err) {
      console.warn(
        `[migrations] Migration ${migration.version} (${migration.description}) failed:`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }
}
