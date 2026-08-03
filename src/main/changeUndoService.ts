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
    throw new Error('Missing unified diff hunk header.');
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
    throw new Error(`File is not inside a registered project: ${filePath}`);
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
  if (!entry.path.trim()) throw new Error('File path is required.');
  if (!entry.diff.trim()) throw new Error(`Diff is required: ${entry.path}`);

  const projectRoot = assertInsideRegisteredProject(entry.path);
  const { absolutePath, isInside } = resolveInside(entry.path, projectRoot);
  if (!isInside) throw new Error(`Path is outside the allowed project: ${entry.path}`);

  const parsed = parseToolDiff(entry.diff);

  if (entry.isNew) {
    const exists = await fileExists(absolutePath);
    if (!exists) return absolutePath;

    const current = await readFile(absolutePath, 'utf-8');
    if (current !== parsed.after) {
      throw new Error(`The file was modified afterward and cannot be safely deleted: ${absolutePath}`);
    }
    await rm(absolutePath);
    return absolutePath;
  }

  const current = await readFile(absolutePath, 'utf-8');
  if (current !== parsed.after) {
    throw new Error(`The file was modified afterward and cannot be safely restored: ${absolutePath}`);
  }

  await writeFile(absolutePath, parsed.before, 'utf-8');
  return absolutePath;
}

export async function undoChanges(entries: ChangeUndoEntry[]): Promise<ChangeUndoResult> {
  if (!Array.isArray(entries) || entries.length === 0) {
    return { success: false, reverted: [], error: 'There are no file changes to undo.' };
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
