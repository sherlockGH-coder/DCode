import { access, readFile, rm, writeFile } from 'node:fs/promises';
import { resolveInside } from './pathSandbox';
import { projectManager } from './project';
import type { ChangeUndoEntry, ChangeUndoResult } from '../shared/types';

type ParsedDiff = {
  before: string;
  after: string;
};

const DIFF_HEADER_PREFIX = '@@';

function parseToolDiff(diff: string): ParsedDiff {
  const lines = diff.split('\n');
  const hunkStart = lines.findIndex((line) => line.startsWith(DIFF_HEADER_PREFIX));
  if (hunkStart < 0) {
    throw new Error('缺少 unified diff hunk 头。');
  }

  const before: string[] = [];
  const after: string[] = [];
  for (const line of lines.slice(hunkStart + 1)) {
    if (line.startsWith('+')) {
      after.push(line.slice(1));
    } else if (line.startsWith('-')) {
      before.push(line.slice(1));
    } else if (line.startsWith(' ')) {
      const text = line.slice(1);
      before.push(text);
      after.push(text);
    } else if (line === '') {
      before.push('');
      after.push('');
    }
  }

  return {
    before: before.join('\n'),
    after: after.join('\n'),
  };
}

function assertInsideRegisteredProject(filePath: string): string {
  const roots = projectManager.getState().projects.map((project) => project.path);
  const projectRoot = roots.find((root) => resolveInside(filePath, root).isInside);
  if (!projectRoot) {
    throw new Error(`文件不在已注册项目内: ${filePath}`);
  }
  return projectRoot;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function undoOneChange(entry: ChangeUndoEntry): Promise<string> {
  if (!entry.path.trim()) throw new Error('缺少文件路径。');
  if (!entry.diff.trim()) throw new Error(`缺少 diff: ${entry.path}`);

  const projectRoot = assertInsideRegisteredProject(entry.path);
  const { absolutePath, isInside } = resolveInside(entry.path, projectRoot);
  if (!isInside) throw new Error(`路径越界: ${entry.path}`);

  const parsed = parseToolDiff(entry.diff);

  if (entry.isNew) {
    const exists = await fileExists(absolutePath);
    if (!exists) return absolutePath;

    const current = await readFile(absolutePath, 'utf-8');
    if (current !== parsed.after) {
      throw new Error(`文件已被继续修改，不能安全删除: ${absolutePath}`);
    }
    await rm(absolutePath);
    return absolutePath;
  }

  const current = await readFile(absolutePath, 'utf-8');
  if (current !== parsed.after) {
    throw new Error(`文件已被继续修改，不能安全恢复: ${absolutePath}`);
  }

  await writeFile(absolutePath, parsed.before, 'utf-8');
  return absolutePath;
}

export async function undoChanges(entries: ChangeUndoEntry[]): Promise<ChangeUndoResult> {
  if (!Array.isArray(entries) || entries.length === 0) {
    return { success: false, reverted: [], error: '没有可撤销的文件改动。' };
  }

  const reverted: string[] = [];
  try {
    for (const entry of entries) {
      reverted.push(await undoOneChange(entry));
    }
    return { success: true, reverted };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { success: false, reverted, error };
  }
}

export const changeUndoInternals = {
  parseToolDiff,
  undoOneChange,
};
