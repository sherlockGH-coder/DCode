import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { mkdtemp, realpath, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { readFileTool } from './readFile';
import type { ToolExecuteResult, ToolExecutionContext } from './types';

async function withProject<T>(fn: (projectRoot: string) => Promise<T>): Promise<T> {
  const projectRoot = await mkdtemp(join(tmpdir(), 'deepseek-read-file-'));
  try {
    return await fn(projectRoot);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
}

function context(projectRoot: string): ToolExecutionContext {
  return {
    projectPath: projectRoot,
    toolCallId: 'call_read_file',
  };
}

async function executeRead(args: Record<string, unknown>, projectRoot: string): Promise<ToolExecuteResult> {
  const result = await readFileTool.execute(args, context(projectRoot));
  return typeof result === 'string' ? { content: result } : result;
}

describe('read_file tool', () => {
  it('reads file_path text with cat -n style line numbers', async () => {
    await withProject(async (projectRoot) => {
      const filePath = join(projectRoot, 'notes.txt');
      await writeFile(filePath, 'alpha\nbeta\n', 'utf-8');
      const expectedPath = await realpath(filePath);

      const result = await executeRead({ file_path: filePath }, projectRoot);

      expect(result.content).toBe('     1\talpha\n     2\tbeta\n     3\t');
      expect(result.metadata).toMatchObject({
        kind: 'read',
        path: expectedPath,
        lineCount: 3,
        truncated: false,
      });
    });
  });

  it('paginates text with offset and limit while preserving original line numbers', async () => {
    await withProject(async (projectRoot) => {
      const filePath = join(projectRoot, 'notes.txt');
      await writeFile(filePath, 'one\ntwo\nthree\nfour\n', 'utf-8');
      const expectedPath = await realpath(filePath);

      const result = await executeRead({ file_path: filePath, offset: 1, limit: 2 }, projectRoot);

      expect(result.content).toBe('     2\ttwo\n     3\tthree');
      expect(result.metadata).toMatchObject({
        kind: 'read',
        path: expectedPath,
        lineCount: 5,
        truncated: true,
      });
    });
  });

  it('returns an unchanged stub when the same range is read again without file changes', async () => {
    await withProject(async (projectRoot) => {
      const filePath = join(projectRoot, 'cached.txt');
      await writeFile(filePath, 'alpha\nbeta\n', 'utf-8');
      const expectedPath = await realpath(filePath);

      const first = await executeRead({ file_path: filePath, offset: 0, limit: 2 }, projectRoot);
      const second = await executeRead({ file_path: filePath, offset: 0, limit: 2 }, projectRoot);

      expect(first.content).toBe('     1\talpha\n     2\tbeta');
      expect(second.content).toContain('[File unchanged');
      expect(second.content).toContain(expectedPath);
      expect(second.metadata).toMatchObject({ kind: 'read', lineCount: 3, truncated: true });
    });
  });

  it('re-reads a cached range after the file changes', async () => {
    await withProject(async (projectRoot) => {
      const filePath = join(projectRoot, 'changed.txt');
      await writeFile(filePath, 'old\n', 'utf-8');
      await executeRead({ file_path: filePath }, projectRoot);

      await new Promise((resolve) => setTimeout(resolve, 5));
      await writeFile(filePath, 'new\n', 'utf-8');
      const result = await executeRead({ file_path: filePath }, projectRoot);

      expect(result.content).toBe('     1\tnew\n     2\t');
    });
  });

  it('rejects directories', async () => {
    await withProject(async (projectRoot) => {
      const dirPath = join(projectRoot, 'src');
      await mkdir(dirPath);

      await expect(executeRead({ file_path: dirPath }, projectRoot)).rejects.toThrow('Cannot read directories');
    });
  });

  it('rejects blocked device paths before attempting to read', async () => {
    await withProject(async (projectRoot) => {
      await expect(executeRead({ file_path: '/dev/stdin' }, projectRoot)).rejects.toThrow('Refusing to read blocked device path');
    });
  });

  it('suggests a similar file when the requested path is missing', async () => {
    await withProject(async (projectRoot) => {
      await writeFile(join(projectRoot, 'README.md'), 'docs\n', 'utf-8');

      await expect(executeRead({ file_path: join(projectRoot, 'README.txt') }, projectRoot))
        .rejects.toThrow('Similar file:');
    });
  });

  it('rejects legacy path argument', async () => {
    await withProject(async (projectRoot) => {
      const filePath = join(projectRoot, 'legacy.txt');
      await writeFile(filePath, 'legacy\n', 'utf-8');

      await expect(executeRead({ path: filePath }, projectRoot)).rejects.toThrow('read_file requires file_path');
    });
  });

  it('renders Jupyter notebooks as cells with outputs', async () => {
    await withProject(async (projectRoot) => {
      const filePath = join(projectRoot, 'notebook.ipynb');
      await writeFile(filePath, JSON.stringify({
        cells: [
          {
            cell_type: 'code',
            source: ['print("hi")\n'],
            outputs: [{ text: ['hi\n'] }],
          },
        ],
      }), 'utf-8');

      const result = await executeRead({ file_path: filePath }, projectRoot);

      expect(result.content).toContain('     1\t# Cell 1 [code]');
      expect(result.content).toContain('     2\tprint("hi")');
      expect(result.content).toContain('     4\t# Outputs');
      expect(result.content).toContain('     5\thi');
    });
  });

  it('returns Jupyter image outputs as image content blocks', async () => {
    await withProject(async (projectRoot) => {
      const filePath = join(projectRoot, 'notebook.ipynb');
      await writeFile(filePath, JSON.stringify({
        cells: [
          {
            cell_type: 'code',
            source: ['display(image)\n'],
            outputs: [{
              output_type: 'display_data',
              data: {
                'text/plain': '<Figure size 640x480>',
                'image/png': 'aW1hZ2U=',
              },
            }],
          },
        ],
      }), 'utf-8');

      const result = await executeRead({ file_path: filePath }, projectRoot);

      expect(result.content).toContain('<Figure size 640x480>');
      expect((result as any).contentBlocks).toEqual([
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: 'image/png',
            data: 'aW1hZ2U=',
          },
        },
      ]);
    });
  });

  it('returns an image content block without reading binary bytes as utf-8 text', async () => {
    await withProject(async (projectRoot) => {
      const filePath = join(projectRoot, 'image.png');
      await writeFile(filePath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));

      const result = await executeRead({ file_path: filePath }, projectRoot);

      expect(result.content).toContain('[Image file]');
      expect((result as any).contentBlocks).toEqual([
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: 'image/png',
            data: Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString('base64'),
          },
        },
      ]);
      expect(result.metadata).toMatchObject({ kind: 'read', lineCount: 0, truncated: false });
    });
  });

  it('returns a PDF document content block', async () => {
    await withProject(async (projectRoot) => {
      const filePath = join(projectRoot, 'doc.pdf');
      const bytes = Buffer.from('%PDF-1.4\n%%EOF\n', 'utf-8');
      await writeFile(filePath, bytes);

      const result = await executeRead({ file_path: filePath }, projectRoot);

      expect(result.content).toContain('[PDF file]');
      expect((result as any).contentBlocks).toEqual([
        {
          type: 'document',
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data: bytes.toString('base64'),
          },
        },
      ]);
    });
  });
});
