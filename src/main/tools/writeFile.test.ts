import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { mkdir, writeFile as writeFileAsync } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { writeFileTool } from './writeFile';
import { readFileTool } from './readFile';

describe('writeFileTool', () => {
  it('creates a new file with file_path', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'deepseek-write-file-'));
    try {
      const filePath = join(projectRoot, 'new.txt');
      const result = await writeFileTool.execute(
        { file_path: filePath, content: 'hello\n' },
        { projectPath: projectRoot, toolCallId: 'call_1' } as never,
      );

      expect(result.content).toContain('文件写入成功');
      expect(readFileSync(filePath, 'utf8')).toBe('hello\n');
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('requires reading an existing file before overwriting it', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'deepseek-write-unread-'));
    try {
      const filePath = join(projectRoot, 'existing.txt');
      await mkdir(projectRoot, { recursive: true });
      await writeFileAsync(filePath, 'old\n', 'utf8');

      await expect(writeFileTool.execute(
        { file_path: filePath, content: 'new\n' },
        { projectPath: projectRoot, toolCallId: 'call_2' } as never,
      )).rejects.toThrow('File has not been read yet');
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('allows overwriting after a full read', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'deepseek-write-read-'));
    try {
      const filePath = join(projectRoot, 'existing.txt');
      await mkdir(projectRoot, { recursive: true });
      await writeFileAsync(filePath, 'old\n', 'utf8');
      await readFileTool.execute({ file_path: filePath }, { projectPath: projectRoot, toolCallId: 'read_1' } as never);

      const result = await writeFileTool.execute(
        { file_path: filePath, content: 'new\n' },
        { projectPath: projectRoot, toolCallId: 'call_3' } as never,
      );

      expect(result.content).toContain('文件写入成功');
      expect(readFileSync(filePath, 'utf8')).toBe('new\n');
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('rejects legacy path argument', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'deepseek-write-legacy-'));
    try {
      const filePath = join(projectRoot, 'legacy.txt');

      await expect(writeFileTool.execute(
        { path: filePath, content: 'new\n' },
        { projectPath: projectRoot, toolCallId: 'call_legacy' } as never,
      )).rejects.toThrow('write_file requires file_path');
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });
});
