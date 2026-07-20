import { describe, expect, it, vi } from 'vitest';
import { initializeSchema } from './schema';

describe('database schema', () => {
  it('does not create indexes on SQLite rowid pseudo-columns', () => {
    const database = {
      exec: vi.fn(),
    };

    initializeSchema(database as any);

    const executedSql = database.exec.mock.calls.map(([sql]) => sql).join('\n');
    expect(executedSql).not.toMatch(/CREATE\s+INDEX[\s\S]*ON\s+messages\s*\([^)]*\browid\b/i);
    expect(executedSql).toContain('idx_messages_turn_id');
  });
});
