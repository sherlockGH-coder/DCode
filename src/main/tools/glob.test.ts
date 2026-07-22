import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { mkdir, mkdtemp, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { globTool } from './glob';
import type { ToolExecuteResult, ToolExecutionContext } from './types';

async function withProject<T>(fn: (projectRoot: string) => Promise<T>): Promise<T> {
  const projectRoot = await mkdtemp(join(tmpdir(), 'deepseek-glob-'));
  try {
    return await fn(projectRoot);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
}

function context(projectRoot: string): ToolExecutionContext {
  return {
    projectPath: projectRoot,
    toolCallId: 'call_glob',
  };
}

async function executeGlob(args: Record<string, unknown>, projectRoot: string): Promise<ToolExecuteResult> {
  const result = await globTool.execute(args, context(projectRoot));
  return typeof result === 'string' ? { content: result } : result;
}

describe('glob tool', () => {
  it('uses concise Claude-style guidance and pagination schema', () => {
    expect(globTool.definition.description).toContain('Fast file-name search');
    expect(globTool.definition.description).toContain('sorted by recent modification time');

    const schema = globTool.definition.input_schema as {
      properties: Record<string, Record<string, unknown>>;
      additionalProperties?: boolean;
    };
    expect(schema.properties.limit.default).toBe(100);
    expect(schema.properties.offset.default).toBe(0);
    expect(schema.additionalProperties).toBe(false);
  });

  it('returns matching files by modification time with limit and offset', async () => {
    await withProject(async (projectRoot) => {
      await mkdir(join(projectRoot, 'src'));
      const older = join(projectRoot, 'src', 'older.ts');
      const newer = join(projectRoot, 'src', 'newer.ts');
      await writeFile(older, 'older', 'utf-8');
      await writeFile(newer, 'newer', 'utf-8');
      await utimes(older, new Date('2024-01-01T00:00:00Z'), new Date('2024-01-01T00:00:00Z'));
      await utimes(newer, new Date('2024-01-02T00:00:00Z'), new Date('2024-01-02T00:00:00Z'));

      const first = await executeGlob({ pattern: 'src/**/*.ts', limit: 1 }, projectRoot);
      const second = await executeGlob({ pattern: 'src/**/*.ts', limit: 1, offset: 1 }, projectRoot);

      expect(first.content).toContain('src/newer.ts');
      expect(first.content).not.toContain('src/older.ts');
      expect(first.content).toContain('offset: 1');
      expect(second.content).toContain('src/older.ts');
      expect(second.metadata).toMatchObject({ kind: 'glob', pattern: 'src/**/*.ts', matchCount: 2 });
    });
  });
});
