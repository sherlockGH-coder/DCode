import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync, utimesSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cachePath, computeSignature, readCache, writeCache } from './cache';

function tempDir(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

describe('computeSignature', () => {
  it('is stable when nothing changes', () => {
    const home = tempDir('deepseek-home-');
    try {
      writeFileSync(join(home, '.zshrc'), 'export PATH=/a:$PATH\n');
      expect(computeSignature('/bin/zsh', home)).toBe(computeSignature('/bin/zsh', home));
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it('changes when an rc file is modified', () => {
    const home = tempDir('deepseek-home-');
    try {
      const rc = join(home, '.zshrc');
      writeFileSync(rc, 'export PATH=/a:$PATH\n');
      const before = computeSignature('/bin/zsh', home);

      writeFileSync(rc, 'export PATH=/a:/b:$PATH\n');
      // Ensure mtime differs so writes in the same second are not ignored.
      const future = new Date(Date.now() + 5000);
      utimesSync(rc, future, future);

      expect(computeSignature('/bin/zsh', home)).not.toBe(before);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it('changes when a new rc file appears', () => {
    const home = tempDir('deepseek-home-');
    try {
      const before = computeSignature('/bin/zsh', home);
      writeFileSync(join(home, '.zprofile'), 'export FOO=1\n');
      expect(computeSignature('/bin/zsh', home)).not.toBe(before);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it('changes when the shell itself changes', () => {
    const home = tempDir('deepseek-home-');
    try {
      expect(computeSignature('/bin/zsh', home)).not.toBe(computeSignature('/bin/bash', home));
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});

describe('cache round-trip', () => {
  it('writes and reads back an entry', () => {
    const dir = tempDir('deepseek-cache-');
    try {
      writeCache(dir, 'sig-1', { PATH: '/usr/bin:/bin', HOME: '/Users/x' });
      const entry = readCache(dir);
      expect(entry).not.toBeNull();
      expect(entry!.signature).toBe('sig-1');
      expect(entry!.env.PATH).toBe('/usr/bin:/bin');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('returns null when no cache exists', () => {
    const dir = tempDir('deepseek-cache-');
    try {
      expect(readCache(dir)).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('returns null on corrupted cache instead of throwing', () => {
    const dir = tempDir('deepseek-cache-');
    try {
      writeFileSync(cachePath(dir), '{not valid json');
      expect(readCache(dir)).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects entries written by an older cache version', () => {
    const dir = tempDir('deepseek-cache-');
    try {
      writeFileSync(cachePath(dir), JSON.stringify({ version: 0, signature: 's', env: { PATH: '/x' } }));
      expect(readCache(dir)).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects entries with a malformed env payload', () => {
    const dir = tempDir('deepseek-cache-');
    try {
      writeFileSync(cachePath(dir), JSON.stringify({ version: 1, signature: 's', env: 'nope' }));
      expect(readCache(dir)).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('does not throw when the target directory is unwritable', () => {
    expect(() => writeCache('/nonexistent-dir-abc123', 'sig', { PATH: '/x' })).not.toThrow();
  });
});
