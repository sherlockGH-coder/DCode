import type Database from 'better-sqlite3';

/**
 * 连接级 PRAGMA。
 *
 * `foreign_keys` 不在这里设置——它必须等到建表与孤儿行清理之后再打开，
 * 见 `database.ts` 的 `ensureInitialized`。
 */
export function applyConnectionPragmas(database: Database.Database): void {
  // WAL：读写不互相阻塞
  database.pragma('journal_mode = WAL');

  // WAL 下 NORMAL 是官方推荐搭配：每次提交不再 fsync，只在 checkpoint 时同步。
  // 断电最坏情况是丢掉最近若干次提交，不会损坏数据库。
  database.pragma('synchronous = NORMAL');

  // 负数表示 KiB，这里约 64MB 页缓存
  database.pragma('cache_size = -65536');

  // 内存映射读取，减少大表扫描的 read() 系统调用（256MB）
  database.pragma('mmap_size = 268435456');

  // 临时表/排序放内存
  database.pragma('temp_store = MEMORY');

  // 有并发写入时不要立刻抛 SQLITE_BUSY
  database.pragma('busy_timeout = 5000');
}

/**
 * 把 WAL 回写进主库并截断日志。应用退出前调用，避免 WAL 文件无限增长。
 */
export function checkpointWal(database: Database.Database): void {
  try {
    database.pragma('wal_checkpoint(TRUNCATE)');
  } catch (err) {
    console.warn('[database] WAL checkpoint failed:', err instanceof Error ? err.message : String(err));
  }
}
