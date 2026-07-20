import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadDcodeMd, loadDcodeMdSources, formatDcodeMdContext } from './prompts';

const tempDirs: string[] = [];

function createTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'dcode-prompts-'));
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

describe('loadDcodeMdSources', () => {
  it('loads user layer from ~/.dcode/DCODE.md', () => {
    const userDir = createTempDir();
    writeText(join(userDir, 'DCODE.md'), 'global instructions');

    const sources = loadDcodeMdSources(null, { userDir });
    expect(sources).toHaveLength(1);
    expect(sources[0].scope).toBe('user');
    expect(sources[0].contents).toBe('global instructions');
    expect(sources[0].filePath).toBe(join(userDir, 'DCODE.md'));
  });

  it('loads project layer from root to leaf', () => {
    const userDir = createTempDir();
    const projectRoot = createTempDir();
    const packageDir = join(projectRoot, 'packages');
    const leafDir = join(packageDir, 'app');

    mkdirSync(join(projectRoot, '.git'));
    mkdirSync(leafDir, { recursive: true });
    writeText(join(userDir, 'DCODE.md'), 'global');
    writeText(join(projectRoot, 'DCODE.md'), 'root');
    writeText(join(packageDir, 'DCODE.md'), 'package');

    const sources = loadDcodeMdSources(leafDir, { userDir });
    expect(sources).toHaveLength(3);
    expect(sources[0].scope).toBe('user');
    expect(sources[0].contents).toBe('global');
    expect(sources[1].scope).toBe('project');
    expect(sources[1].contents).toBe('root');
    expect(sources[2].scope).toBe('project');
    expect(sources[2].contents).toBe('package');
  });

  it('loads .dcode/DCODE.md alongside root-level', () => {
    const userDir = createTempDir();
    const projectRoot = createTempDir();

    mkdirSync(join(projectRoot, '.git'));
    mkdirSync(join(projectRoot, '.dcode'));
    writeText(join(projectRoot, 'DCODE.md'), 'root');
    writeText(join(projectRoot, '.dcode', 'DCODE.md'), 'project-config');

    const sources = loadDcodeMdSources(projectRoot, { userDir });
    expect(sources).toHaveLength(2);
    expect(sources[0].filePath.endsWith('DCODE.md')).toBe(true);
    expect(sources[0].contents).toBe('root');
    expect(sources[1].filePath).toBe(join(projectRoot, '.dcode', 'DCODE.md'));
    expect(sources[1].contents).toBe('project-config');
  });

  it('loads .dcode/rules/*.md in sorted order', () => {
    const userDir = createTempDir();
    const projectRoot = createTempDir();

    mkdirSync(join(projectRoot, '.git'));
    mkdirSync(join(projectRoot, '.dcode', 'rules'), { recursive: true });
    writeText(join(projectRoot, '.dcode', 'rules', 'b-second.md'), 'second rule');
    writeText(join(projectRoot, '.dcode', 'rules', 'a-first.md'), 'first rule');

    const sources = loadDcodeMdSources(projectRoot, { userDir });
    expect(sources).toHaveLength(2);
    expect(sources[0].filePath.endsWith('a-first.md')).toBe(true);
    expect(sources[0].contents).toBe('first rule');
    expect(sources[1].filePath.endsWith('b-second.md')).toBe(true);
    expect(sources[1].contents).toBe('second rule');
  });

  it('loads local layer from DCODE.local.md (project root only)', () => {
    const userDir = createTempDir();
    const projectRoot = createTempDir();
    const subdir = join(projectRoot, 'src');

    mkdirSync(join(projectRoot, '.git'));
    mkdirSync(subdir);
    writeText(join(projectRoot, 'DCODE.md'), 'root');
    writeText(join(projectRoot, 'DCODE.local.md'), 'local-private');

    const sources = loadDcodeMdSources(subdir, { userDir });
    expect(sources).toHaveLength(2);
    expect(sources[0].scope).toBe('project');
    expect(sources[0].contents).toBe('root');
    expect(sources[1].scope).toBe('local');
    expect(sources[1].contents).toBe('local-private');
    expect(sources[1].filePath).toBe(join(projectRoot, 'DCODE.local.md'));
  });

  it('does not walk past the repository root marker', () => {
    const userDir = createTempDir();
    const workspace = createTempDir();
    const projectRoot = join(workspace, 'repo');
    const leafDir = join(projectRoot, 'src');

    mkdirSync(leafDir, { recursive: true });
    mkdirSync(join(projectRoot, '.git'));
    writeText(join(workspace, 'DCODE.md'), 'outside');
    writeText(join(projectRoot, 'DCODE.md'), 'inside');

    const sources = loadDcodeMdSources(leafDir, { userDir });
    expect(sources).toHaveLength(1);
    expect(sources[0].contents).toBe('inside');
  });

  it('respects maxBytes budget across all layers', () => {
    const userDir = createTempDir();
    const projectRoot = createTempDir();

    mkdirSync(join(projectRoot, '.git'));
    writeText(join(userDir, 'DCODE.md'), 'a'.repeat(100));
    writeText(join(projectRoot, 'DCODE.md'), 'b'.repeat(100));

    const sources = loadDcodeMdSources(projectRoot, { userDir, maxBytes: 150 });
    expect(sources).toHaveLength(2);
    expect(sources[0].contents).toBe('a'.repeat(100));

    expect(sources[1].contents.length).toBeLessThanOrEqual(50);
  });
});

describe('loadDcodeMd (backward compatibility)', () => {
  it('combines all sources with newlines', () => {
    const userDir = createTempDir();
    const projectRoot = createTempDir();

    mkdirSync(join(projectRoot, '.git'));
    writeText(join(userDir, 'DCODE.md'), 'global');
    writeText(join(projectRoot, 'DCODE.md'), 'root');

    const merged = loadDcodeMd(projectRoot, { userDir });
    expect(merged).toBe('global\n\nroot');
  });
});

describe('formatDcodeMdContext', () => {
  it('wraps instructions in a model-visible provenance block', () => {
    const projectRoot = createTempDir();

    expect(formatDcodeMdContext(projectRoot, 'body')).toBe(
      `# DCODE.md instructions for ${projectRoot}\n\n<INSTRUCTIONS>\nbody\n</INSTRUCTIONS>`,
    );
  });
});
