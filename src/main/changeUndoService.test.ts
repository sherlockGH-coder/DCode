import { mkdtemp, readFile, rm, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { realpathSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { undoChanges } from './changeUndoService';
import { projectManager } from './project';
import { buildAllAddedDiff, buildLineDiff } from './tools/diffUtil';

let projectRoot = '';

beforeEach(async () => {
  projectRoot = await mkdtemp(join(tmpdir(), 'dcode-undo-'));
  vi.spyOn(projectManager, 'getState').mockReturnValue({
    activeProject: projectRoot,
    projects: [{
      path: projectRoot,
      name: 'tmp',
      environment: 'local',
      addedAt: 1,
    }],
  });
});

afterEach(async () => {
  vi.restoreAllMocks();
  if (projectRoot) {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

describe('changeUndoService', () => {
  it('restores an edited file from a stored tool diff', async () => {
    const filePath = join(projectRoot, 'sample.txt');
    const before = 'one\ntwo\n';
    const after = 'one\nTWO\n';
    await writeFile(filePath, after, 'utf-8');

    const result = await undoChanges([{
      path: filePath,
      diff: buildLineDiff(before, after),
    }]);

    await expect(readFile(filePath, 'utf-8')).resolves.toBe(before);
    expect(result).toEqual({ success: true, reverted: [realpathSync.native(filePath)] });
  });

  it('deletes a file created by the assistant when content still matches', async () => {
    const filePath = join(projectRoot, 'created.txt');
    const content = 'created\nfile\n';
    await writeFile(filePath, content, 'utf-8');

    const result = await undoChanges([{
      path: filePath,
      diff: buildAllAddedDiff(content),
      isNew: true,
    }]);

    await expect(access(filePath)).rejects.toThrow();
    expect(result).toEqual({ success: true, reverted: [join(realpathSync.native(projectRoot), 'created.txt')] });
  });

  it('refuses to overwrite later user edits', async () => {
    const filePath = join(projectRoot, 'conflict.txt');
    await writeFile(filePath, 'user change\n', 'utf-8');

    const result = await undoChanges([{
      path: filePath,
      diff: buildLineDiff('before\n', 'assistant change\n'),
    }]);

    await expect(readFile(filePath, 'utf-8')).resolves.toBe('user change\n');
    expect(result.success).toBe(false);
    expect(result.reverted).toEqual([]);
    expect(result.error).toContain('不能安全恢复');
  });
});
