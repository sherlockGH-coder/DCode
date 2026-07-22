import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { editFileTool } from './editFile';
import { detectOutOfScopeFileAccess } from './filePermissionPolicy';
import { readFileTool } from './readFile';

describe('editFileTool', () => {
  it('edits files using file_path', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'deepseek-edit-file-'));
    try {
      const filePath = join(projectRoot, 'note.txt');
      await mkdir(projectRoot, { recursive: true });
      await writeFile(filePath, 'hello world\n', 'utf8');
      await readFileTool.execute({ file_path: filePath }, { projectPath: projectRoot, toolCallId: 'read_1' } as never);

      const result = await editFileTool.execute(
        {
          file_path: filePath,
          old_string: 'world',
          new_string: 'DeepSeek',
        },
        { projectPath: projectRoot, toolCallId: 'call_1' } as never,
      );

      expect(result.content).toContain('文件编辑成功');
      expect(readFileSync(filePath, 'utf8')).toContain('hello DeepSeek');
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('requires reading an existing file before editing', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'deepseek-edit-unread-'));
    try {
      const filePath = join(projectRoot, 'unread.txt');
      await mkdir(projectRoot, { recursive: true });
      await writeFile(filePath, 'alpha beta\n', 'utf8');

      await expect(editFileTool.execute(
        { file_path: filePath, old_string: 'beta', new_string: 'gamma' },
        { projectPath: projectRoot, toolCallId: 'call_2' } as never,
      )).rejects.toThrow('File has not been read yet');
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('creates a new file when old_string is empty', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'deepseek-edit-create-'));
    try {
      const filePath = join(projectRoot, 'nested', 'created.txt');

      const result = await editFileTool.execute(
        {
          file_path: filePath,
          old_string: '',
          new_string: 'created\n',
        },
        { projectPath: projectRoot, toolCallId: 'call_create' } as never,
      );

      expect(result.content).toContain('文件编辑成功');
      expect(readFileSync(filePath, 'utf8')).toBe('created\n');
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('rejects legacy path argument', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'deepseek-edit-legacy-'));
    try {
      const filePath = join(projectRoot, 'legacy.txt');
      await mkdir(projectRoot, { recursive: true });
      await writeFile(filePath, 'alpha beta\n', 'utf8');

      await expect(editFileTool.execute(
        { path: filePath, old_string: 'beta', new_string: 'gamma' },
        { projectPath: projectRoot, toolCallId: 'call_legacy' } as never,
      )).rejects.toThrow('edit_file requires file_path');
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('detects out-of-scope edit_file access from file_path', () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'deepseek-project-'));
    const outsideRoot = mkdtempSync(join(tmpdir(), 'deepseek-outside-'));
    try {
      const result = detectOutOfScopeFileAccess(
        'edit_file',
        { file_path: join(outsideRoot, 'secret.txt') },
        projectRoot,
      );

      expect(result?.absolutePath).toContain('secret.txt');
      expect(result?.projectRoot).toBe(projectRoot);
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
      rmSync(outsideRoot, { recursive: true, force: true });
    }
  });
});
