import type Database from 'better-sqlite3';

/**
 * 版本化迁移。
 *
 * `initializeSchema` 负责建表与补列（幂等），这里只放那些「一次性数据修复」。
 * 版本 1 是历史基线，由 `initializeSchema` 写入。
 */

interface Migration {
  version: number;
  description: string;
  run: (database: Database.Database) => void;
}

/**
 * 清理孤儿行。
 *
 * `plan_artifacts` / `plan_execution_runs` 声明了 `ON DELETE CASCADE`，但连接从未
 * 打开 `PRAGMA foreign_keys`，级联一直没生效，而 `deleteConversation` 也只手动删了
 * messages。结果是每删一个对话就在这两张表里永久留下孤儿行。
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
