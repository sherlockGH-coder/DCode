import { describe, expect, it, vi } from 'vitest';
import { createTestDatabase } from './__testing__/sqliteTestDriver';
import { prepareStatements } from './statements';
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

  it('persists ordered provider content blocks with an assistant message', () => {
    const database = createTestDatabase();
    initializeSchema(database);
    const statements = prepareStatements(database);
    const providerBlocks = JSON.stringify([
      { type: 'server_tool_use', id: 'search_1', name: 'web_search', input: { query: 'DeepSeek docs' } },
      { type: 'web_search_tool_result', tool_use_id: 'search_1', content: [] },
    ]);

    statements.createConversation.run(
      'conversation_1',
      'Search',
      '/project',
      'manual',
      null,
      null,
      null,
      null,
      null,
      null,
      null,
    );
    statements.addMessage.run(
      'message_1',
      'conversation_1',
      'assistant',
      '',
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      0,
      null,
      0,
      'chat',
      null,
      null,
      providerBlocks,
    );

    const row = database.prepare('SELECT provider_content_blocks FROM messages WHERE id = ?').get('message_1') as {
      provider_content_blocks: string;
    };
    expect(JSON.parse(row.provider_content_blocks)).toEqual(JSON.parse(providerBlocks));
    database.close();
  });
});
