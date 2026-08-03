import { DatabaseSync } from 'node:sqlite';
import type Database from 'better-sqlite3';

/**
 * SQLite driver adapter for tests.
 *
 * Production uses better-sqlite3, whose native module is compiled for Electron's ABI
 * and fails to load in vitest using system Node because NODE_MODULE_VERSION does not match.
 * Use Node's built-in `node:sqlite`, also a real SQLite engine, and implement only the small
 * subset of the better-sqlite3 interface used by schema and migration code so tests run real SQL instead of mocks.
 */

function parsePragmaAssignment(source: string): { name: string; value: string | null } {
  const eq = source.indexOf('=');
  if (eq === -1) return { name: source.trim(), value: null };
  return { name: source.slice(0, eq).trim(), value: source.slice(eq + 1).trim() };
}

/**
 * When `path` is omitted, use an in-memory database. In-memory databases do not support WAL,
 * so tests that verify journal_mode must provide a real file path.
 */
export function createTestDatabase(path = ':memory:'): Database.Database {
  const raw = new DatabaseSync(path);

  // node:sqlite enables foreign keys by default while better-sqlite3 disables them.
  // Match the production default so legacy orphan-row scenarios can be constructed.
  raw.exec('PRAGMA foreign_keys = OFF');

  const adapter = {
    exec(sql: string) {
      raw.exec(sql);
      return adapter;
    },

    prepare(sql: string) {
      const stmt = raw.prepare(sql);
      return {
        run: (...params: unknown[]) => stmt.run(...(params as never[])),
        get: (...params: unknown[]) => stmt.get(...(params as never[])),
        all: (...params: unknown[]) => stmt.all(...(params as never[])),
      };
    },

    pragma(source: string, options?: { simple?: boolean }) {
      const { name, value } = parsePragmaAssignment(source);
      if (value !== null) {
        raw.exec(`PRAGMA ${name} = ${value}`);
        return undefined;
      }
      const row = raw.prepare(`PRAGMA ${name}`).get() as Record<string, unknown> | undefined;
      if (!row) return options?.simple ? undefined : [];
      return options?.simple ? Object.values(row)[0] : [row];
    },

    transaction(fn: (...args: unknown[]) => unknown) {
      return (...args: unknown[]) => {
        raw.exec('BEGIN');
        try {
          const result = fn(...args);
          raw.exec('COMMIT');
          return result;
        } catch (err) {
          raw.exec('ROLLBACK');
          throw err;
        }
      };
    },

    close() {
      raw.close();
    },
  };

  return adapter as unknown as Database.Database;
}
