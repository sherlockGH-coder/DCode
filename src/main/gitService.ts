import { execFile } from 'node:child_process';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import type { GitActionResult, GitCommitStatus, Project } from '../shared/types';

const execFilePromise = promisify(execFile);
const GIT_MAX_BUFFER_BYTES = 10 * 1024 * 1024;

export interface GitBranchesResult {
  currentBranch: string;
  branches: string[];
}

const EMPTY_GIT_STATUS: GitCommitStatus = {
  hasGit: false,
  branch: '',
  additions: 0,
  deletions: 0,
  hasChanges: false,
  hasStagedChanges: false,
  hasUnstagedChanges: false,
  aheadCount: 0,
  hasRemote: false,
  hasUpstream: false,
};

export function parseGitPorcelain(output: string): Pick<GitCommitStatus, 'hasChanges' | 'hasStagedChanges' | 'hasUnstagedChanges'> {
  const rows = output.split('\n').filter(Boolean);
  return {
    hasChanges: rows.length > 0,
    hasStagedChanges: rows.some((row) => row[0] !== ' ' && row[0] !== '?'),
    hasUnstagedChanges: rows.some((row) => row.startsWith('??') || row[1] !== ' '),
  };
}

export function parseGitNumstat(output: string): { additions: number; deletions: number } {
  return output.split('\n').reduce((totals, row) => {
    const [added, deleted] = row.split('\t');
    const additions = Number.parseInt(added, 10);
    const deletions = Number.parseInt(deleted, 10);
    if (Number.isFinite(additions)) totals.additions += additions;
    if (Number.isFinite(deletions)) totals.deletions += deletions;
    return totals;
  }, { additions: 0, deletions: 0 });
}

export function resolveRegisteredProjectPath(
  folderPath: string,
  projects: Project[],
): string | null {
  if (typeof folderPath !== 'string' || folderPath.trim() === '') return null;

  const resolvedPath = resolve(folderPath);
  const match = projects.find((project) => project.path === resolvedPath);
  return match?.path ?? null;
}

export function normalizeGitFilePath(filePath: string): string | null {
  if (typeof filePath !== 'string') return null;

  const normalized = filePath.replace(/\\/g, '/').trim();
  if (!normalized || normalized.includes('\0')) return null;
  if (normalized.startsWith('/') || /^[a-zA-Z]:\//.test(normalized)) return null;
  if (normalized.split('/').some((segment) => segment === '' || segment === '.' || segment === '..')) {
    return null;
  }

  return normalized;
}

export async function getGitBranches(projectPath: string): Promise<GitBranchesResult | null> {
  try {
    await runGit(projectPath, ['rev-parse', '--is-inside-work-tree']);

    const activeOut = await runGit(projectPath, ['rev-parse', '--abbrev-ref', 'HEAD']);
    const listOut = await runGit(projectPath, ['branch', '--format=%(refname:short)']);
    const branches = listOut
      .split('\n')
      .map((branch) => branch.trim())
      .filter(Boolean);

    return { currentBranch: activeOut.trim(), branches };
  } catch {
    return null;
  }
}

export async function checkoutGitBranch(
  projectPath: string,
  branch: string,
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const branches = await getGitBranches(projectPath);
    if (!branches) {
      return { success: false, error: '不是 Git 仓库，或 git 命令不可用。' };
    }

    if (!branches.branches.includes(branch)) {
      return { success: false, error: `分支不存在: ${branch}` };
    }

    await runGit(projectPath, ['checkout', branch]);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function getGitChangedFiles(projectPath: string): Promise<{ files: string[]; hasGit: boolean }> {
  try {
    await runGit(projectPath, ['rev-parse', '--is-inside-work-tree']);
    const stdout = await runGit(projectPath, ['diff', '--name-only', '--diff-filter=ACMR']);
    const files = stdout
      .split('\n')
      .map((file) => file.trim())
      .filter(Boolean);
    return { files, hasGit: true };
  } catch {
    return { files: [], hasGit: false };
  }
}

export async function getGitFileDiff(projectPath: string, filePath: string): Promise<string> {
  const normalized = normalizeGitFilePath(filePath);
  if (!normalized) return '';

  try {
    return await runGit(projectPath, ['diff', '-U999999', '--', normalized]);
  } catch {
    return '';
  }
}

export async function getGitCommitStatus(projectPath: string): Promise<GitCommitStatus> {
  try {
    await runGit(projectPath, ['rev-parse', '--is-inside-work-tree']);
    const branch = (await runGit(projectPath, ['rev-parse', '--abbrev-ref', 'HEAD'])).trim();
    const porcelain = parseGitPorcelain(await runGit(projectPath, ['status', '--porcelain=v1']));
    const remotes = (await runGit(projectPath, ['remote'])).split('\n').map((item) => item.trim()).filter(Boolean);

    let numstat = { additions: 0, deletions: 0 };
    try {
      numstat = parseGitNumstat(await runGit(projectPath, ['diff', '--numstat', 'HEAD']));
    } catch {
      numstat = parseGitNumstat(await runGit(projectPath, ['diff', '--numstat']));
    }

    let hasUpstream = false;
    let aheadCount = 0;
    try {
      await runGit(projectPath, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']);
      hasUpstream = true;
      aheadCount = Number.parseInt((await runGit(projectPath, ['rev-list', '--count', '@{u}..HEAD'])).trim(), 10) || 0;
    } catch {

    }

    return {
      hasGit: true,
      branch,
      ...numstat,
      ...porcelain,
      aheadCount,
      hasRemote: remotes.length > 0,
      hasUpstream,
    };
  } catch {
    return { ...EMPTY_GIT_STATUS };
  }
}

export async function commitGitChanges(
  projectPath: string,
  message: string,
  includeUnstaged: boolean,
): Promise<GitActionResult> {
  try {
    if (includeUnstaged) await runGit(projectPath, ['add', '-A']);
    const stagedFiles = (await runGit(projectPath, ['diff', '--cached', '--name-only']))
      .split('\n')
      .map((file) => file.trim())
      .filter(Boolean);
    if (stagedFiles.length === 0) return { success: false, error: '没有可提交的暂存更改。' };

    const commitMessage = message.trim() || `Update ${stagedFiles.length} ${stagedFiles.length === 1 ? 'file' : 'files'}`;
    await runGit(projectPath, ['commit', '-m', commitMessage]);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function pushGitChanges(projectPath: string): Promise<GitActionResult> {
  try {
    await runGit(projectPath, ['push']);
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes('has no upstream branch')) return { success: false, error: message };

    try {
      const branch = (await runGit(projectPath, ['rev-parse', '--abbrev-ref', 'HEAD'])).trim();
      const remotes = (await runGit(projectPath, ['remote'])).split('\n').map((item) => item.trim()).filter(Boolean);
      const remote = remotes.includes('origin') ? 'origin' : remotes[0];
      if (!remote) return { success: false, error: '当前仓库没有可用的远程仓库。' };
      await runGit(projectPath, ['push', '--set-upstream', remote, branch]);
      return { success: true };
    } catch (fallbackError) {
      return { success: false, error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError) };
    }
  }
}

async function runGit(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFilePromise('git', args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: GIT_MAX_BUFFER_BYTES,
  });
  return String(stdout);
}
