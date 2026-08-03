import type Database from 'better-sqlite3';

/**
 * Connection-level PRAGMAs.
 *
 * `foreign_keys` is not set here; it must be enabled after schema creation and orphan cleanup.
 * See `ensureInitialized` in `database.ts`.
 */
export function applyConnectionPragmas(database: Database.Database): void {
  // WAL: reads and writes do not block each other.
  database.pragma('journal_mode = WAL');

  // NORMAL is the recommended WAL pairing: commits do not fsync every time, only at checkpoints.
  // A power loss can discard the latest few commits at worst, without corrupting the database.
  database.pragma('synchronous = NORMAL');

  // Negative values represent KiB; this is approximately a 64 MB page cache.
  database.pragma('cache_size = -65536');

  // Memory-mapped reads reduce read() system calls during large table scans (256 MB).
  database.pragma('mmap_size = 268435456');

  // Keep temporary tables and sorting in memory.
  database.pragma('temp_store = MEMORY');

  // Do not throw SQLITE_BUSY immediately when writes are concurrent.
  database.pragma('busy_timeout = 5000');
}

/**
 * Flush the WAL into the main database and truncate the log. Call before app exit to prevent unbounded WAL growth.
 */
export function checkpointWal(database: Database.Database): void {
  try {
    database.pragma('wal_checkpoint(TRUNCATE)');
  } catch (err) {
    console.warn('[database] WAL checkpoint failed:', err instanceof Error ? err.message : String(err));
  }
}
