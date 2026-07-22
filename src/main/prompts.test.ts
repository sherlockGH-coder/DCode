import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadDeepseekMd, loadDeepseekMdSources, formatDeepseekMdContext } from './prompts';

const tempDirs: string[] = [];

function createTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'deepseek-prompts-'));
  tempDirs.push(dir);
  return dir;
}

function writeText(path: string, text: string): void {
  writeFileSync(path, text, 'utf-8');
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('loadDeepseekMdSources', () => {
  it('loads user layer from ~/.deepseek/DEEPSEEK.md', () => {
    const userDir = createTempDir();
    writeText(join(userDir, 'DEEPSEEK.md'), 'global instructions');

    const sources = loadDeepseekMdSources(null, { userDir });
    expect(sources).toHaveLength(1);
    expect(sources[0].scope).toBe('user');
    expect(sources[0].contents).toBe('global instructions');
    expect(sources[0].filePath).toBe(join(userDir, 'DEEPSEEK.md'));
  });

  it('loads project layer from root to leaf', () => {
    const userDir = createTempDir();
    const projectRoot = createTempDir();
    const packageDir = join(projectRoot, 'packages');
    const leafDir = join(packageDir, 'app');

    mkdirSync(join(projectRoot, '.git'));
    mkdirSync(leafDir, { recursive: true });
    writeText(join(userDir, 'DEEPSEEK.md'), 'global');
    writeText(join(projectRoot, 'DEEPSEEK.md'), 'root');
    writeText(join(packageDir, 'DEEPSEEK.md'), 'package');

    const sources = loadDeepseekMdSources(leafDir, { userDir });
    expect(sources).toHaveLength(3);
    expect(sources[0].scope).toBe('user');
    expect(sources[0].contents).toBe('global');
    expect(sources[1].scope).toBe('project');
    expect(sources[1].contents).toBe('root');
    expect(sources[2].scope).toBe('project');
    expect(sources[2].contents).toBe('package');
  });

  it('loads .deepseek/DEEPSEEK.md alongside root-level', () => {
    const userDir = createTempDir();
    const projectRoot = createTempDir();

    mkdirSync(join(projectRoot, '.git'));
    mkdirSync(join(projectRoot, '.deepseek'));
    writeText(join(projectRoot, 'DEEPSEEK.md'), 'root');
    writeText(join(projectRoot, '.deepseek', 'DEEPSEEK.md'), 'project-config');

    const sources = loadDeepseekMdSources(projectRoot, { userDir });
    expect(sources).toHaveLength(2);
    expect(sources[0].filePath.endsWith('DEEPSEEK.md')).toBe(true);
    expect(sources[0].contents).toBe('root');
    expect(sources[1].filePath).toBe(join(projectRoot, '.deepseek', 'DEEPSEEK.md'));
    expect(sources[1].contents).toBe('project-config');
  });

  it('loads .deepseek/rules/*.md in sorted order', () => {
    const userDir = createTempDir();
    const projectRoot = createTempDir();

    mkdirSync(join(projectRoot, '.git'));
    mkdirSync(join(projectRoot, '.deepseek', 'rules'), { recursive: true });
    writeText(join(projectRoot, '.deepseek', 'rules', 'b-second.md'), 'second rule');
    writeText(join(projectRoot, '.deepseek', 'rules', 'a-first.md'), 'first rule');

    const sources = loadDeepseekMdSources(projectRoot, { userDir });
    expect(sources).toHaveLength(2);
    expect(sources[0].filePath.endsWith('a-first.md')).toBe(true);
    expect(sources[0].contents).toBe('first rule');
    expect(sources[1].filePath.endsWith('b-second.md')).toBe(true);
    expect(sources[1].contents).toBe('second rule');
  });

  it('loads local layer from DEEPSEEK.local.md (project root only)', () => {
    const userDir = createTempDir();
    const projectRoot = createTempDir();
    const subdir = join(projectRoot, 'src');

    mkdirSync(join(projectRoot, '.git'));
    mkdirSync(subdir);
    writeText(join(projectRoot, 'DEEPSEEK.md'), 'root');
    writeText(join(projectRoot, 'DEEPSEEK.local.md'), 'local-private');

    const sources = loadDeepseekMdSources(subdir, { userDir });
    expect(sources).toHaveLength(2);
    expect(sources[0].scope).toBe('project');
    expect(sources[0].contents).toBe('root');
    expect(sources[1].scope).toBe('local');
    expect(sources[1].contents).toBe('local-private');
    expect(sources[1].filePath).toBe(join(projectRoot, 'DEEPSEEK.local.md'));
  });

  it('does not walk past the repository root marker', () => {
    const userDir = createTempDir();
    const workspace = createTempDir();
    const projectRoot = join(workspace, 'repo');
    const leafDir = join(projectRoot, 'src');

    mkdirSync(leafDir, { recursive: true });
    mkdirSync(join(projectRoot, '.git'));
    writeText(join(workspace, 'DEEPSEEK.md'), 'outside');
    writeText(join(projectRoot, 'DEEPSEEK.md'), 'inside');

    const sources = loadDeepseekMdSources(leafDir, { userDir });
    expect(sources).toHaveLength(1);
    expect(sources[0].contents).toBe('inside');
  });

  it('respects maxBytes budget across all layers', () => {
    const userDir = createTempDir();
    const projectRoot = createTempDir();

    mkdirSync(join(projectRoot, '.git'));
    writeText(join(userDir, 'DEEPSEEK.md'), 'a'.repeat(100));
    writeText(join(projectRoot, 'DEEPSEEK.md'), 'b'.repeat(100));

    const sources = loadDeepseekMdSources(projectRoot, { userDir, maxBytes: 150 });
    expect(sources).toHaveLength(2);
    expect(sources[0].contents).toBe('a'.repeat(100));

    expect(sources[1].contents.length).toBeLessThanOrEqual(50);
  });
});

describe('loadDeepseekMd (backward compatibility)', () => {
  it('combines all sources with newlines', () => {
    const userDir = createTempDir();
    const projectRoot = createTempDir();

    mkdirSync(join(projectRoot, '.git'));
    writeText(join(userDir, 'DEEPSEEK.md'), 'global');
    writeText(join(projectRoot, 'DEEPSEEK.md'), 'root');

    const merged = loadDeepseekMd(projectRoot, { userDir });
    expect(merged).toBe('global\n\nroot');
  });
});

describe('formatDeepseekMdContext', () => {
  it('wraps instructions in a model-visible provenance block', () => {
    const projectRoot = createTempDir();

    expect(formatDeepseekMdContext(projectRoot, 'body')).toBe(
      `# DEEPSEEK.md instructions for ${projectRoot}\n\n<INSTRUCTIONS>\nbody\n</INSTRUCTIONS>`,
    );
  });
});
