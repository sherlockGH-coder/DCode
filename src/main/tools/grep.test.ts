import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { grepTool } from './grep';
import type { ToolExecuteResult, ToolExecutionContext } from './types';

async function withProject<T>(fn: (projectRoot: string) => Promise<T>): Promise<T> {
  const projectRoot = await mkdtemp(join(tmpdir(), 'dcode-grep-'));
  try {
    return await fn(projectRoot);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
}

function context(projectRoot: string): ToolExecutionContext {
  return {
    projectPath: projectRoot,
    toolCallId: 'call_grep',
  };
}

async function executeGrep(args: Record<string, unknown>, projectRoot: string): Promise<ToolExecuteResult> {
  const result = await grepTool.execute(args, context(projectRoot));
  return typeof result === 'string' ? { content: result } : result;
}

describe('grep tool', () => {
  it('uses concise Claude-style guidance and ripgrep-style schema aliases', () => {
    expect(grepTool.definition.description).toContain('Fast regex search');
    expect(grepTool.definition.description).toContain('Use this instead of bash grep/rg');

    const schema = grepTool.definition.input_schema as {
      properties: Record<string, Record<string, unknown>>;
      additionalProperties?: boolean;
    };
    expect(schema.properties.type.type).toBe('string');
    expect(schema.properties.context.description).toContain('rg -C');
    expect(schema.properties['-i'].description).toContain('Case-insensitive');
    expect(schema.properties.head_limit.default).toBe(250);
    expect(schema.additionalProperties).toBe(false);
  });

  it('filters content searches with path-aware glob patterns', async () => {
    await withProject(async (projectRoot) => {
      await mkdir(join(projectRoot, 'src'));
      await writeFile(join(projectRoot, 'src', 'App.tsx'), 'export const Needle = true;\n', 'utf-8');
      await writeFile(join(projectRoot, 'src', 'App.ts'), 'export const Needle = true;\n', 'utf-8');

      const result = await executeGrep({
        pattern: 'Needle',
        glob: 'src/**/*.tsx',
      }, projectRoot);

      expect(result.content).toContain('src/App.tsx');
      expect(result.content).not.toContain('src/App.ts\n');
      expect(result.metadata).toMatchObject({ kind: 'grep', pattern: 'Needle', matchCount: 1, fileCount: 1 });
    });
  });

  it('supports type, case-insensitive search, and context aliases in content mode', async () => {
    await withProject(async (projectRoot) => {
      await writeFile(join(projectRoot, 'main.py'), 'before\nNeedle\nafter\n', 'utf-8');
      await writeFile(join(projectRoot, 'main.ts'), 'Needle\n', 'utf-8');

      const result = await executeGrep({
        pattern: 'needle',
        type: 'py',
        output_mode: 'content',
        '-i': true,
        '-C': 1,
      }, projectRoot);

      expect(result.content).toContain('main.py:1: before');
      expect(result.content).toContain('main.py:2: Needle');
      expect(result.content).toContain('main.py:3: after');
      expect(result.content).not.toContain('main.ts');
      expect(result.metadata).toMatchObject({ kind: 'grep', pattern: 'needle', matchCount: 1, fileCount: 1 });
    });
  });
});
