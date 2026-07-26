import { DatabaseSync } from 'node:sqlite';
import type Database from 'better-sqlite3';

/**
 * 测试用的 SQLite 驱动适配层。
 *
 * 生产环境用 better-sqlite3，但它的原生模块是按 Electron 的 ABI 编译的，
 * 在 vitest（系统 Node）里加载会因 NODE_MODULE_VERSION 不匹配而失败。
 * 这里用 Node 内置的 `node:sqlite` —— 同样是真正的 SQLite 引擎 —— 补出
 * schema/migration 代码用到的那一小部分 better-sqlite3 接口，
 * 这样测试跑的是真实 SQL，而不是 mock。
 */

function parsePragmaAssignment(source: string): { name: string; value: string | null } {
  const eq = source.indexOf('=');
  if (eq === -1) return { name: source.trim(), value: null };
  return { name: source.slice(0, eq).trim(), value: source.slice(eq + 1).trim() };
}

/**
 * `path` 省略时用内存库。注意内存库不支持 WAL —— 需要验证 journal_mode 的
 * 测试必须传入真实文件路径。
 */
export function createTestDatabase(path = ':memory:'): Database.Database {
  const raw = new DatabaseSync(path);

  // node:sqlite 默认打开外键，better-sqlite3 默认关闭。
  // 对齐生产默认值，好让「历史遗留孤儿行」的场景能被构造出来。
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
