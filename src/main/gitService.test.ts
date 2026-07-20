import { describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { normalizeGitFilePath, parseGitNumstat, parseGitPorcelain, resolveRegisteredProjectPath } from './gitService';
import type { Project } from '../shared/types';

const projectPath = resolve('demo');
const otherProjectPath = resolve('other');

const projects: Project[] = [
  {
    path: projectPath,
    name: 'demo',
    environment: 'local',
    addedAt: 1,
  },
];

describe('gitService', () => {
  it('only resolves registered project roots', () => {
    expect(resolveRegisteredProjectPath(projectPath, projects)).toBe(projectPath);
    expect(resolveRegisteredProjectPath(otherProjectPath, projects)).toBeNull();
  });

  it('normalizes diff paths to repo-relative safe pathspecs', () => {
    expect(normalizeGitFilePath('src/main.ts')).toBe('src/main.ts');
    expect(normalizeGitFilePath('src\\main.ts')).toBe('src/main.ts');
    expect(normalizeGitFilePath('../secret.txt')).toBeNull();
    expect(normalizeGitFilePath('/etc/passwd')).toBeNull();
    expect(normalizeGitFilePath('src/../secret.txt')).toBeNull();
    expect(normalizeGitFilePath('src/..')).toBeNull();
    expect(normalizeGitFilePath('./src/main.ts')).toBeNull();
    expect(normalizeGitFilePath('src/main.ts\0')).toBeNull();
  });

  it('separates staged and unstaged git status entries', () => {
    expect(parseGitPorcelain('M  staged.ts\n M unstaged.ts\n?? new.ts\n')).toEqual({
      hasChanges: true,
      hasStagedChanges: true,
      hasUnstagedChanges: true,
    });
    expect(parseGitPorcelain('')).toEqual({
      hasChanges: false,
      hasStagedChanges: false,
      hasUnstagedChanges: false,
    });
  });

  it('totals text additions and deletions while ignoring binary markers', () => {
    expect(parseGitNumstat('12\t3\tsrc/a.ts\n5\t0\tsrc/b.ts\n-\t-\timage.png')).toEqual({
      additions: 17,
      deletions: 3,
    });
  });
});
