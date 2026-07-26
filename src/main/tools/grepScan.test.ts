import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { grepTool } from './grep';
import { globTool } from './glob';
import type { ToolExecuteResult, ToolExecutionContext } from './types';

async function withProject<T>(fn: (projectRoot: string) => Promise<T>): Promise<T> {
  const projectRoot = await mkdtemp(join(tmpdir(), 'deepseek-grepscan-'));
  try {
    return await fn(projectRoot);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
}

function context(projectRoot: string): ToolExecutionContext {
  return { projectPath: projectRoot, toolCallId: 'call_scan' };
}

async function runGrep(args: Record<string, unknown>, root: string): Promise<ToolExecuteResult> {
  const result = await grepTool.execute(args, context(root));
  return typeof result === 'string' ? { content: result } : result;
}

async function runGlob(args: Record<string, unknown>, root: string): Promise<ToolExecuteResult> {
  const result = await globTool.execute(args, context(root));
  return typeof result === 'string' ? { content: result } : result;
}

describe('grep/glob .gitignore awareness', () => {
  it('skips gitignored directories by default and includes them with no_ignore', async () => {
    await withProject(async (root) => {
      await writeFile(join(root, '.gitignore'), 'release/\n', 'utf-8');
      await mkdir(join(root, 'src'));
      await mkdir(join(root, 'release'));
      await writeFile(join(root, 'src', 'a.ts'), 'const NEEDLE = 1;\n', 'utf-8');
      await writeFile(join(root, 'release', 'bundle.ts'), 'const NEEDLE = 2;\n', 'utf-8');

      const ignored = await runGrep({ pattern: 'NEEDLE' }, root);
      expect(ignored.content).toContain('src/a.ts');
      expect(ignored.content).not.toContain('release/bundle.ts');

      const included = await runGrep({ pattern: 'NEEDLE', no_ignore: true }, root);
      expect(included.content).toContain('src/a.ts');
      expect(included.content).toContain('release/bundle.ts');
    });
  });

  it('honours gitignore negation so re-included files stay searchable', async () => {
    await withProject(async (root) => {
      await writeFile(join(root, '.gitignore'), '*.md\n!README.md\n', 'utf-8');
      await writeFile(join(root, 'README.md'), 'NEEDLE here\n', 'utf-8');
      await writeFile(join(root, 'NOTES.md'), 'NEEDLE there\n', 'utf-8');

      const result = await runGrep({ pattern: 'NEEDLE' }, root);
      expect(result.content).toContain('README.md');
      expect(result.content).not.toContain('NOTES.md');
    });
  });

  it('applies nested gitignore rules only within their own subtree', async () => {
    await withProject(async (root) => {
      await mkdir(join(root, 'pkg-a'), { recursive: true });
      await mkdir(join(root, 'pkg-b'), { recursive: true });
      await writeFile(join(root, 'pkg-a', '.gitignore'), 'generated.ts\n', 'utf-8');
      await writeFile(join(root, 'pkg-a', 'generated.ts'), 'NEEDLE a\n', 'utf-8');
      await writeFile(join(root, 'pkg-b', 'generated.ts'), 'NEEDLE b\n', 'utf-8');

      const result = await runGrep({ pattern: 'NEEDLE' }, root);
      expect(result.content).not.toContain('pkg-a/generated.ts');
      expect(result.content).toContain('pkg-b/generated.ts');
    });
  });

  it('applies gitignore to glob as well', async () => {
    await withProject(async (root) => {
      await writeFile(join(root, '.gitignore'), 'build/\n', 'utf-8');
      await mkdir(join(root, 'build'));
      await mkdir(join(root, 'src'));
      await writeFile(join(root, 'src', 'a.ts'), '', 'utf-8');
      await writeFile(join(root, 'build', 'b.ts'), '', 'utf-8');

      const result = await runGlob({ pattern: '**/*.ts' }, root);
      expect(result.content).toContain('src/a.ts');
      expect(result.content).not.toContain('build/b.ts');

      const unfiltered = await runGlob({ pattern: '**/*.ts', no_ignore: true }, root);
      expect(unfiltered.content).toContain('build/b.ts');
    });
  });
});

describe('grep/glob brace expansion', () => {
  // 回归：`{*.ts,*.js}` 曾生成非法正则，两个工具都直接抛错
  it('accepts brace alternatives that begin with a wildcard', async () => {
    await withProject(async (root) => {
      await writeFile(join(root, 'a.ts'), 'NEEDLE\n', 'utf-8');
      await writeFile(join(root, 'b.js'), 'NEEDLE\n', 'utf-8');
      await writeFile(join(root, 'c.md'), 'NEEDLE\n', 'utf-8');

      const grepped = await runGrep({ pattern: 'NEEDLE', glob: '{*.ts,*.js}' }, root);
      expect(grepped.content).toContain('a.ts');
      expect(grepped.content).toContain('b.js');
      expect(grepped.content).not.toContain('c.md');

      const globbed = await runGlob({ pattern: '{*.ts,*.js}' }, root);
      expect(globbed.content).toContain('a.ts');
      expect(globbed.content).toContain('b.js');
      expect(globbed.content).not.toContain('c.md');
    });
  });
});

describe('grep scanning limits', () => {
  it('returns deterministic, sorted results across repeated runs', async () => {
    await withProject(async (root) => {
      await mkdir(join(root, 'src'));
      for (let i = 0; i < 40; i++) {
        await writeFile(join(root, 'src', `f${String(i).padStart(3, '0')}.ts`), 'NEEDLE\n', 'utf-8');
      }

      const first = await runGrep({ pattern: 'NEEDLE', head_limit: 10 }, root);
      const second = await runGrep({ pattern: 'NEEDLE', head_limit: 10 }, root);
      expect(first.content).toBe(second.content);
    });
  });

  it('skips oversized files and reports the count instead of silently dropping them', async () => {
    await withProject(async (root) => {
      await writeFile(join(root, 'small.ts'), 'NEEDLE\n', 'utf-8');
      // 21MB > 20MB 上限
      await writeFile(join(root, 'huge.ts'), `${'x'.repeat(21 * 1024 * 1024)}\nNEEDLE\n`, 'utf-8');

      const result = await runGrep({ pattern: 'NEEDLE' }, root);
      expect(result.content).toContain('small.ts');
      expect(result.content).not.toContain('huge.ts');
      expect(result.content).toContain('未搜索');
    });
  });

  it('skips binary files detected by content, not just extension', async () => {
    await withProject(async (root) => {
      await writeFile(join(root, 'text.ts'), 'NEEDLE\n', 'utf-8');
      // 无常见二进制扩展名，但内容含 NUL
      await writeFile(join(root, 'blob.dat'), Buffer.from([0x4e, 0x00, 0x45, 0x45, 0x44]));

      const result = await runGrep({ pattern: 'NEED' }, root);
      expect(result.content).toContain('text.ts');
      expect(result.content).not.toContain('blob.dat');
    });
  });

  it('reports correct line numbers in multiline mode for many matches', async () => {
    await withProject(async (root) => {
      const lines = Array.from({ length: 200 }, (_, i) => (i % 2 === 0 ? 'NEEDLE' : 'filler'));
      await writeFile(join(root, 'many.ts'), `${lines.join('\n')}\n`, 'utf-8');

      const result = await runGrep(
        { pattern: 'NEEDLE', output_mode: 'content', multiline: true, head_limit: 3 },
        root,
      );
      expect(result.content).toContain('many.ts:1:');
      expect(result.content).toContain('many.ts:3:');
      expect(result.content).toContain('many.ts:5:');
    });
  });
});
